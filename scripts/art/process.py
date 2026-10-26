"""Turn raw FLUX renders into game assets.

Cut-outs (fruit, icons): key out the white background by flood-filling from the
border, feather the edge, crop to the object and fit a square PNG.
Textures: make them tile (half-offset cross-fade), resize, save JPG.
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

RAW = Path(sys.argv[1])
OUT = Path(sys.argv[2])

CUTOUTS = {
    'fruit/cherry.png': 'fruit_cherry',
    'fruit/strawberry.png': 'fruit_strawberry',
    'fruit/orange.png': 'fruit_orange',
    'fruit/apple.png': 'fruit_apple',
    'fruit/watermelon.png': 'fruit_watermelon',
    'fruit/pineapple.png': 'fruit_pineapple',
    'icon/bomb.png': 'icon_bomb',
    'icon/fire.png': 'icon_fire',
    'icon/star.png': 'icon_star',
}
# per-picture keying: tighter tol keeps pale rind; shadow = colour tolerance of a cast shadow to strip
CUT_OPTS = {'fruit/watermelon.png': {'tol': 12.0, 'close': 21}, 'icon/fire.png': {'shadow': 0.32}}
# name -> (raw, size, mode) ; mode 'grey' normalises to a light, low-contrast tint base
TEXTURES = {
    'tex/brick.jpg': ('tex_brick', 128, 'grey'),
    'tex/board.jpg': ('tex_board', 512, 'color'),
    'tex/concrete.jpg': ('tex_concrete', 512, 'color'),
    'tex/steel.jpg': ('tex_steel', 256, 'color'),
    'skin/colossus.jpg': ('skin_colossus', 256, 'color'),
    'skin/kraken.jpg': ('skin_kraken', 256, 'color'),
    'skin/golem.jpg': ('skin_golem', 256, 'color'),
    'skin/mothership.jpg': ('skin_mothership', 256, 'color'),
}


def background_mask(rgb: np.ndarray, tol: float = 34.0) -> np.ndarray:
    """True where the pixel is near-white AND connected to the border."""
    h, w, _ = rgb.shape
    dist = np.sqrt(((255.0 - rgb.astype(np.float32)) ** 2).sum(axis=2))
    near = dist < tol
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


def enclosed_white(rgb: np.ndarray, tol: float = 22.0, min_area: int = 1500) -> np.ndarray:
    """Large pure-white pockets the border flood can't reach (e.g. between cherry stems)."""
    from scipy import ndimage
    dist = np.sqrt(((255.0 - rgb.astype(np.float32)) ** 2).sum(axis=2))
    labels, n = ndimage.label(dist < tol)
    if n == 0:
        return np.zeros(dist.shape, bool)
    areas = ndimage.sum(np.ones_like(dist), labels, index=np.arange(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = areas >= min_area
    return keep[labels]


def shadow_mask(rgb: np.ndarray, chroma: float = 0.06) -> np.ndarray:
    """Pale, colourless pixels (a cast shadow on white)."""
    a = rgb.astype(np.float32) / 255.0
    mx, mn = a.max(axis=2), a.min(axis=2)
    return (mx > 0.55) & ((mx - mn) < chroma)


def cutout(src: Path, dst: Path, size: int = 256, tol: float = 22.0, shadow: float = 0.0, close: int = 0) -> None:
    img = Image.open(src).convert('RGB')
    rgb = np.asarray(img)
    bg = background_mask(rgb, tol)
    if shadow:
        # grow the background through the connected pale-grey shadow
        from scipy import ndimage
        labels, _ = ndimage.label(bg | shadow_mask(rgb, shadow))
        touching = np.unique(labels[bg])
        bg = np.isin(labels, touching[touching > 0])
    bg |= enclosed_white(rgb)
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8))
    if close:  # fill small bites the keying took out of the edge
        alpha = alpha.filter(ImageFilter.MaxFilter(close)).filter(ImageFilter.MinFilter(close))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    rgba = img.copy()
    rgba.putalpha(alpha)
    box = alpha.point(lambda a: 255 if a > 40 else 0).getbbox()
    if box is None:
        raise SystemExit(f'empty cutout: {src}')
    obj = rgba.crop(box)
    side = int(max(obj.size) * 1.08)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(obj, ((side - obj.width) // 2, (side - obj.height) // 2))
    canvas = canvas.resize((size, size), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst, optimize=True)
    cover = (np.asarray(canvas)[:, :, 3] > 128).mean()
    print(f'{dst.relative_to(OUT)}  {size}px  cover={cover:.2f}')


def make_tileable(a: np.ndarray) -> np.ndarray:
    """Cross-fade the image with its half-offset copy so opposite edges meet."""
    h, w = a.shape[:2]
    shifted = np.roll(np.roll(a, h // 2, axis=0), w // 2, axis=1)
    yy = np.abs(np.linspace(-1, 1, h))[:, None]
    xx = np.abs(np.linspace(-1, 1, w))[None, :]
    edge = np.clip(np.maximum(yy, xx) * 1.6 - 0.6, 0, 1) ** 1.5  # 0 centre -> 1 near edges
    return a * (1 - edge[..., None]) + shifted * edge[..., None]


def texture(src: Path, dst: Path, size: int, mode: str) -> None:
    img = Image.open(src).convert('RGB')
    s = min(img.size)
    m = int(s * 0.15)  # renders often carry a frame or vignette at the border: use the middle 70%
    img = img.crop((m, m, s - m, s - m)).resize((size * 2, size * 2), Image.LANCZOS)
    a = np.asarray(img).astype(np.float32)
    # Flatten lighting falloff (vignettes, hot spots) so repeats don't show blotches.
    low = np.asarray(img.filter(ImageFilter.GaussianBlur(size * 0.25))).astype(np.float32)
    a = a / (low + 1.0) * low.reshape(-1, 3).mean(axis=0)
    a = make_tileable(a)
    if mode == 'grey':
        g = a.mean(axis=2)
        g = (g - g.mean()) / (g.std() + 1e-6)
        g = np.clip(0.9 + g * 0.045, 0, 1) * 255  # light and calm: the instance colour does the work
        a = np.repeat(g[..., None], 3, axis=2)
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, quality=86, optimize=True, progressive=True)
    print(f'{dst.relative_to(OUT)}  {size}px  mean={np.asarray(out).mean():.0f}')


if __name__ == '__main__':
    pick = dict(arg.split('=') for arg in sys.argv[3:])  # e.g. fruit_cherry=fruit_cherry_b
    for name, raw in CUTOUTS.items():
        src = RAW / f'{pick.get(raw, raw)}.png'
        if src.exists(): cutout(src, OUT / name, **CUT_OPTS.get(name, {}))
        else: print(f'missing {src.name}')
    for name, (raw, size, mode) in TEXTURES.items():
        src = RAW / f'{pick.get(raw, raw)}.png'
        if src.exists(): texture(src, OUT / name, size, mode)
        else: print(f'missing {src.name}')
