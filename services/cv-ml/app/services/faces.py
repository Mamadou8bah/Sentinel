"""Pinned YuNet face localization; detection never substitutes for identity/liveness inference."""
import base64
import hashlib
from io import BytesIO
from pathlib import Path
import threading

import numpy as np
from PIL import Image, ImageOps

DETECTOR_SHA256 = "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"
PREPROCESSING = "yunet-face-crops-v2"
_local = threading.local()


def detector():
    import cv2
    if not hasattr(_local, "detector"):
        model = Path(__file__).parents[1] / "models/assets/face_detection_yunet_2023mar.onnx"
        if not model.is_file() or hashlib.sha256(model.read_bytes()).hexdigest() != DETECTOR_SHA256:
            raise RuntimeError("Face detector is missing or incompatible")
        _local.detector = cv2.FaceDetectorYN.create(str(model), "", (320, 320), .85, .3, 100)
    return _local.detector


def rgb_image(source, encoded=False):
    if encoded:
        from app.services.evidence import inspect_image
        inspect_image(source)
        source = BytesIO(base64.b64decode(source.partition(",")[2] if source.startswith("data:") else source, validate=True))
    with Image.open(source) as image:
        if image.width > 4096 or image.height > 4096 or image.width * image.height > 12_000_000:
            raise ValueError("Image dimensions exceed the limit")
        return np.asarray(ImageOps.exif_transpose(image).convert("RGB")).copy()


def encode_image(rgb):
    output = BytesIO()
    Image.fromarray(rgb).save(output, format="JPEG", quality=92)
    return base64.b64encode(output.getvalue()).decode("ascii")


def locate_face(rgb, minimum=40):
    import cv2
    height, width = rgb.shape[:2]
    scale = min(1., 960 / max(height, width))
    frame = cv2.resize(rgb, (round(width * scale), round(height * scale))) if scale < 1 else rgb
    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
    engine = detector()
    engine.setInputSize((frame.shape[1], frame.shape[0]))
    _, faces = engine.detect(frame)
    if faces is None or len(faces) != 1:
        raise ValueError("Exactly one visible face is required")
    face = faces[0]
    x, y, w, h = [float(value / scale) for value in face[:4]]
    if min(w, h) < minimum or x < 0 or y < 0 or x + w > width or y + h > height:
        raise ValueError("Face is too small or partly outside the image")
    landmarks = face[4:14].reshape(5, 2) / scale
    eyes = sorted(landmarks[:2], key=lambda point: point[0])
    eye_vector = eyes[1] - eyes[0]
    eye_distance = float(np.linalg.norm(eye_vector))
    if eye_distance < 8:
        raise ValueError("Face landmarks are insufficient")
    yaw = float(np.dot(landmarks[2] - (eyes[0] + eyes[1]) / 2, eye_vector) / (eye_distance ** 2))
    # Include a small consistent margin, while excluding document text/background.
    left, top = max(0, int(x - .12 * w)), max(0, int(y - .12 * h))
    right, bottom = min(width, int(x + 1.12 * w)), min(height, int(y + 1.12 * h))
    crop = rgb[top:bottom, left:right].copy()
    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
    if float(gray.std()) < 8 or float(cv2.Laplacian(gray, cv2.CV_64F).var()) < 15:
        raise ValueError("Face is blurred or has insufficient detail")
    return {"crop": crop, "box": (x / width, y / height, w / width, h / height), "yaw": yaw}


def face_image(source, encoded=False):
    return Image.fromarray(locate_face(rgb_image(source, encoded))["crop"])
