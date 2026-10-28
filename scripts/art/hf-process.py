"""Turn Higgsfield cut-outs into small UI icons.

usage: python3 scripts/art/hf-process.py <raw_dir> <out_dir> [sheet.png] [size]

Crops each transparent PNG to its object, centres it in a square with a little
margin, scales to SIZE px (or [size]: boss portraits use 320) and saves an alpha WebP. Faint alpha is
ramped away first (see solid) so a soft cast-shadow halo never shows as glow.
Optionally writes a contact sheet on a dark background for a quick visual check.
"""
import sys
from pathlib import Path

from PIL import Image

SIZE = 128
MARGIN = 0.06  # share of the side left empty around the object
ALPHA_LO, ALPHA_HI = 96, 160  # alpha below LO is halo, above HI is the object; ramp between
QUALITY = 86


def solid(im: Image.Image) -> Image.Image:
    """The picture with its faint shadow haze removed and a short anti-aliased edge kept."""
    out = im.convert('RGBA')
    ramp = lambda a: max(0, min(255, round((a - ALPHA_LO) * 255 / (ALPHA_HI - ALPHA_LO))))
    out.putalpha(out.getchannel('A').point(ramp))
    return out


def to_icon(src: Path, size: int = SIZE) -> Image.Image:
    im = solid(Image.open(src))
    alpha = im.getchannel('A')
    box = alpha.getbbox()
    if box is None:
        raise ValueError(f'{src.name}: empty picture')
    obj = im.crop(box)
    side = round(max(obj.size) / (1 - 2 * MARGIN))
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.alpha_composite(obj, ((side - obj.width) // 2, (side - obj.height) // 2))
    return square.resize((size, size), Image.LANCZOS)


def main() -> None:
    raw, out = Path(sys.argv[1]), Path(sys.argv[2])
    sheet_path = Path(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] != '-' else None
    size = int(sys.argv[4]) if len(sys.argv) > 4 else SIZE
    out.mkdir(parents=True, exist_ok=True)
    icons = []
    for src in sorted(raw.glob('*.png')):
        icon = to_icon(src, size)
        dest = out / f'{src.stem}.webp'
        icon.save(dest, 'WEBP', quality=QUALITY, method=6)
        icons.append(icon)
        print(f'{dest.name}: {dest.stat().st_size} B')
    if sheet_path and icons:
        cols = 10
        rows = (len(icons) + cols - 1) // cols
        thumb = [icon.resize((SIZE, SIZE), Image.LANCZOS) for icon in icons]
        sheet = Image.new('RGBA', (cols * SIZE, rows * SIZE), (28, 32, 58, 255))
        for i, icon in enumerate(thumb):
            sheet.alpha_composite(icon, ((i % cols) * SIZE, (i // cols) * SIZE))
        sheet.save(sheet_path)


if __name__ == '__main__':
    main()
