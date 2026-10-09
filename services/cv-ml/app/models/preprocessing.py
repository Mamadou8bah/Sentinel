from io import BytesIO
import base64
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
import torch


def image_tensor(source, task, encoded=False):
    if encoded:
        payload = source.partition(",")[2] if source.startswith("data:") else source
        source = BytesIO(base64.b64decode(payload, validate=True))
    else:
        source = Path(source)
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image = ImageOps.pad(image, (512, 128) if task == "ocr" else (96, 96))
        array = np.array(image, dtype=np.float32) / 255.0
    return torch.from_numpy(array.transpose(2, 0, 1).copy())


def challenge_order(instructions):
    if instructions == ["LOOK_FORWARD", "TURN_LEFT", "TURN_RIGHT"]:
        return torch.tensor([1., 0.])
    if instructions == ["LOOK_FORWARD", "TURN_RIGHT", "TURN_LEFT"]:
        return torch.tensor([0., 1.])
    raise ValueError("Unsupported capture instruction order")
