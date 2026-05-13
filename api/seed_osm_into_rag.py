"""Ingest the 840 OSM infrastructure features into the ChromaDB RAG corpus
so INTEL CHAT can answer location queries like "where is Ras Tanura?" or
"what oil terminals are near Bandar Abbas?".

Reads osm_infra.json (produced by seed_osm_infra.py) and writes one doc per
feature into the `intel_observations` collection that the chat queries.

Idempotent — re-running drops prior osm_* docs first so the corpus stays clean.
"""
import json
import os
import sys

import chromadb

CATEGORY_HUMAN = {
    'refinery':      'oil refinery',
    'oil_terminal':  'oil / petroleum storage terminal',
    'airport':       'airport / aerodrome',
    'port':          'port / harbor',
    'military_base': 'military base',
    'naval_base':    'naval base',
    'power_plant':   'power plant',
}

# Lat/lng → country (rough approximation for added context)
def _country(lat, lng):
    if lat > 27.05: return 'Iran'
    if lat < 25.5 and lng > 54.0 and lng < 56.5: return 'United Arab Emirates'
    if lng < 51.5 and lat > 25.5: return 'Saudi Arabia'
    if lat > 25.7 and lat < 26.5 and lng > 56.4 and lng < 57.0: return 'Oman (Musandam)'
    if lat > 25.0 and lat < 26.5 and lng > 50.7 and lng < 51.7: return 'Qatar'
    if lat > 28.0 and lng < 49.5: return 'Iraq / Kuwait'
    if lat > 25.5 and lat < 26.5 and lng > 50.4 and lng < 50.7: return 'Bahrain'
    return 'Persian Gulf region'


def feature_to_doc(f):
    name = f.get('name') or '(unnamed)'
    cat = f.get('category', 'other')
    cat_h = CATEGORY_HUMAN.get(cat, cat)
    lat = f.get('lat')
    lng = f.get('lng')
    country = _country(lat, lng)
    tags = f.get('tags', {})
    extras = []
    if tags.get('icao'): extras.append(f"ICAO: {tags['icao']}")
    if tags.get('iata'): extras.append(f"IATA: {tags['iata']}")
    if tags.get('operator'): extras.append(f"operator: {tags['operator']}")
    extras_str = (' · ' + ' · '.join(extras)) if extras else ''
    text = (
        f"{name} — {cat_h} in {country}. "
        f"Coordinates: {lat:.4f}°N, {lng:.4f}°E. "
        f"Strategic asset on OpenStreetMap (category {cat}){extras_str}. "
        f"Source: OpenStreetMap / Overpass API."
    )
    return text, {
        'source': 'OpenStreetMap',
        'category': cat,
        'name': name,
        'country': country,
        'lat': lat,
        'lng': lng,
        'osm_id': f.get('id', ''),
    }


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    osm_path = os.path.normpath(os.path.join(here, '..', 'osm_infra.json'))
    if not os.path.exists(osm_path):
        print(f'ERROR: {osm_path} not found. Run seed_osm_infra.py first.', file=sys.stderr)
        sys.exit(1)
    with open(osm_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    features = data.get('features', [])
    print(f'Loaded {len(features)} features from {osm_path}', flush=True)

    client = chromadb.PersistentClient(path=os.path.join(here, 'intel_db'))
    col = client.get_or_create_collection(
        name='intel_observations',
        metadata={'hnsw:space': 'cosine'},
    )
    print(f'Collection currently holds {col.count()} docs', flush=True)

    # Drop prior osm_* docs so re-runs stay clean
    try:
        existing = col.get(where={'source': 'OpenStreetMap'}, include=['metadatas'])
        ids_to_drop = existing.get('ids', [])
        if ids_to_drop:
            col.delete(ids=ids_to_drop)
            print(f'Dropped {len(ids_to_drop)} prior OSM docs', flush=True)
    except Exception as e:
        print(f'warn: could not query prior OSM docs: {e}', flush=True)

    docs, metas, ids = [], [], []
    for f in features:
        text, meta = feature_to_doc(f)
        docs.append(text)
        metas.append(meta)
        ids.append(f"osm_{f.get('id', '').replace('/', '_')}")

    # ChromaDB add() handles batches, but let's chunk to keep it nice
    BATCH = 200
    for i in range(0, len(docs), BATCH):
        col.add(
            documents=docs[i:i+BATCH],
            metadatas=metas[i:i+BATCH],
            ids=ids[i:i+BATCH],
        )
        print(f'  added {min(i+BATCH, len(docs))}/{len(docs)}', flush=True)

    print(f'Done. Collection now holds {col.count()} docs.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'ERROR: {e}', file=sys.stderr)
        sys.exit(1)
