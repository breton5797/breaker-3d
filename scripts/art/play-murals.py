"""Build the 놀이 세계 murals (numbers, letters, Hangul, animals) as coarse brick grids.

usage: python3 -I scripts/art/play-murals.py <sprite_dir> <font.otf> > src/sim/landmarks/playData.js

Murals are 48 x 44 coarse cells (see mapkit.js). Letters c-h are the map's
palette colours, '.' is open. Animals come from the Higgsfield pixel-art
sprites (transparent background), cut out, scaled to fit and reduced to six
colours. Glyphs are drawn with Pretendard Black (SIL OFL, the game's own UI
font): an outline and three colour bands inside. Like a pixel mosaic, every
mural fills the whole box with bricks: a soft two-tone checker behind the
picture (sky tones a/b for animals, whose scene shows through as it breaks).
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 48, 44
FLOOR = 37  # last row used: the rows below become the lobby along the box floor
TOP = 1
SKY = ['#8fd3ff', '#d4f0ff']

ANIMALS = ['cat', 'dog', 'rabbit', 'panda', 'penguin', 'lion']
GLYPHS = [
    # id, text, palette c..h: c/d backdrop checker, e/f/g bands top to bottom, h outline
    ('num1', '1', ['#ffd6e0', '#ffe9b8', '#ff6b8a', '#ff4d6d', '#d6336c', '#5c1033']),
    ('num2', '2', ['#d0f4de', '#fcf6bd', '#4cc9f0', '#4895ef', '#4361ee', '#1d2a6b']),
    ('num3', '3', ['#ffe5b4', '#e2ece9', '#ffb703', '#fb8500', '#e85d04', '#5a2a00']),
    ('num7', '7', ['#e4c1f9', '#d0f4de', '#90be6d', '#43aa8b', '#2d6a4f', '#173b2a']),
    ('num8', '8', ['#fde2e4', '#cddafd', '#c77dff', '#9d4edd', '#7b2cbf', '#2c0f4a']),
    ('num10', '10', ['#fff1c1', '#d7f9f1', '#ff595e', '#ffca3a', '#1982c4', '#202040']),
    ('alphaA', 'A', ['#caf0f8', '#ffe5ec', '#ff006e', '#fb5607', '#ffbe0b', '#3a0a1f']),
    ('alphaB', 'B', ['#e9f5db', '#fef9ef', '#3a86ff', '#8338ec', '#5a189a', '#14082e']),
    ('alphaC', 'C', ['#fdf0d5', '#e0fbfc', '#06d6a0', '#118ab2', '#073b4c', '#021a22']),
    ('alphaK', 'K', ['#ffeedd', '#e8f1ff', '#ef476f', '#ffd166', '#26547c', '#101a2b']),
    ('alphaR', 'R', ['#f1faee', '#ffe8d6', '#e63946', '#f4a261', '#2a9d8f', '#1d3557']),
    ('alphaZ', 'Z', ['#e2eafc', '#fff3b0', '#9b5de5', '#f15bb5', '#fee440', '#25103d']),
    ('hangulGa', '가', ['#fff0f3', '#e0f7fa', '#ff8fab', '#fb6f92', '#c9184a', '#4a0418']),
    ('hangulNa', '나', ['#f0fff1', '#fff8e1', '#80ed99', '#57cc99', '#38a3a5', '#123c3d']),
    ('hangulDa', '다', ['#fff4e6', '#eef4ff', '#ffbe76', '#f0932b', '#eb4d4b', '#4a1414']),
    ('hangulGong', '공', ['#f3e8ff', '#e6fffa', '#a0c4ff', '#bdb2ff', '#7b61ff', '#221a5c']),
    ('hangulByeol', '별', ['#1b1f3b', '#2a2f5a', '#fff3b0', '#ffd166', '#f4a300', '#3b2a00']),
    ('hangulKkum', '꿈', ['#fde4ff', '#e4f0ff', '#cdb4db', '#ffafcc', '#a2d2ff', '#2b2d42']),
]
LETTERS = 'cdefgh'


def empty():
    return [['.'] * W for _ in range(H)]


def fit_box(w, h, max_w, max_h):
    s = min(max_w / w, max_h / h)
    return max(1, round(w * s)), max(1, round(h * s))


def animal(path: Path):
    im = Image.open(path).convert('RGBA')
    alpha = im.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    box = alpha.getbbox()
    im = im.crop(box)
    alpha = alpha.crop(box)
    w, h = fit_box(im.width, im.height, W - 4, FLOOR - TOP)
    # Box-filter the colours, keep a cell if at least half of it is animal.
    small = im.convert('RGB').resize((w, h), Image.BOX)
    cover = alpha.resize((w, h), Image.BOX)
    quant = small.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
    pal = quant.getpalette()[:18]
    colours = [tuple(pal[i * 3:i * 3 + 3]) for i in range(6)]
    # Darkest colour first, so 'c' is the outline and 'h' the brightest.
    order = sorted(range(6), key=lambda i: sum(colours[i]))
    letter = {old: LETTERS[k] for k, old in enumerate(order)}
    g = empty()
    x0 = (W - w) // 2
    y0 = FLOOR - h + 1
    for y in range(h):
        for x in range(w):
            if cover.getpixel((x, y)) >= 128:
                g[y0 + y][x0 + x] = letter[quant.getpixel((x, y))]
    backdrop(g, 'ab')
    palette = SKY + ['#%02x%02x%02x' % colours[i] for i in order]
    return g, palette


def backdrop(g, tones):
    """Fills every open cell down to FLOOR with a two-tone checker of bricks (a full mosaic)."""
    for y in range(FLOOR + 1):
        for x in range(W):
            if g[y][x] == '.':
                g[y][x] = tones[(x + y) % 2]


def glyph_mask(text: str, font_path: str):
    scale = 12
    big = Image.new('L', (W * scale, H * scale), 0)
    draw = ImageDraw.Draw(big)
    max_w, max_h = (W - 6) * scale, (FLOOR - TOP - 1) * scale
    size = max_h * 2
    while True:
        font = ImageFont.truetype(font_path, size)
        l, t, r, b = draw.textbbox((0, 0), text, font=font)
        if r - l <= max_w and b - t <= max_h:
            break
        size = int(size * 0.95)
    x = (W * scale - (r - l)) // 2 - l
    y = (TOP + 1) * scale + (max_h - (b - t)) // 2 - t
    draw.text((x, y), text, font=font, fill=255)
    small = big.resize((W, H), Image.BOX)
    return [[small.getpixel((xx, yy)) >= 110 for xx in range(W)] for yy in range(H)]


def glyph(text: str, font_path: str):
    m = glyph_mask(text, font_path)
    rows = [y for y in range(H) if any(m[y])]
    top, bottom = rows[0], rows[-1]
    g = empty()
    for y in range(H):
        for x in range(W):
            if m[y][x]:
                edge = any(not (0 <= x + dx < W and 0 <= y + dy < H and m[y + dy][x + dx]) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                band = min(2, 3 * (y - top) // max(1, bottom - top + 1))
                g[y][x] = 'h' if edge else 'efg'[band]
    backdrop(g, 'cd')
    return g


def main() -> None:
    sprites, font = Path(sys.argv[1]), sys.argv[2]
    art = {}
    for name in ANIMALS:
        g, palette = animal(sprites / f'{name}.png')
        art[name] = {'rows': [''.join(r) for r in g], 'palette': palette}
    for gid, text, colours in GLYPHS:
        art[gid] = {'rows': [''.join(r) for r in glyph(text, font)], 'palette': SKY + colours}
    print('// Generated by scripts/art/play-murals.py (Higgsfield pixel-art animals; glyphs in Pretendard Black, SIL OFL).')
    print('// Do not edit by hand: re-run the script. rows: 48 x 44 coarse cells; palette a-h.')
    print('export const PLAY_ART = Object.freeze(' + json.dumps(art, ensure_ascii=False, indent=1) + ');')


if __name__ == '__main__':
    main()
