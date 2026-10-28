"""Re-save native splash PNGs as 256-colour palette PNGs (flat navy + small emblem barely changes).

usage: python3 scripts/art/shrink-splash.py   (after `npm run app:assets`)
"""
from pathlib import Path

from PIL import Image

PATTERNS = ['ios/App/App/Assets.xcassets/Splash.imageset/*.png', 'android/app/src/main/res/drawable*/splash.png']


def main() -> None:
    before = after = 0
    for pattern in PATTERNS:
        for path in Path('.').glob(pattern):
            before += path.stat().st_size
            img = Image.open(path).convert('RGB')
            img.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)
            after += path.stat().st_size
    print(f'splash PNGs: {before} -> {after} bytes')


if __name__ == '__main__':
    main()
