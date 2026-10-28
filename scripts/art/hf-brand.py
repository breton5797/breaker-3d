"""Build the app icon, splash and title banner from the Higgsfield emblem and key art.

usage: python3 scripts/art/hf-brand.py <emblem.png> <keyart.png>

Writes (relative to the repo root):
  assets/icon-only.png, icon-foreground.png, icon-background.png  (1024, for capacitor-assets)
  assets/splash.png, splash-dark.png                               (2732)
  public/icon-180.png, icon-192.png, icon-512.png                  (web / PWA)
  public/art/ui/title.webp                                         (title-screen banner)
The share image (public/og-image.jpg) is shot from scripts/art/og.html in a browser.
"""
import importlib.util
import sys
from pathlib import Path

from PIL import Image, ImageDraw

BG = (6, 8, 15)  # matches --iconBackgroundColor / splash background in package.json
BG_TOP = (28, 34, 72)  # lighter navy at the top of the icon, a flat lit-from-above look (no glow)
ICON_SHARE = 0.80  # emblem size on the full-bleed icon
FOREGROUND_SHARE = 0.60  # Android adaptive icons crop to the inner ~66%
SPLASH_SHARE = 0.22
BANNER_W = 1280

spec = importlib.util.spec_from_file_location('hf_process', Path(__file__).with_name('hf-process.py'))
hf_process = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hf_process)


def gradient(size: int) -> Image.Image:
    """Vertical navy gradient, lighter at the top."""
    img = Image.new('RGBA', (size, size))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        draw.line([(0, y), (size, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG)) + (255,))
    return img


def fitted(emblem: Image.Image, side: int, share: float) -> Image.Image:
    """The emblem centred on a transparent square of `side`, its longer edge `share` of it."""
    box = emblem.getchannel('A').getbbox()
    obj = emblem.crop(box)
    scale = side * share / max(obj.size)
    obj = obj.resize((round(obj.width * scale), round(obj.height * scale)), Image.LANCZOS)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(obj, ((side - obj.width) // 2, (side - obj.height) // 2))
    return canvas


def main() -> None:
    emblem = hf_process.solid(Image.open(sys.argv[1]))
    keyart = Image.open(sys.argv[2]).convert('RGB')
    assets, public = Path('assets'), Path('public')

    icon = gradient(1024)
    icon.alpha_composite(fitted(emblem, 1024, ICON_SHARE))
    icon.save(assets / 'icon-only.png')
    gradient(1024).save(assets / 'icon-background.png')
    fitted(emblem, 1024, FOREGROUND_SHARE).save(assets / 'icon-foreground.png')
    for size in (180, 192, 512):
        icon.convert('RGB').resize((size, size), Image.LANCZOS).save(public / f'icon-{size}.png', optimize=True)

    splash = Image.new('RGBA', (2732, 2732), BG + (255,))
    splash.alpha_composite(fitted(emblem, 2732, SPLASH_SHARE))
    splash.save(assets / 'splash.png', optimize=True)
    splash.save(assets / 'splash-dark.png', optimize=True)

    banner = keyart.resize((BANNER_W, round(keyart.height * BANNER_W / keyart.width)), Image.LANCZOS)
    banner.save(public / 'art/ui/title.webp', 'WEBP', quality=78, method=6)
    for path in ['assets/icon-only.png', 'assets/splash.png', 'public/icon-512.png', 'public/art/ui/title.webp']:
        print(path, Path(path).stat().st_size)


if __name__ == '__main__':
    main()
