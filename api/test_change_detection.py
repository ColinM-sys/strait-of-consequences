"""
Test: VLM change detection grid format (side-by-side composite)
- Fetches a real ArcGIS satellite tile of Hormuz area
- Paints bright patches into known grid cells on the AFTER copy
- Stitches BEFORE (left) and AFTER (right) into one image
- Sends to llama3.2-vision:11b with the new compare prompt
- Checks that response contains the correct [RxCy] grid tags
"""
import base64, io, json, urllib.request, re, sys
from PIL import Image, ImageDraw, ImageFont

OLLAMA_URL = 'http://localhost:11434/api/chat'
MODEL      = 'llama3.2-vision:11b'

REF_IMAGE = 'src/ref_naval.b64'  # existing project ref image

def fetch_base_image():
    import os, pathlib
    root = pathlib.Path(__file__).parent.parent
    p = root / REF_IMAGE
    if p.exists():
        print(f'Using ref image: {p}')
        data = p.read_text().strip()
        return Image.open(io.BytesIO(base64.b64decode(data))).convert('RGB').resize((512, 512))
    # Fallback: synthesize a plausible dark-water satellite image
    print('Ref image not found — synthesizing test image')
    img = Image.new('RGB', (512, 512), (20, 30, 25))
    draw = ImageDraw.Draw(img)
    import random; random.seed(42)
    for _ in range(120):
        x, y = random.randint(0,511), random.randint(0,511)
        r = random.randint(1,4)
        draw.ellipse([x-r,y-r,x+r,y+r], fill=(200,210,200))
    return img

def paint_patch(img, row, col, color=(255, 230, 60), opacity=0.75):
    w, h = img.size
    cw, ch = w // 3, h // 3
    margin = cw // 6
    x0, y0 = col*cw + margin, row*ch + margin
    x1, y1 = (col+1)*cw - margin, (row+1)*ch - margin
    overlay = img.copy()
    ImageDraw.Draw(overlay).rectangle([x0, y0, x1, y1], fill=color)
    return Image.blend(img, overlay, opacity)

def make_composite(before, after, label_b='BEFORE Apr-15', label_a='AFTER Apr-21'):
    W, H = before.size
    gap = 4
    comp = Image.new('RGB', (W*2 + gap, H + 24), (10, 20, 30))
    comp.paste(before, (0, 24))
    comp.paste(after,  (W + gap, 24))
    draw = ImageDraw.Draw(comp)
    draw.rectangle([0, 0, W, 23], fill=(20, 40, 60))
    draw.rectangle([W+gap, 0, W*2+gap, 23], fill=(20, 40, 60))
    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
    draw.text((6, 4),     label_b, fill=(180, 200, 220), font=font)
    draw.text((W+gap+6, 4), label_a, fill=(255, 220, 80),  font=font)
    return comp

def to_b64(img):
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=92)
    return base64.b64encode(buf.getvalue()).decode()

def ask_ollama(b64_composite, label_before='Apr-15', label_after='Apr-21'):
    prompt = f"""You are looking at a composite satellite image. LEFT HALF = BEFORE ({label_before}). RIGHT HALF = AFTER ({label_after}). Both show the exact same geographic area.

Compare the two halves and find areas with VISUAL DISTORTIONS or changes between them: color shifts, brightness differences, new or missing bright shapes, texture changes.

Each half is divided into a 3x3 grid (rows 0-2 top-to-bottom, columns 0-2 left-to-right):
  [R0C0]=upper-left  [R0C1]=upper-center  [R0C2]=upper-right
  [R1C0]=middle-left [R1C1]=center        [R1C2]=middle-right
  [R2C0]=lower-left  [R2C1]=lower-center  [R2C2]=lower-right

For each grid cell where you see a difference between left and right, write one line:
[RxCy] — what changed

Only list cells that actually look different between the two halves. If nothing changed say: NO CHANGES DETECTED."""

    body = {
        'model': MODEL,
        'messages': [{'role': 'user', 'content': prompt, 'images': [b64_composite]}],
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
        return json.loads(r.read())['message']['content']

def main():
    base_img = fetch_base_image()
    print(f'Base image: {base_img.size}')

    before = base_img.copy()
    planted = [(0, 2), (2, 0)]   # upper-right and lower-left

    after = base_img.copy()
    for (r, c) in planted:
        after = paint_patch(after, r, c)

    composite = make_composite(before, after)
    print(f'Composite: {composite.size}')
    print(f'Planted changes at: {["[R{}C{}]".format(r,c) for r,c in planted]}')
    print(f'Sending to {MODEL} (30-90s)...\n')

    response = ask_ollama(to_b64(composite))

    print('-' * 60)
    print('MODEL RESPONSE:')
    print(response)
    print('-' * 60)

    found = re.findall(r'\[R([0-2])C([0-2])\]', response, re.IGNORECASE)
    found_set = {(int(r), int(c)) for r, c in found}

    print(f'\nGrid tags found: {["[R{}C{}]".format(r,c) for r,c in sorted(found_set)]}')
    hits      = [p for p in planted if p in found_set]
    misses    = [p for p in planted if p not in found_set]
    false_pos = [p for p in found_set if p not in planted]
    print(f'HITS:      {["[R{}C{}]".format(r,c) for r,c in hits]}')
    print(f'MISSES:    {["[R{}C{}]".format(r,c) for r,c in misses]}')
    print(f'FALSE POS: {["[R{}C{}]".format(r,c) for r,c in false_pos]}')

    if len(hits) == len(planted):
        print('\n✓ PASS — model correctly identified all planted changes')
    elif hits:
        print(f'\n~ PARTIAL — {len(hits)}/{len(planted)} found')
    else:
        print('\n✗ FAIL — model missed all planted changes')
        if not found_set:
            print('  (did not use grid format — fallback keyword parser will handle it in-app)')

if __name__ == '__main__':
    main()
