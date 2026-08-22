"""
Draw the campfire and the cushions that replace the meeting table.

There is no fire or floor-cushion art in the repo, so both are authored here.

The fire is drawn at 64px rather than 32. The first version was a 32px sprite
scaled up 2.6x, which is the one thing you cannot do to pixel art - every pixel
became a smeared 2.6px block. At native size the detail is real: logs stacked on
the floor and a flame built from four nested layers, so it has a hot core rather
than a flat orange silhouette.

There is no ring of stones. A drawn circle of them looked placed rather than
built - a border someone had arranged. What is there instead is snow banked up
where the heat has pushed it back, which is what the floor round a fire actually
looks like and needs no explanation.

Six frames of flicker, and only the flame moves. Animating the logs too made the
whole sprite look like it was vibrating.

Run from the repo root:  python3 scripts/make-campfire.py
"""
from PIL import Image
import math
import pathlib

OUT = pathlib.Path('client/public/assets/items')
FIRE = 64
FRAMES = 6

# the flame, coolest at the edge
FLAME = [
    ((214, 92, 34), 1.00, 1.00),   # outer
    ((247, 147, 44), 0.72, 0.88),
    ((255, 200, 78), 0.45, 0.70),
    ((255, 246, 214), 0.22, 0.46),  # core
]
LOG = (124, 94, 72)
LOG_TOP = (156, 122, 96)
LOG_DARK = (84, 62, 48)
EMBER = (255, 176, 84)
OUTLINE = (58, 58, 80)

BASE_Y = 40   # where the flame meets the logs
TIP_Y = 10
MAX_W = 11


def put(px, x, y, colour):
    if 0 <= x < FIRE and 0 <= y < FIRE:
        px[x, y] = (*colour, 255)


def rect(px, x0, y0, x1, y1, colour):
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            put(px, x, y, colour)


def ellipse(px, cx, cy, rx, ry, colour):
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                put(px, x, y, colour)


def draw_hearth(px):
    """snow pushed back by the heat, with the logs sitting in the clear patch"""
    # the melted-out hollow: darker where the floor is wet, pale at its rim
    ellipse(px, 32, 48, 26, 10, (188, 214, 233))
    ellipse(px, 32, 48, 23, 8.4, (206, 228, 243))
    ellipse(px, 32, 49, 17, 6, (170, 200, 222))

    # banked snow round the outside, uneven so it does not read as a border
    drifts = [
        (11, 47, 7, 4.2), (19, 52, 8, 4.0), (31, 55, 9, 3.6),
        (44, 52, 8, 4.0), (52, 47, 7, 4.2), (48, 42, 5.5, 3.2),
        (16, 42, 5.5, 3.2), (32, 40, 6, 2.6),
    ]
    for cx, cy, rx, ry in drifts:
        ellipse(px, cx, cy, rx, ry, (222, 238, 250))
        ellipse(px, cx, cy - 0.8, rx * 0.8, ry * 0.7, (243, 250, 255))

    # logs: two crossed, one leaning back
    rect(px, 17, 41, 47, 44, LOG)
    rect(px, 17, 40, 47, 41, LOG_TOP)
    rect(px, 17, 44, 47, 46, LOG_DARK)
    rect(px, 22, 36, 42, 39, LOG)
    rect(px, 22, 35, 42, 36, LOG_TOP)
    rect(px, 22, 39, 42, 41, LOG_DARK)
    # cut ends catch the light
    ellipse(px, 17, 42, 2.2, 2.6, LOG_TOP)
    ellipse(px, 47, 42, 2.2, 2.6, LOG_TOP)

    # embers glowing in the gaps
    for x, y in ((27, 39), (33, 38), (39, 39), (30, 42), (37, 42), (24, 41)):
        put(px, x, y, EMBER)


def flame_width(u, max_w, phase):
    """u runs 0 at the base to 1 at the tip - a teardrop, pinched at the bottom"""
    # rows are integers while the flame top is not, so u can overshoot 1 and turn
    # the fractional power complex
    u = min(max(u, 0.0), 1.0)
    # low exponents keep the sides bowed; a steep one gave a paper cone
    body = (1 - u) ** 0.34 * (1 - u ** 2.2)
    pinch = 0.68 + 0.32 * min(u / 0.16, 1)
    # the edge ripples as the flame climbs
    ripple = 1 + 0.16 * math.sin(u * 7.5 + phase * 2)
    return max_w * body * pinch * ripple


def draw_flame(px, phase):
    # the whole flame breathes, not just leans
    stretch = 1 + 0.12 * math.sin(phase * 2 + 0.7)
    for colour, width_scale, height_scale in FLAME:
        top = BASE_Y - (BASE_Y - TIP_Y) * height_scale * stretch
        for y in range(int(top), BASE_Y + 1):
            u = (BASE_Y - y) / (BASE_Y - top) if BASE_Y > top else 0
            half = flame_width(u, MAX_W * width_scale, phase)
            if half < 0.5:
                continue
            # the tip sways further than the base, the way a real flame does
            lean = 5.0 * (u ** 1.7) * math.sin(phase)
            cx = 32 + lean
            rect(px, round(cx - half), y, round(cx + half), y, colour)


def draw_sparks(px, phase):
    for i in range(4):
        t = (phase / (math.pi * 2) + i / 4) % 1
        y = int(TIP_Y - 2 - t * 8)
        x = int(32 + math.sin(phase * 1.6 + i * 2.1) * (3 + i))
        if y > 0:
            put(px, x, y, EMBER if i % 2 else (255, 214, 150))


sheet = Image.new('RGBA', (FIRE * FRAMES, FIRE), (0, 0, 0, 0))
for f in range(FRAMES):
    phase = math.pi * 2 * f / FRAMES
    cell = Image.new('RGBA', (FIRE, FIRE), (0, 0, 0, 0))
    px = cell.load()
    draw_sparks(px, phase)
    draw_flame(px, phase)
    draw_hearth(px)
    # the flame has to sit in front of the logs, so redraw its lower half
    draw_flame_front = Image.new('RGBA', (FIRE, FIRE), (0, 0, 0, 0))
    fp = draw_flame_front.load()
    draw_flame(fp, phase)
    cell.alpha_composite(draw_flame_front.crop((0, 0, FIRE, 39)), (0, 0))
    sheet.paste(cell, (f * FIRE, 0))
sheet.save(OUT / 'campfire.png')
print(f'campfire.png: {FRAMES} frames at {FIRE}px')

# cushions, all one ice tone - they are seating, not decoration
TILE = 32
LIGHT, DARK = (198, 226, 243), (140, 182, 212)
pad = Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0))
px = pad.load()
rect(px, 6, 14, 25, 25, LIGHT)
rect(px, 5, 16, 26, 23, LIGHT)
rect(px, 6, 22, 25, 25, DARK)
for x, y in ((6, 14), (25, 14), (6, 25), (25, 25)):
    put(px, x, y, DARK)
rect(px, 6, 13, 25, 13, OUTLINE)
rect(px, 6, 26, 25, 26, OUTLINE)
rect(px, 4, 16, 4, 23, OUTLINE)
rect(px, 27, 16, 27, 23, OUTLINE)
for y in (14, 15, 24, 25):
    put(px, 5, y, OUTLINE)
    put(px, 26, y, OUTLINE)
rect(px, 13, 18, 18, 19, DARK)
pad.save(OUT / 'cushion.png')
print('cushion.png: 1 colour')
