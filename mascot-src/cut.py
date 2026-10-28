# Cuts the mascot poses out of the sticker sheet, removes the white background
# (keeping white eyes/teeth inside the outlines) and writes webp files for the app.
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = Path(__file__).parent
OUT = SRC.parent / 'app' / 'mascot'
OUT.mkdir(exist_ok=True)
HEIGHT = 420

sheet = Image.open(SRC / 'sheet.webp').convert('RGB')
CROPS = {
    'wave':   (sheet, (1150, 60, 2000, 575)),
    'thumbs': (sheet, (1150, 581, 2000, 1043)),
    'fists':  (sheet, (1150, 1040, 2000, 1505)),
    'smile':  (sheet, (1150, 1500, 2000, 2000)),
    'peace':  (sheet, (0, 1100, 1150, 2000)),
    'think':  (Image.open(SRC / 'think.png').convert('RGB'), None),
}
# In the sheet, the top of each stacked pose's hair overlaps the shirt of the pose above.
# Within that band keep only the dark hair dome (sheet coords: band bottom y, hair x0, x1).
HAIR_BANDS = {'fists': (1076, 1440, 1745), 'smile': (1557, 1430, 1745)}
# extra seed points (x, y in crop coords) for white pockets enclosed by arms/hair
POCKETS = {k: [] for k in CROPS}
for arg in sys.argv[1:]:
    name, x, y = arg.split(':')
    POCKETS[name].append((int(x), int(y)))


def cut(img, pockets):
    a = np.asarray(img).astype(np.int16)
    mn, mx = a.min(2), a.max(2)
    lum = a.mean(2)
    cand = (mn > 195) & ((mx - mn) < 30)
    lab, _ = ndimage.label(cand)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    border |= {lab[y, x] for x, y in pockets if lab[y, x]}
    bg = np.isin(lab, list(border))
    alpha = np.full(lum.shape, 255.0)
    # fringe pixels are a blend of white paper and the nearest figure colour: un-mix them
    _, (iy, ix) = ndimage.distance_transform_edt(bg, return_indices=True)
    near = a[iy, ix]
    near_lum = near.mean(2)
    frac = (255 - lum) / np.maximum(255 - near_lum, 1)
    alpha[bg] = np.clip(frac[bg], 0, 1) * 255
    alpha[bg & (lum > 248)] = 0
    rgb = a.copy()
    rgb[bg] = near[bg]
    rgb = rgb.astype(np.uint8)
    # drop specks left over from neighbouring stickers
    solid = alpha > 20
    lab2, n2 = ndimage.label(solid)
    if n2 > 1:
        sizes = ndimage.sum(solid, lab2, range(1, n2 + 1))
        keep = np.isin(lab2, [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.05])
        alpha[~keep] = 0
    out = np.dstack([rgb, alpha.astype(np.uint8)])
    im = Image.fromarray(out, 'RGBA')
    bbox = im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    return im.crop(bbox)


for name, (src, box) in CROPS.items():
    img = src.crop(box) if box else src
    if name in HAIR_BANDS:
        by, hx0, hx1 = HAIR_BANDS[name]
        arr = np.asarray(img).copy()
        band = arr[: by - box[1]]
        cols = np.arange(arr.shape[1]) + box[0]
        outside = (cols < hx0) | (cols > hx1)
        b16 = band.astype(np.int16)
        not_hair = (b16.mean(2) > 150) | ((b16.max(2) - b16.min(2)) > 60)
        band[not_hair | outside[None, :]] = 255
        img = Image.fromarray(arr)
    im = cut(img, POCKETS[name])
    w = round(im.width * HEIGHT / im.height)
    im = im.resize((w, HEIGHT), Image.LANCZOS) if im.height > HEIGHT else im
    im.save(OUT / f'{name}.webp', 'WEBP', quality=92, method=6)
    print(name, im.size, (OUT / f'{name}.webp').stat().st_size)

# contact sheet on the post background for checking
tiles = [Image.open(OUT / f'{n}.webp') for n in CROPS]
H = max(t.height for t in tiles)
sheet_w = sum(t.width for t in tiles) + 20 * (len(tiles) + 1)
cs = Image.new('RGB', (sheet_w, H + 40), (18, 20, 43))
x = 20
for t in tiles:
    cs.paste(t, (x, 20 + H - t.height), t)
    x += t.width + 20
cs.save(SRC / 'check.png')
