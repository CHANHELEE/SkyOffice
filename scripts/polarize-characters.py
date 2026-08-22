"""
Dress the SkyOffice characters for the Arctic.

Two passes over each sheet:

1. Ramp swap. The sprites use tiny palettes (22-25 colours) and each body part
   is a short ramp of shades, so nothing is repainted - each ramp is mapped onto
   a new one, brightest to brightest. Shading and outlines survive untouched.

2. Overlays. A ramp swap cannot add a scarf, so the second pass finds the face
   in every frame by looking for skin pixels and paints onto it: the lower part
   becomes a scarf pulled up over the mouth (a beak, for the penguin), the brow
   becomes goggles, and the outer edge of the hood gets a fur trim. Frames are
   handled one at a time because the head bobs as the character walks.

Run from the repo root:  python3 scripts/polarize-characters.py
"""
from PIL import Image
import pathlib

SRC = pathlib.Path('client/public/assets/character')
# the login screen shows a bigger portrait drawn from the same palette
LOGIN = pathlib.Path('client/src/images/login')

FRAME_W, FRAME_H = 32, 48

# shared across every sheet
SKIN = ['#ffcbb0', '#f6ae9f', '#ffb893', '#f69784', '#e19b9b', '#d3a38d', '#f2b899']
OUTLINE = {(0x3a, 0x3a, 0x50), (0x46, 0x46, 0x5e)}
NEIGHBOURS_8 = [(dx, dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx, dy) != (0, 0)]


def lum(c):
    r, g, b = c
    return 0.299 * r + 0.587 * g + 0.114 * b


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ramp(light, dark, steps):
    a, b = rgb(light), rgb(dark)
    if steps == 1:
        return [a]
    return [
        tuple(round(a[j] + (b[j] - a[j]) * i / (steps - 1)) for j in range(3))
        for i in range(steps)
    ]


def build(source_hexes, light, dark):
    src = sorted((rgb(h) for h in source_hexes), key=lum, reverse=True)
    return dict(zip(src, ramp(light, dark, len(src))))


OUTFITS = {
    # White expedition gear, the way people actually dress for the pole. The
    # scarf carries the colour, because at 32px a white hood on a white parka is
    # the only thing four people could not be told apart by.
    # 이누이트 남성: 카리부 가죽 파카. 굵은 퍼 러프로 얼굴을 감싼다
    'adam': {
        'parts': [
            # hood
            (['#bba386', '#959d58', '#687253', '#5f694a', '#5d6043'], '#c9b08c', '#6f5a42'),
            # parka body, kept a shade darker than the hood so the two separate
            (['#9f74a8', '#805e8e'], '#8a5836', '#48291a'),
        ],
        'fur': '#fdf6e8',
        # the ruff on a real parka stands proud of the face, so it gets two rings
        'fur_rings': 2,
    },
    'ash': {
        'parts': [
            (['#ba8d5e', '#957350', '#8d7051', '#8a6552', '#6f5446'], '#f7fbff', '#aebfd1'),
            (['#ae4a52', '#a2394b', '#6f494d', '#5a444a'], '#e2e7ee', '#9aa5b3'),
        ],
        'scarf': ('#63b4ee', '#255f92'),
        'fur': '#8ecdf5',
    },
    # 이누이트 여성: 아마우티. 남성과 갈라놓는 건 땋은 머리와 붉은 장식띠다
    'lucy': {
        'parts': [
            (['#cc9659', '#c2884b', '#b37b3f', '#af723b', '#ab6736', '#774934'], '#f2e0c6', '#a98a68'),
            (['#d0be9c', '#bfa690'], '#c98a5c', '#7d5236'),
        ],
        'fur': '#fffaf0',
        'fur_rings': 2,
        'braids': ('#4a3226', '#241812'),
        'band': ('#e8785f', '#b83c38'),
    },
    # 뽀로로풍 펭귄: 파란 조종모, 고글, 주황 부리
    'nancy': {
        'parts': [
            (['#866150', '#835b4c', '#805449', '#7b5147', '#724a40', '#644942'], '#6fc0ef', '#1d5f9c'),
            (['#565972'], '#1c2230', '#1c2230'),
            (['#6c6e85'], '#f4f9fd', '#f4f9fd'),
            (SKIN, '#ffffff', '#d3e0ea'),
            # cheeks join the white face; the beak is painted on in pass 2
            (['#e07070', '#ffa0a0'], '#f2f8fc', '#dfeaf2'),
        ],
        'beak': ('#ffb750', '#ef8a13'),
        'goggles': ('#f6d76b', '#8a6a1f'),
    },
}


def region(px, ox, oy, w, h, wanted):
    return [
        (x, y)
        for y in range(h)
        for x in range(w)
        if px[ox + x, oy + y][3] and px[ox + x, oy + y][:3] in wanted
    ]


def paint_frame(px, ox, oy, w, h, spec, face):
    """
    Add what a ramp swap cannot.

    An earlier version also outlined the hood in cream as "fur", but tracing the
    whole silhouette just produced a halo, so that is gone. What is left sits
    where real winter gear sits: a scarf round the neck, and on the penguin a
    beak in the middle of the face with goggles across the brow.

    `face` is collected before the ramp swap runs - the penguin's skin becomes
    white, so afterwards there is no skin colour left to search for.
    """
    if not face:
        return

    ys = [y for _, y in face]
    xs = [x for x, _ in face]
    top, bottom = min(ys), max(ys)
    height = bottom - top + 1
    centre = (min(xs) + max(xs)) / 2

    # a beak, or a scarf pulled up over the chin - just the middle of the face,
    # so it does not read as a band across the eyes
    beak = spec.get('beak')
    if beak and height >= 5:
        light, dark = rgb(beak[0]), rgb(beak[1])
        for x, y in face:
            if y >= top + round(height * 0.55) and abs(x - centre) <= 2.5:
                px[ox + x, oy + y] = (*(dark if y >= bottom else light), 255)

    # goggles resting on the brow
    goggles = spec.get('goggles')
    if goggles and height >= 6:
        light, dark = rgb(goggles[0]), rgb(goggles[1])
        for x, y in face:
            if y <= top + 1:
                px[ox + x, oy + y] = (*(light if y == top else dark), 255)

    # fur trim: hood pixels that touch the face. an earlier version traced the
    # whole silhouette and the halo read as a sticker edge - real trim only runs
    # round the opening.
    fur = spec.get('fur')
    if fur:
        trim = rgb(fur)
        hood = spec['_hood']
        # a ruff can be more than one pixel thick - grow the ring outward, and
        # each ring only ever eats hood pixels so the silhouette is untouched
        inner = set(face)
        for _ in range(spec.get('fur_rings', 1)):
            ring = set()
            for x, y in inner:
                for dx, dy in NEIGHBOURS_8:
                    nx, ny = x + dx, y + dy
                    if not (0 <= nx < w and 0 <= ny < h) or (nx, ny) in inner:
                        continue
                    r, g, b, a = px[ox + nx, oy + ny]
                    if a and (r, g, b) in hood:
                        px[ox + nx, oy + ny] = (*trim, 255)
                        ring.add((nx, ny))
            if not ring:
                break
            inner |= ring

    # two braids falling out of the hood onto the shoulders. At this size they
    # are the clearest thing separating her from him, so they hang below the
    # ruff where nothing else competes for the pixels.
    braids = spec.get('braids')
    if braids and height >= 6:
        light, dark = rgb(braids[0]), rgb(braids[1])
        left, right = min(xs), max(xs)
        for row, y in enumerate(range(bottom, min(bottom + 4, h))):
            for x in (left - 1, right + 1):
                if not (0 <= x < w):
                    continue
                r, g, b, a = px[ox + x, oy + y]
                if not a or (r, g, b) in OUTLINE:
                    continue
                px[ox + x, oy + y] = (*(light if row == 0 else dark), 255)

    # beaded trim across the chest of the amauti
    band = spec.get('band')
    if band:
        light, dark = rgb(band[0]), rgb(band[1])
        y = min(bottom + 3, h - 1)
        for x in range(w):
            r, g, b, a = px[ox + x, oy + y]
            if not a or (r, g, b) in OUTLINE:
                continue
            px[ox + x, oy + y] = (*(light if x % 2 else dark), 255)

    # the scarf goes round the neck: the first rows of body under the chin
    scarf = spec.get('scarf')
    if scarf:
        light, dark = rgb(scarf[0]), rgb(scarf[1])
        rows = range(bottom + 1, min(bottom + 5, h))
        for y in rows:
            for x in range(w):
                r, g, b, a = px[ox + x, oy + y]
                if not a or (r, g, b) in OUTLINE:
                    continue
                px[ox + x, oy + y] = (*(light if y == bottom + 1 else dark), 255)


for name, spec in OUTFITS.items():
    mapping = {}
    for source_hexes, light, dark in spec['parts']:
        mapping.update(build(source_hexes, light, dark))

    # what the hood ramp became, so the fur trim can find its edge
    spec['_hood'] = {
        mapping[c] for c in (rgb(h) for h in spec['parts'][0][0]) if c in mapping
    }
    skin_rgb = {rgb(h) for h in SKIN}

    for src, out, framed in [
        (SRC / f'{name}.png', SRC / f'{name}_polar.png', True),
        (LOGIN / f'{name.capitalize()}_login.png',
         LOGIN / f'{name.capitalize()}_login_polar.png', False),
    ]:
        im = Image.open(src).convert('RGBA')
        px = im.load()

        # the login portrait is one big frame; the sheet is many
        frames = (
            [(f * FRAME_W, 0, FRAME_W, FRAME_H) for f in range(im.width // FRAME_W)]
            if framed
            else [(0, 0, im.width, im.height)]
        )

        # find the faces first. the hands are skin too and hang by the waist, so
        # only the top two thirds counts as head - otherwise the scarf ends up
        # round the character's middle.
        faces = []
        for ox, oy, w, h in frames:
            head_zone = round(h * 0.62)
            faces.append([p for p in region(px, ox, oy, w, h, skin_rgb) if p[1] < head_zone])

        # pass 1 - ramp swap
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                mapped = mapping.get((r, g, b))
                if mapped:
                    px[x, y] = (*mapped, a)

        # pass 2 - overlays
        for (ox, oy, w, h), face in zip(frames, faces):
            paint_frame(px, ox, oy, w, h, spec, face)

        im.save(out)
        print(f'{out.name}: done')
