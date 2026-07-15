from pathlib import Path
import numpy as np
from PIL import Image

src_candidates = [
    Path(r"C:\Users\Mamadou\.cursor\projects\c-Users-Mamadou-Downloads-sentinel\assets\sentinel-logo.png"),
    Path(r"C:\Users\Mamadou\Downloads\sentinel\frontend\public\sentinel-logo.png"),
]
src = next(p for p in src_candidates if p.exists())

img = Image.open(src).convert("RGBA")
arr = np.array(img).astype(np.float32)
r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
luma = 0.2126 * r + 0.7152 * g + 0.0722 * b

# Near-black → transparent with soft edge
thresh_low, thresh_high = 18.0, 52.0
alpha = np.clip((luma - thresh_low) / (thresh_high - thresh_low), 0, 1) * 255.0
arr[:, :, 3] = np.minimum(a, alpha)

out = Image.fromarray(arr.astype(np.uint8), "RGBA")

mask = arr[:, :, 3] > 10
ys, xs = np.where(mask)
if len(xs):
    pad = 10
    left = max(0, int(xs.min()) - pad)
    right = min(arr.shape[1], int(xs.max()) + pad)
    top = max(0, int(ys.min()) - pad)
    bottom = min(arr.shape[0], int(ys.max()) + pad)
    out = out.crop((left, top, right, bottom))

dest = Path(r"C:\Users\Mamadou\Downloads\sentinel\frontend\public\sentinel-logo.png")
fav = Path(r"C:\Users\Mamadou\Downloads\sentinel\frontend\public\favicon.png")
out.save(dest, optimize=True)
out.save(fav, optimize=True)
print(f"saved {dest} size={out.size}")
