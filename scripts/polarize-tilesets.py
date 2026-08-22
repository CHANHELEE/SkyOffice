"""
Recolour the office tilesets into an iced-over version.

Unlike the character sheets these have hundreds of colours, so remapping ramp by
ramp is not practical. Instead each pixel is pushed toward the polar palette in
HLS: hue is pulled to ice-blue, saturation is cut, and lightness is lifted so
the room reads as snow-lit rather than office-lit. Warm woods and plants are
left alone - a room with nothing warm in it looks dead.

Run from the repo root:  python3 scripts/polarize-tilesets.py
"""
from PIL import Image
import colorsys
import pathlib

TARGETS = [
    ('client/public/assets/tileset/Modern_Office_Black_Shadow.png', 'Modern_Office_Black_Shadow_polar.png'),
    ('client/public/assets/tileset/Generic.png', 'Generic_polar.png'),
    ('client/public/assets/tileset/Basement.png', 'Basement_polar.png'),
    ('client/public/assets/map/FloorAndGround.png', 'FloorAndGround_polar.png'),
]

ICE_HUE = 0.55  # cyan-blue

def polarize(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)

    # leave the warm things warm: wood, plants, skin-ish props
    warm = 0.02 < h < 0.42
    if warm and s > 0.18:
        # only cool them slightly so they still read as themselves
        s *= 0.72
        l = min(1.0, l * 1.05)
    else:
        # everything else drifts toward ice
        h = ICE_HUE
        s = min(0.45, s * 0.6 + 0.12)
        l = min(1.0, l * 0.82 + 0.2)

    nr, ng, nb = colorsys.hls_to_rgb(h, l, s)
    return round(nr * 255), round(ng * 255), round(nb * 255)

for src, out_name in TARGETS:
    path = pathlib.Path(src)
    im = Image.open(path).convert('RGBA')
    px = im.load()

    cache = {}
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            key = (r, g, b)
            if key not in cache:
                cache[key] = polarize(r, g, b)
            px[x, y] = (*cache[key], a)

    out = path.parent / out_name
    im.save(out)
    print(f'{path.name}: {len(cache)} colours -> {out.name}')
