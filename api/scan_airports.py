"""
Overnight airport scan — Middle East + South Asia
Reads OurAirports CSV, runs 2x2 sub-tile aircraft count on each airport,
saves results incrementally to ../airport_intel.json (resume-safe).
Syncs to Lenovo demo machine after every 10 airports.

Usage: python scan_airports.py
"""
import base64, csv, io, json, os, re, time, urllib.request
from datetime import datetime

OLLAMA_URL   = 'http://localhost:11434/api/chat'
MODEL        = 'hormuz-vision:latest'
OUT_FILE     = os.path.join(os.path.dirname(__file__), '..', 'airport_intel.json')
AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
LENOVO_SCP   = 'cmcdo@10.0.0.54:C:/Users/cmcdo/Documents/GitHub/hormuz-wargame/airport_intel.json'

ME_SA_COUNTRIES = {
    'AE','BH','CY','EG','IL','IQ','IR','JO','KW','LB','OM','QA','SA','SY','TR','YE','PS',
    'AF','BD','BT','IN','LK','MV','NP','PK'
}
AIRPORT_TYPES = {'large_airport', 'medium_airport'}

BBOX_PAD = {'large_airport': 0.055, 'medium_airport': 0.035}

POI_KEYWORDS = ['airport','runway','airstrip','hangar','apron','helipad','helicopter',
                'pier','dock','harbor','harbour','port','naval','military','base',
                'jetty','wharf','terminal','facility','depot']

Q_CLASSIFY = (
    'Identify the MOST important feature in 1-3 words from this list only: '
    'airport / runway / airstrip / helipad / harbor / pier / dock / naval base / military base / '
    'open water / coastline / buildings / rocky terrain. Reply ONLY the matching phrase, nothing else.'
)
Q_COUNT_AC = (
    'Satellite photo of an airport area. Count every airplane shape (cross, T-shape, or delta wing) '
    'you can see on tarmac, aprons, gates, or open ground. '
    'Reply with ONLY: "Total Count: N aircraft" where N is your count. '
    'If you see no aircraft shapes at all, reply "Total Count: 0 aircraft".'
)

ANCHORS = {17, 34, 43, 123, 134}


def fetch_arcgis(sw_lat, sw_lng, ne_lat, ne_lng, size=512):
    url = (
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export'
        '?bbox={},{},{},{}&bboxSR=4326&size={},{}&imageSR=4326&format=jpg&f=image'
        .format(sw_lng, sw_lat, ne_lng, ne_lat, size, size)
    )
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return base64.b64encode(r.read()).decode()


def ollama(b64, q, num_predict=400, short=False):
    msgs = [{'role': 'user', 'content': q}]
    if b64:
        msgs[0]['images'] = [b64]
    opts = {'temperature': 0.1, 'num_predict': num_predict}
    if short:
        opts['stop'] = ['\n', '\n\n']
    body = {'model': MODEL, 'messages': msgs, 'stream': False, 'options': opts}
    req = urllib.request.Request(
        OLLAMA_URL, data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json'}, method='POST'
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())['message']['content'].strip()


def parse_ac(s):
    for pat in [
        r'Total\s+Count[:\s]+(\d+)\s*aircraft',
        r'TOTAL[:\s]+(\d+)\s*aircraft',
        r'(\d+)\s*aircraft\s*(?:total|found|detected)',
        r'(?:identified|counted|found)\s+(\d+)\s*aircraft',
        r'there are\s+(\d+)\s*aircraft',
        r'I count\s+(\d+)\s*aircraft',
    ]:
        m = re.search(pat, s, re.IGNORECASE)
        if m:
            return int(m.group(1))
    return 0


def scan_airport(lat, lng, atype):
    pad = BBOX_PAD.get(atype, 0.04)
    sw_lat, sw_lng = lat - pad, lng - pad * 1.4
    ne_lat, ne_lng = lat + pad, lng + pad * 1.4

    GRID = 3
    lat_step = (ne_lat - sw_lat) / GRID
    lng_step = (ne_lng - sw_lng) / GRID

    # Pass 1 — classify tiles
    poi_tiles = []
    for r in range(GRID):
        for c in range(GRID):
            t_sw = (sw_lat + r*lat_step, sw_lng + c*lng_step)
            t_ne = (sw_lat + (r+1)*lat_step, sw_lng + (c+1)*lng_step)
            try:
                b64 = fetch_arcgis(t_sw[0], t_sw[1], t_ne[0], t_ne[1], 1024)
                label = ollama(b64, Q_CLASSIFY, num_predict=80, short=True)
                key = re.sub(r'[^a-z ]', '', label.lower().replace('**','')).strip()
                if any(k in key for k in POI_KEYWORDS):
                    poi_tiles.append({'sw': t_sw, 'ne': t_ne})
            except Exception:
                pass

    if not poi_tiles:
        return 0

    # Merge POI bbox
    msw_lat = min(t['sw'][0] for t in poi_tiles)
    msw_lng = min(t['sw'][1] for t in poi_tiles)
    mne_lat = max(t['ne'][0] for t in poi_tiles)
    mne_lng = max(t['ne'][1] for t in poi_tiles)

    # Pass 2 — 2x2 sub-tile count
    SUB = 2
    sub_lat = (mne_lat - msw_lat) / SUB
    sub_lng = (mne_lng - msw_lng) / SUB
    total = 0

    for sr in range(SUB):
        for sc in range(SUB):
            ssw = (msw_lat + sr*sub_lat, msw_lng + sc*sub_lng)
            sne = (msw_lat + (sr+1)*sub_lat, msw_lng + (sc+1)*sub_lng)
            try:
                sb64 = fetch_arcgis(ssw[0], ssw[1], sne[0], sne[1], 512)
                resp = ollama(sb64, Q_COUNT_AC)
                n = parse_ac(resp)
                if n in ANCHORS:
                    chk = ollama(sb64,
                        'Does this satellite image show airport runways, tarmac, or parked aircraft? Answer yes or no.',
                        num_predict=10)
                    if not re.match(r'^y', chk, re.IGNORECASE):
                        n = 0
                total += n
            except Exception:
                pass

    return total


def scp_to_lenovo(local_path):
    try:
        os.system('scp "{}" "{}"'.format(local_path, LENOVO_SCP))
    except Exception:
        pass


def main():
    # Load existing results
    out_path = os.path.abspath(OUT_FILE)
    if os.path.exists(out_path):
        with open(out_path) as f:
            results = json.load(f)
        print('Resuming — {} airports already scanned'.format(len(results)))
    else:
        results = {}

    # Fetch airport list
    print('Fetching airport list...')
    req = urllib.request.Request(AIRPORTS_URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        content = r.read().decode('utf-8')
    reader = csv.DictReader(io.StringIO(content))
    airports = [
        row for row in reader
        if row['iso_country'] in ME_SA_COUNTRIES
        and row['type'] in AIRPORT_TYPES
        and row['latitude_deg'] and row['longitude_deg']
    ]
    print('{} airports to scan'.format(len(airports)))

    scanned = 0
    skipped = 0
    for i, ap in enumerate(airports):
        ident = ap['ident']
        name  = ap['name']
        lat   = float(ap['latitude_deg'])
        lng   = float(ap['longitude_deg'])
        atype = ap['type']
        country = ap['iso_country']

        if ident in results:
            skipped += 1
            continue

        print('[{}/{}] {} — {} ({})'.format(
            i+1, len(airports), ident, name[:35], country), end=' ', flush=True)

        t0 = time.time()
        try:
            count = scan_airport(lat, lng, atype)
            elapsed = time.time() - t0
            print('→ {} aircraft  ({:.0f}s)'.format(count, elapsed))
            results[ident] = {
                'name': name,
                'icao': ident,
                'country': country,
                'type': atype,
                'lat': lat,
                'lng': lng,
                'aircraft': count,
                'scanned': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
            }
        except Exception as e:
            print('ERROR: {}'.format(e))
            results[ident] = {
                'name': name, 'icao': ident, 'country': country,
                'type': atype, 'lat': lat, 'lng': lng,
                'aircraft': None, 'error': str(e),
                'scanned': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
            }

        scanned += 1

        # Save incrementally
        with open(out_path, 'w') as f:
            json.dump(results, f, indent=2)

        # Sync to Lenovo every 10 airports
        if scanned % 10 == 0:
            print('  → syncing to Lenovo...', end=' ', flush=True)
            scp_to_lenovo(out_path)
            print('done')

    # Final sync
    with open(out_path, 'w') as f:
        json.dump(results, f, indent=2)
    scp_to_lenovo(out_path)

    total_ac = sum(v['aircraft'] for v in results.values() if isinstance(v.get('aircraft'), int))
    print('\nDone. {} scanned, {} skipped, {} total aircraft counted'.format(
        scanned, skipped, total_ac))


if __name__ == '__main__':
    main()
