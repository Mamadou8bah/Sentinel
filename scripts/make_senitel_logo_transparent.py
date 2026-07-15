from pathlib import Path
import numpy as np
from PIL import Image

src = Path(r"C:\Users\Mamadou\Downloads\sentinel\frontend\public\senitel_logo.png")
img = Image.open(src).convert("RGBA")
arr = np.array(img).astype(np.float32)
r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
luma = 0.2126 * r + 0.7152 * g + 0.0722 * b

# Keep bright (white) mark; black/near-black → transparent
thresh_low, thresh_high = 40.0, 90.0
alpha = np.clip((luma - thresh_low) / (thresh_high - thresh_low), 0, 1) * 255.0
arr[:, :, 3] = np.minimum(a, alpha)

out = Image.fromarray(arr.astype(np.uint8), "RGBA")
mask = arr[:, :, 3] > 12
ys, xs = np.where(mask)
if len(xs):
    pad = 12
    left = max(0, int(xs.min()) - pad)
    right = min(arr.shape[1], int(xs.max()) + pad)
    top = max(0, int(ys.min()) - pad)
    bottom = min(arr.shape[0], int(ys.max()) + pad)
    out = out.crop((left, top, right, bottom))

public = Path(r"C:\Users\Mamadou\Downloads\sentinel\frontend\public")
out.save(public / "senitel_logo.png", optimize=True)
out.save(public / "favicon.png", optimize=True)
# Keep legacy path working for any stray refs
out.save(public / "sentinel-logo.png", optimize=True)
print(f"saved transparent logo size={out.size}")
