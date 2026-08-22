"""
Recolour the office tilesets and furniture into an iced-over version.

Unlike the character sheets these have hundreds of colours, so remapping ramp by
ramp is not practical. Instead each pixel is pushed toward the polar palette in
HLS: hue is pulled to ice-blue, saturation is cut, and lightness is lifted so
the room reads as snow-lit rather than office-lit.

Two things are spared. Greenery, because plants are the one thing in the room
that reads as alive rather than as furniture. And vivid warm accents - a red
mug, a lamp, the vending machine's front - because a room of nothing but ice
reads as empty rather than as cold.

The split is by saturation, not by hue alone. Big surfaces (wood floors, ochre
carpet, tan desks) are muted browns and go to ice; the things that stay warm are
the small, saturated props, which is exactly where warmth belongs - as points
you notice, not as half the map.

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
    # the furniture is not part of the tilesets - chairs in particular stayed
    # office-orange while everything around them had already iced over
    ('client/public/assets/items/chair.png', 'chair_polar.png'),
    ('client/public/assets/items/computer.png', 'computer_polar.png'),
    ('client/public/assets/items/whiteboard.png', 'whiteboard_polar.png'),
    ('client/public/assets/items/vendingmachine.png', 'vendingmachine_polar.png'),
]

ICE_HUE = 0.55  # cyan-blue

# hues that count as greenery and keep their colour
GREEN_RANGE = (0.22, 0.45)
# reds through ambers - warm enough to be an accent if it is vivid enough
WARM_MAX_HUE = 0.13
# below this a warm colour is just wood or carpet, not an accent
ACCENT_SATURATION = 0.45


def is_greenery(h, s):
    return GREEN_RANGE[0] < h < GREEN_RANGE[1] and s > 0.18


def is_warm_accent(h, s):
    return (h <= WARM_MAX_HUE or h >= 0.95) and s >= ACCENT_SATURATION


def polarize(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)

    if is_greenery(h, s):
        # plants: cool them a little so they sit in the same light as the ice
        s *= 0.8
        l = min(1.0, l * 1.02)
    elif is_warm_accent(h, s):
        # let the accents glow a touch, so they carry against all that blue
        s = min(1.0, s * 1.05)
        l = min(1.0, l * 1.04)
    else:
        # everything else - including every brown and ochre - drifts toward ice
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
