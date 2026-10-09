import base64
import hashlib
from io import BytesIO
import warnings

from PIL import Image, ImageStat, UnidentifiedImageError


def inspect_image(encoded: str) -> dict:
    if encoded.startswith("data:"):
        header, separator, encoded = encoded.partition(",")
        if not separator or header not in {"data:image/jpeg;base64", "data:image/png;base64", "data:image/webp;base64"}:
            raise ValueError("Unsupported image data URL")
    if len(encoded) > 4_000_000:
        raise ValueError("Image exceeds the encoded size limit")
    try:
        raw = base64.b64decode(encoded, validate=True)
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(raw)) as image:
                if image.format not in {"PNG", "JPEG", "WEBP"}:
                    raise ValueError("Unsupported image format")
                width, height = image.size
                if width > 4096 or height > 4096 or width * height > 12_000_000:
                    raise ValueError("Image dimensions exceed the limit")
                image.load()
                variance = ImageStat.Stat(image.convert("L").resize((128, 128))).stddev[0]
        return {"sha256": hashlib.sha256(raw).hexdigest(), "width": width, "height": height,
                "qualityOk": min(width, height) >= 64 and variance >= 5}
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ValueError("Invalid or unsafe image") from error
