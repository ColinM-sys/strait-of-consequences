"""
Replicates what the JS SURVEY mode does:
- Fetches ArcGIS World Imagery tiles of Tehran Mehrabad (OIII)
- Splits bbox into 3x3 non-overlapping sub-tiles
- Runs aircraft count prompt on each tile using hormuz-vision:latest
- Sums and reports total

Ground truth: ~140 aircraft visible at Tehran Mehrabad
"""
import base64, io, json, urllib.request, re
from PIL import Image

OLLAMA_URL = 'http://localhost:11434/api/chat'
MODEL = 'hormuz-vision:latest'

# Tehran Mehrabad (OIII) — tight bbox around the airport complex only
BBOX_SW = (35.676, 51.295)  # lat, lng  (south edge of runways)
BBOX_NE = (35.708, 51.355)  # lat, lng  (north edge including aprons)

Q_COUNT_AC = (
    'Satellite photo of an airport area. Count every airplane shape (cross, T-shape, or delta wing) '
    'you can see on tarmac, aprons, gates, or open ground. '
    'Reply with ONLY: "Total Count: N aircraft" where N is your count. '
    'If you see no aircraft shapes at all, reply "Total Count: 0 aircraft".'
)

def fetch_arcgis(sw_lat, sw_lng, ne_lat, ne_lng):
    url = (
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export'
        f'?bbox={sw_lng},{sw_lat},{ne_lng},{ne_lat}'
        '&bboxSR=4326&size=1024,1024&imageSR=4326&format=jpg&f=image'
    )
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

def to_b64(data):
    return base64.b64encode(data).decode()

def ollama_count(b64, q):
    body = {
        'model': MODEL,
        'messages': [{'role': 'user', 'content': q, 'images': [b64]}],
        'stream': False,
        'options': {'temperature': 0.1, 'num_predict': 400},
    }
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
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

def main():
    sw_lat, sw_lng = BBOX_SW
    ne_lat, ne_lng = BBOX_NE
    lat_step = (ne_lat - sw_lat) / 3
    lng_step = (ne_lng - sw_lng) / 3

    print(f'Tehran Mehrabad 3x3 sub-tile aircraft count')
    print(f'Model: {MODEL}')
    print(f'BBOX: {BBOX_SW} to {BBOX_NE}')
    print()

    GRID = 3
    lat_step = (ne_lat - sw_lat) / GRID
    lng_step = (ne_lng - sw_lng) / GRID
    grand_total = 0
    grid = [[0]*GRID for _ in range(GRID)]

    for row in range(GRID):
        for col in range(GRID):
            t_sw_lat = sw_lat + row * lat_step
            t_sw_lng = sw_lng + col * lng_step
            t_ne_lat = sw_lat + (row+1) * lat_step
            t_ne_lng = sw_lng + (col+1) * lng_step

            print(f'  Tile R{row}C{col}: fetching ArcGIS...', end=' ', flush=True)
            img_data = fetch_arcgis(t_sw_lat, t_sw_lng, t_ne_lat, t_ne_lng)
            b64 = to_b64(img_data)

            print('counting x3...', end=' ', flush=True)
            # Run 3 times, take median to eliminate hallucinated outliers
            runs = sorted([parse_ac(ollama_count(b64, Q_COUNT_AC)) for _ in range(3)])
            count = runs[1]  # median of 3
            grand_total += count
            grid[row][col] = count
            print(f'= {count}  [runs: {runs}]')

    print()
    print('Grid counts:')
    for row in range(3):
        print(f'  R{row}: {grid[row]}')
    print()
    print(f'TOTAL AIRCRAFT: {grand_total}')
    print(f'Ground truth: ~140')
    pct_err = abs(grand_total - 140) / 140 * 100
    print(f'Error vs ground truth: {pct_err:.1f}%')
    if pct_err <= 15:
        print('PASS - within 15%')
    elif pct_err <= 30:
        print('CLOSE (within 30%)')
    else:
        print('FAIL (>30% off - needs prompt tuning)')

if __name__ == '__main__':
    main()
