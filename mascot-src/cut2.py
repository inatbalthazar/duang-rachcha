# Cuts the second mascot set (8 poses) out of the two sticker sheets, removes the white
# paper (including white gaps enclosed by arms and inside bubbles) and writes webp files.
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = Path(__file__).parent
OUT = SRC.parent / 'app' / 'mascot'
OUT.mkdir(exist_ok=True)
HEIGHT = 420
big4 = Image.open(SRC / 'set4.webp').convert('RGB')
set8 = Image.open(SRC / 'set8.webp').convert('RGB')

# name: (sheet, crop box). The four poses that exist in both sheets come from the larger one.
POSES = {
    'wave':    (big4, (60, 70, 900, 992)),
    'thumbs':  (big4, (1088, 70, 1862, 997)),
    'heart':   (big4, (217, 1066, 877, 1950)),
    'hips':    (big4, (1165, 1065, 1867, 1962)),
    'bubbles': (set8, (978, 378, 1480, 930)),
    'cheer':   (set8, (1488, 380, 1994, 930)),
    'peace':   (set8, (1055, 1125, 1476, 1675)),
    'apple':   (set8, (1504, 1123, 1964, 1680)),
}
# the largest bubble overlaps the neighbouring sticker's hair, so it is left out (sheet coords)
DROP_CIRCLES = {'bubbles': [(955, 500, 68)]}


def cut(img):
    a = np.asarray(img).astype(np.int16)
    mn, mx = a.min(2), a.max(2)
    lum = a.mean(2)
    cand = (mn > 195) & ((mx - mn) < 30)
    lab, n = ndimage.label(cand)
    sizes = ndimage.sum(cand, lab, range(1, n + 1))
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    # in this art style the only legitimate white inside the figure is tiny eye highlights
    enclosed = {i + 1 for i, s in enumerate(sizes) if s > 400}
    bg = np.isin(lab, list(border | enclosed))
    _, (iy, ix) = ndimage.distance_transform_edt(bg, return_indices=True)
    near = a[iy, ix]
    frac = (255 - lum) / np.maximum(255 - near.mean(2), 1)
    alpha = np.full(lum.shape, 255.0)
    alpha[bg] = np.clip(frac[bg], 0, 1) * 255
    alpha[bg & (lum > 248)] = 0
    rgb = a.copy()
    rgb[bg] = near[bg]
    solid = alpha > 20
    lab2, n2 = ndimage.label(solid)
    if n2 > 1:
        s2 = ndimage.sum(solid, lab2, range(1, n2 + 1))
        keep = np.isin(lab2, [i + 1 for i, s in enumerate(s2) if s >= 60])
        alpha[~keep] = 0
    im = Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha.astype(np.uint8)]), 'RGBA')
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())


for old in OUT.glob('*.webp'):
    old.unlink()
for name, (sheet, box) in POSES.items():
    img = sheet.crop(box)
    if name in DROP_CIRCLES:
        arr = np.asarray(img).copy()
        yy, xx = np.mgrid[box[1]:box[3], box[0]:box[2]]
        for cx, cy, r in DROP_CIRCLES[name]:
            arr[(xx - cx) ** 2 + (yy - cy) ** 2 <= r * r] = 255
        img = Image.fromarray(arr)
    im = cut(img)
    if im.height > HEIGHT:
        im = im.resize((round(im.width * HEIGHT / im.height), HEIGHT), Image.LANCZOS)
    im.save(OUT / f'{name}.webp', 'WEBP', quality=92, method=6)
    print(name, im.size, (OUT / f'{name}.webp').stat().st_size)

tiles = [Image.open(OUT / f'{n}.webp') for n in POSES]
H = max(t.height for t in tiles)
cs = Image.new('RGB', (sum(t.width for t in tiles) + 20 * (len(tiles) + 1), H + 40), (18, 20, 43))
x = 20
for t in tiles:
    cs.paste(t, (x, 20 + H - t.height), t)
    x += t.width + 20
cs.save(SRC / 'check.png')
