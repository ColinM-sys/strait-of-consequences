"""Seed Persian Gulf infrastructure layer from OpenStreetMap via Overpass API.

Runs once. Caches the result to /osm_infra.json at the repo root so the frontend
can load it as a static asset without hitting Overpass on every page load.

Usage: python api/seed_osm_infra.py
"""
import json
import os
import sys
import urllib.request

OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

# Persian Gulf + Strait of Hormuz + Gulf of Oman bounding box (south,west,north,east)
BBOX = (22.0, 49.0, 30.0, 62.0)

QUERY = """
[out:json][timeout:90];
(
  node["harbour"]({s},{w},{n},{e});
  way["harbour"]({s},{w},{n},{e});
  node["aeroway"="aerodrome"]({s},{w},{n},{e});
  way["aeroway"="aerodrome"]({s},{w},{n},{e});
  node["industrial"="refinery"]({s},{w},{n},{e});
  way["industrial"="refinery"]({s},{w},{n},{e});
  node["man_made"="storage_tank"]({s},{w},{n},{e});
  node["man_made"="oil_well"]({s},{w},{n},{e});
  node["power"="plant"]({s},{w},{n},{e});
  way["power"="plant"]({s},{w},{n},{e});
  node["military"="naval_base"]({s},{w},{n},{e});
  way["military"="naval_base"]({s},{w},{n},{e});
  node["military"="base"]({s},{w},{n},{e});
  way["military"="base"]({s},{w},{n},{e});
  node["seamark:type"="harbour"]({s},{w},{n},{e});
);
out center;
""".format(s=BBOX[0], w=BBOX[1], n=BBOX[2], e=BBOX[3])


def categorize(tags):
    if tags.get('industrial') == 'refinery': return 'refinery'
    if tags.get('man_made') == 'storage_tank': return 'oil_terminal'
    if tags.get('man_made') == 'oil_well': return 'oil_well'
    if tags.get('aeroway') == 'aerodrome': return 'airport'
    if tags.get('military') in ('naval_base',): return 'naval_base'
    if tags.get('military') == 'base': return 'military_base'
    if tags.get('power') == 'plant': return 'power_plant'
    if tags.get('harbour') or tags.get('seamark:type') == 'harbour': return 'port'
    return 'other'


def main():
    print(f'Querying Overpass for bbox {BBOX}...', flush=True)
    data = urllib.parse.urlencode({'data': QUERY}).encode()
    req = urllib.request.Request(OVERPASS_URL, data=data,
        headers={'User-Agent': 'strait-of-consequences/1.0 (hackathon submission)'})
    with urllib.request.urlopen(req, timeout=120) as r:
        result = json.loads(r.read())

    elements = result.get('elements', [])
    print(f'Got {len(elements)} raw elements', flush=True)

    features = []
    for el in elements:
        # Nodes have lat/lon directly. Ways have center.lat/lon (because of "out center").
        if el.get('type') == 'node':
            lat, lng = el.get('lat'), el.get('lon')
        else:
            c = el.get('center', {})
            lat, lng = c.get('lat'), c.get('lon')
        if lat is None or lng is None:
            continue
        tags = el.get('tags', {})
        name = tags.get('name') or tags.get('name:en') or tags.get('operator') or ''
        cat = categorize(tags)
        features.append({
            'id': f"{el.get('type')}/{el.get('id')}",
            'lat': round(lat, 5),
            'lng': round(lng, 5),
            'name': name,
            'category': cat,
            'tags': {k: v for k, v in tags.items()
                     if k in ('name', 'name:en', 'operator', 'aeroway', 'harbour',
                              'industrial', 'man_made', 'power', 'military',
                              'seamark:type', 'icao', 'iata')},
        })

    # Drop unnamed "other" / oil_well clutter to keep the layer focused on
    # strategic assets (named ports, airbases, refineries, terminals, military)
    features = [f for f in features if not (f['category'] == 'oil_well' and not f['name'])]
    features = [f for f in features if not (f['category'] == 'other')]

    out_path = os.path.join(os.path.dirname(__file__), '..', 'osm_infra.json')
    out_path = os.path.normpath(out_path)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({
            'bbox': BBOX,
            'source': 'OpenStreetMap (Overpass API)',
            'count': len(features),
            'features': features,
        }, f, indent=2)
    print(f'Wrote {len(features)} features to {out_path}', flush=True)

    # Counts per category for quick sanity check
    cats = {}
    for f in features:
        cats[f['category']] = cats.get(f['category'], 0) + 1
    for cat, n in sorted(cats.items(), key=lambda x: -x[1]):
        print(f'  {cat:15s} {n:4d}', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'ERROR: {e}', file=sys.stderr)
        sys.exit(1)
