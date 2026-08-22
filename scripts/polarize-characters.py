"""
Recolour the SkyOffice character sheets into polar outfits.

The sprites use tiny palettes (22-25 colours), and each body part is a short
ramp of shades. So this does not repaint anything - it maps each ramp onto a new
one, keeping the shades in the same order. The pixel art, its shading and its
outlines survive untouched; only the hue changes.

Run from the repo root:  python3 scripts/polarize-characters.py
"""
from PIL import Image
import pathlib

SRC = pathlib.Path('client/public/assets/character')
# the login screen shows a bigger portrait from a different folder, drawn from
# the same palette - it has to be recoloured too or the preview lies about the
# character you are picking
LOGIN = pathlib.Path('client/src/images/login')

def lum(c):
    r, g, b = c
    return 0.299 * r + 0.587 * g + 0.114 * b

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def ramp(light, dark, steps):
    """a ramp of `steps` colours from light to dark, matching a source ramp"""
    a, b = hex_to_rgb(light), hex_to_rgb(dark)
    if steps == 1:
        return [a]
    return [
        tuple(round(a[j] + (b[j] - a[j]) * i / (steps - 1)) for j in range(3))
        for i in range(steps)
    ]

def build(source_hexes, light, dark):
    """map a source ramp onto a new one, brightest to brightest"""
    src = sorted((hex_to_rgb(h) for h in source_hexes), key=lum, reverse=True)
    return dict(zip(src, ramp(light, dark, len(src))))

# each entry: which source colours make up that body part, and the new ramp
OUTFITS = {
    # 빨강 파카
    'adam': [
        (['#bba386', '#959d58', '#687253', '#5f694a', '#5d6043'], '#ffb3a0', '#b8402c'),
        (['#9f74a8', '#805e8e'], '#ef6247', '#a13124'),
    ],
    # 파랑 파카
    'ash': [
        (['#ba8d5e', '#957350', '#8d7051', '#8a6552', '#6f5446'], '#9ed4f5', '#2b6398'),
        (['#ae4a52', '#a2394b', '#6f494d', '#5a444a'], '#4f9edb', '#1f4d7d'),
    ],
    # 민트 파카
    'lucy': [
        (['#cc9659', '#c2884b', '#b37b3f', '#af723b', '#ab6736', '#774934'], '#b3f4de', '#227f66'),
        (['#d0be9c', '#bfa690'], '#5fd3b2', '#2a9179'),
    ],
    # 펭귄: 검은 머리와 어깨, 흰 얼굴과 배, 주황 부리
    'nancy': [
        (['#866150', '#835b4c', '#805449', '#7b5147', '#724a40', '#644942'], '#3f4756', '#0f131b'),
        # the upper body is the back, the lower is the belly - so they split
        (['#565972'], '#1a1f2b', '#1a1f2b'),
        (['#6c6e85'], '#f4f9fd', '#f4f9fd'),
        (['#ffcbb0', '#f6ae9f', '#d3a38d', '#f2b899'], '#ffffff', '#d3e0ea'),
        (['#e07070', '#ffa0a0'], '#ffab3a', '#ef8712'),
    ],
}

for name, parts in OUTFITS.items():
    mapping = {}
    for source_hexes, light, dark in parts:
        mapping.update(build(source_hexes, light, dark))

    for src, out in [
        (SRC / f'{name}.png', SRC / f'{name}_polar.png'),
        (LOGIN / f'{name.capitalize()}_login.png', LOGIN / f'{name.capitalize()}_login_polar.png'),
    ]:
        im = Image.open(src).convert('RGBA')
        px = im.load()
        changed = 0
        untouched = set()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                mapped = mapping.get((r, g, b))
                if mapped:
                    px[x, y] = (*mapped, a)
                    changed += 1
                else:
                    untouched.add((r, g, b))

        im.save(out)
        print(f'{out.name}: {changed}px recoloured, {len(untouched)} colours left as-is')
