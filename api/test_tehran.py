"""
Live test: Tehran airport change detection Apr 4 vs Apr 23
Fetches real GIBS/MODIS tiles, builds pixel diff, sends to llama3.2-vision
"""
import base64, io, json, urllib.request, re
from PIL import Image, ImageDraw, ImageFont

OLLAMA_URL = 'http://localhost:11434/api/chat'
MODEL      = 'llama3.2-vision:11b'

# Mehrabad (OIII) + IKA — bbox covers both Tehran airports
BBOX = (50.9, 35.55, 51.75, 35.85)  # minLng, minLat, maxLng, maxLat

def fetch_gibs(date, bbox=BBOX):
    minLng, minLat, maxLng, maxLat = bbox
    bboxWms = f'{minLat},{minLng},{maxLat},{maxLng}'
    url = (
        'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?'
        'SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap'
        '&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor'
        f'&CRS=EPSG:4326&BBOX={bboxWms}'
        '&WIDTH=1024&HEIGHT=1024&FORMAT=image/jpeg'
        f'&TIME={date}'
    )
    print(f'  Fetching GIBS {date}...')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return Image.open(io.BytesIO(r.read())).convert('RGB').resize((512, 512))

def make_diff(before, after, boost=3):
    W, H = before.size
    canvas = Image.new('RGB', (W, H), (0, 0, 0))
    # Pixel difference
    ba = before.load(); aa = after.load(); ca = canvas.load()
    for y in range(H):
        for x in range(W):
            r = min(255, abs(ba[x,y][0] - aa[x,y][0]) * boost)
            g = min(255, abs(ba[x,y][1] - aa[x,y][1]) * boost)
            b = min(255, abs(ba[x,y][2] - aa[x,y][2]) * boost)
            ca[x,y] = (r, g, b)
    # Draw grid + labels
    draw = ImageDraw.Draw(canvas)
    cw, ch = W // 3, H // 3
    for i in range(1, 3):
        draw.line([(i*cw, 0), (i*cw, H)], fill=(255, 255, 80, 120), width=1)
        draw.line([(0, i*ch), (W, i*ch)], fill=(255, 255, 80, 120), width=1)
    try:
        font = ImageFont.truetype('arial.ttf', 13)
    except Exception:
        font = ImageFont.load_default()
    for r in range(3):
        for c in range(3):
            draw.text((c*cw+4, r*ch+3), f'R{r}C{c}', fill=(255,255,80), font=font)
    return canvas

def to_b64(img):
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=92)
    return base64.b64encode(buf.getvalue()).decode()

def ask_ollama(b64_diff, label_before, label_after):
    prompt = f"""This is a PIXEL DIFFERENCE image of two satellite photos ({label_before} vs {label_after}).
Bright/white/colored areas = pixels that changed. Dark/black = no change.
Grid cells are labeled in yellow (R0C0 through R2C2).

Reply in plain text only, no markdown, no bullet symbols.
List ONLY cells with visible bright areas, one per line like this:
R0C1 - bright spot, possible aircraft movement
R2C2 - color shift, cloud or surface change

Skip dark cells. Max 4 lines. If all dark: NO CHANGES DETECTED."""

    body = {
        'model': MODEL,
        'messages': [{'role': 'user', 'content': prompt, 'images': [b64_diff]}],
        'stream': False,
        'options': {'temperature': 0.1, 'num_predict': 300},
    }
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())['message']['content']

def main():
    label_before = '2026-04-04'
    label_after  = '2026-04-23'

    print('Tehran airport change detection test')
    print(f'BBOX: {BBOX}')
    print()

    print('Fetching images...')
    before = fetch_gibs(label_before)
    after  = fetch_gibs(label_after)

    print('Building pixel diff...')
    diff = make_diff(before, after)

    # Save diff for inspection
    diff.save('C:/Users/cmcdo/Documents/GitHub/hormuz-wargame/api/tehran_diff_debug.jpg', quality=92)
    print('Diff saved to api/tehran_diff_debug.jpg')

    print(f'Sending to {MODEL}...')
    response = ask_ollama(to_b64(diff), label_before, label_after)

    print()
    print('-' * 60)
    print('MODEL RESPONSE:')
    print(response)
    print('-' * 60)

    found = re.findall(r'[\[*\s]?R([0-2])C([0-2])[\]*:\s]', response, re.IGNORECASE)
    found_set = sorted({(int(r), int(c)) for r, c in found})
    print(f'Grid cells flagged: {["[R{}C{}]".format(r,c) for r,c in found_set]}')

    if not found_set:
        print('No grid tags — model said no changes or ignored format')
    else:
        print(f'{len(found_set)} change areas detected')

if __name__ == '__main__':
    main()
