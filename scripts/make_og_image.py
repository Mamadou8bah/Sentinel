"""Build a 1200x630 Open Graph / WhatsApp share image from the Sentinel mark."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:\Users\Mamadou\Downloads\sentinel\frontend\public")
LOGO = ROOT / "senitel_logo.png"
OUT = ROOT / "og-image.png"

W, H = 1200, 630
BG = (7, 10, 0, 255)
ACCENT = (255, 69, 21, 255)
WHITE = (255, 255, 255, 255)
MUTE = (180, 180, 175, 255)

canvas = Image.new("RGBA", (W, H), BG)
draw = ImageDraw.Draw(canvas)

# Soft orange glow on the right
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gdraw = ImageDraw.Draw(glow)
for i, alpha in enumerate((28, 18, 10, 5)):
    r = 220 + i * 40
    gdraw.ellipse((W - 180 - r, H // 2 - r, W - 180 + r, H // 2 + r), fill=(255, 69, 21, alpha))
canvas = Image.alpha_composite(canvas, glow)
draw = ImageDraw.Draw(canvas)

# Logo
logo = Image.open(LOGO).convert("RGBA")
logo_size = 220
logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
logo_x, logo_y = 80, (H - logo_size) // 2
canvas.paste(logo, (logo_x, logo_y), logo)

# Accent bar
draw.rectangle((360, 250, 390, 380), fill=ACCENT)

# Fonts — fall back safely on Windows
def load_font(size: int, bold: bool = False):
    candidates = [
        r"C:\Windows\Fonts\georgia.ttf",
        r"C:\Windows\Fonts\georgiab.ttf" if bold else r"C:\Windows\Fonts\georgia.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
    ]
    if bold:
        candidates = [
            r"C:\Windows\Fonts\georgiab.ttf",
            r"C:\Windows\Fonts\arialbd.ttf",
            *candidates,
        ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()

title_font = load_font(72, bold=True)
sub_font = load_font(28)
tag_font = load_font(20)

draw.text((420, 210), "Sentinel", font=title_font, fill=WHITE)
draw.text((420, 295), "AI-Powered KYC & Fraud Prevention", font=sub_font, fill=MUTE)
draw.text((420, 350), "Built for modern banking compliance in The Gambia", font=tag_font, fill=ACCENT)

# Bottom edge accent line
draw.rectangle((0, H - 6, W, H), fill=ACCENT)

canvas.convert("RGB").save(OUT, "PNG", optimize=True)
print(f"Wrote {OUT} ({W}x{H})")
