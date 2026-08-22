"""
Draw the campfire and the cushions that replace the meeting table.

There is no fire or floor-cushion art anywhere in the repo, so these are
authored here pixel by pixel. Both are small and chunky on purpose: they have to
sit next to the office tileset without looking like they came from a different
game.

The fire is four frames of flicker - the logs never move, only the flame does,
which is what keeps it from looking like the whole sprite is vibrating.

Run from the repo root:  python3 scripts/make-campfire.py
"""
from PIL import Image
import pathlib

OUT = pathlib.Path('client/public/assets/items')
TILE = 32

# fire, hottest at the core
FLAME_CORE = (255, 244, 214)
FLAME_MID = (255, 196, 74)
FLAME_EDGE = (240, 126, 42)
FLAME_DEEP = (203, 76, 32)
LOG = (122, 92, 74)
LOG_DARK = (86, 62, 50)
EMBER = (255, 148, 60)
OUTLINE = (58, 58, 80)


def put(px, x, y, colour):
    if 0 <= x < TILE and 0 <= y < TILE:
        px[x, y] = (*colour, 255)


def rect(px, x0, y0, x1, y1, colour):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(px, x, y, colour)


def draw_logs(px):
    # two logs crossed, seen from slightly above
    rect(px, 7, 24, 24, 26, LOG)
    rect(px, 7, 26, 24, 27, LOG_DARK)
    rect(px, 9, 21, 22, 23, LOG)
    rect(px, 9, 23, 22, 24, LOG_DARK)
    # ends catch the light
    rect(px, 7, 24, 8, 25, (150, 116, 94))
    rect(px, 23, 24, 24, 25, (150, 116, 94))
    # outline along the bottom so the logs sit on the floor
    rect(px, 6, 28, 25, 28, OUTLINE)
    # embers glowing between them
    for x, y in ((11, 23), (15, 22), (19, 23), (13, 25), (18, 25)):
        put(px, x, y, EMBER)


# each frame is a stack of (y, half-width) pairs - the flame silhouette
FLAMES = [
    [(20, 6), (18, 6), (16, 5), (14, 5), (12, 4), (10, 3), (8, 2), (7, 1)],
    [(20, 6), (18, 6), (16, 6), (14, 4), (12, 4), (10, 3), (9, 2)],
    [(20, 7), (18, 6), (16, 5), (14, 5), (12, 3), (11, 2)],
    [(20, 6), (18, 5), (16, 5), (14, 4), (12, 3), (10, 2), (8, 1)],
]


def draw_flame(px, shape, lean):
    for y, half in shape:
        # the flame leans a little differently each frame
        cx = 16 + round(lean * (20 - y) / 12)
        for x in range(cx - half, cx + half + 1):
            depth = abs(x - cx) / max(half, 1)
            if depth > 0.75:
                colour = FLAME_DEEP
            elif depth > 0.45:
                colour = FLAME_EDGE
            elif y > 14:
                colour = FLAME_MID
            else:
                colour = FLAME_CORE if y < 12 else FLAME_MID
            put(px, x, y, colour)
            put(px, x, y + 1, colour)


frames = len(FLAMES)
fire = Image.new('RGBA', (TILE * frames, TILE), (0, 0, 0, 0))
for i, shape in enumerate(FLAMES):
    cell = Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0))
    px = cell.load()
    draw_flame(px, shape, lean=(-1, 0, 1, 0)[i])
    draw_logs(px)
    fire.paste(cell, (i * TILE, 0))
fire.save(OUT / 'campfire.png')
print(f'campfire.png: {frames} frames')

# cushions, all in the same ice tone - they are seating, not decoration, and
# four different colours round one fire pulled the eye away from it
CUSHIONS = [((198, 226, 243), (140, 182, 212))]
pad = Image.new('RGBA', (TILE * len(CUSHIONS), TILE), (0, 0, 0, 0))
for i, (light, dark) in enumerate(CUSHIONS):
    cell = Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0))
    px = cell.load()
    # a squat pad with the corners knocked off
    rect(px, 6, 14, 25, 25, light)
    rect(px, 5, 16, 26, 23, light)
    rect(px, 6, 22, 25, 25, dark)
    for x, y in ((6, 14), (25, 14), (6, 25), (25, 25)):
        put(px, x, y, (0, 0, 0, 0)[:3] if False else dark)
    # outline
    rect(px, 6, 13, 25, 13, OUTLINE)
    rect(px, 6, 26, 25, 26, OUTLINE)
    rect(px, 4, 16, 4, 23, OUTLINE)
    rect(px, 27, 16, 27, 23, OUTLINE)
    for y in (14, 15, 24, 25):
        put(px, 5, y, OUTLINE)
        put(px, 26, y, OUTLINE)
    # a dimple in the middle, the way a floor cushion sags
    rect(px, 13, 18, 18, 19, dark)
    pad.paste(cell, (i * TILE, 0))
pad.save(OUT / 'cushion.png')
print(f'cushion.png: {len(CUSHIONS)} colours')
