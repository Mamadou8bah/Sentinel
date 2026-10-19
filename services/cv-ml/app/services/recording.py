"""Bounded recording decode, one-face continuity and server-issued instruction checks."""
import base64
import hashlib
import math
from pathlib import Path
import tempfile
import time
import numpy as np
from app.services.faces import locate_face, encode_image

MAX_VIDEO_BYTES = 8_000_000
DURATION_SECONDS = 9
SEGMENT_SECONDS = 3


def recording_bytes(encoded):
    if encoded.startswith("data:"):
        header, separator, encoded = encoded.partition(",")
        if not separator or header not in {"data:video/webm;base64", "data:video/mp4;base64"}:
            raise ValueError("Use an MP4 or WebM recording")
    if len(encoded) > 10_666_668:
        raise ValueError("Recording exceeds the 8 MB limit")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except ValueError:
        raise ValueError("Recording is not valid base64") from None
    if not raw or len(raw) > MAX_VIDEO_BYTES:
        raise ValueError("Recording exceeds the 8 MB limit")
    if raw[:4] == b"\x1a\x45\xdf\xa3":
        extension = ".webm"
    elif len(raw) >= 12 and raw[4:8] == b"ftyp":
        extension = ".mp4"
    else:
        raise ValueError("Unsupported recording container")
    return raw, extension


def decode_samples(raw, extension):
    import cv2
    started = time.monotonic()
    samples = []
    with tempfile.TemporaryDirectory(prefix="sentinel-capture-") as directory:
        filename = Path(directory) / ("recording" + extension)
        filename.write_bytes(raw)
        capture = cv2.VideoCapture(str(filename), cv2.CAP_FFMPEG,
            [cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 2000, cv2.CAP_PROP_READ_TIMEOUT_MSEC, 2000])
        try:
            if not capture.isOpened():
                raise ValueError("Recording cannot be decoded")
            fps = float(capture.get(cv2.CAP_PROP_FPS))
            width, height = capture.get(cv2.CAP_PROP_FRAME_WIDTH), capture.get(cv2.CAP_PROP_FRAME_HEIGHT)
            if not 64 <= width <= 1920 or not 64 <= height <= 1080:
                raise ValueError("Recording must use 8–60 FPS and at most 1920x1080 pixels")
            count, next_sample, previous_timestamp = 0, 0., -1.
            intervals = []
            while True:
                if time.monotonic() - started > 12:
                    raise ValueError("Recording decode exceeded its processing budget")
                ok, frame = capture.read()
                if not ok:
                    break
                count += 1
                if count > 720 or frame.shape[0] > 1080 or frame.shape[1] > 1920 or frame.shape[0] * frame.shape[1] > 2_073_600:
                    raise ValueError("Recording exceeds decoded size limits")
                actual_ms = float(capture.get(cv2.CAP_PROP_POS_MSEC))
                # Browser WebM commonly advertises 1000 FPS: presentation timestamps
                # establish capture timing instead of that nominal container value.
                if math.isfinite(actual_ms) and actual_ms >= 0 and actual_ms / 1000 > previous_timestamp:
                    timestamp = actual_ms / 1000
                elif math.isfinite(fps) and 8 <= fps <= 60:
                    timestamp = (count - 1) / fps
                else:
                    raise ValueError("Recording has invalid frame timing")
                if count == 1 and timestamp > .25:
                    raise ValueError("Recording must begin with the first prompt")
                if previous_timestamp >= 0:
                    interval = timestamp - previous_timestamp
                    if not 0 < interval <= .5:
                        raise ValueError("Recording was interrupted; record continuously")
                    intervals.append(interval)
                previous_timestamp = timestamp
                if timestamp > 11.5:
                    raise ValueError("Recording is too long")
                if timestamp >= next_sample:
                    scale = min(1., 640 / max(frame.shape[:2]))
                    if scale < 1: frame = cv2.resize(frame, (round(frame.shape[1] * scale), round(frame.shape[0] * scale)))
                    samples.append((timestamp, cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)))
                    next_sample = timestamp + .25
            duration = previous_timestamp + (float(np.median(intervals)) if intervals else 0.)
            measured_fps = count / duration if duration > 0 else 0.
            if not 8 <= measured_fps <= 60:
                raise ValueError("Recording must use 8–60 FPS")
            if not 8.5 <= duration <= 11.5 or len(samples) < 25:
                raise ValueError("Record all three prompts continuously for nine seconds")
            return samples, duration
        finally:
            capture.release()


def analyze_recording(raw, extension, instructions):
    if instructions not in (["LOOK_FORWARD", "TURN_LEFT", "TURN_RIGHT"], ["LOOK_FORWARD", "TURN_RIGHT", "TURN_LEFT"]):
        raise ValueError("Unsupported recording challenge")
    samples, duration = decode_samples(raw, extension)
    crops, phases, previous = [], [[], [], []], None
    # Pixel/geometry checks reject ambiguous captures; they never establish liveness.
    for timestamp, frame in samples:
        try:
            face = locate_face(frame, minimum=64)
        except ValueError as error:
            if "Exactly one" in str(error):
                # Multiple faces and missing faces are both invalid, avoiding track switching.
                raise ValueError("Keep exactly one face visible throughout the recording") from None
            raise
        box = face["box"]
        if previous is not None:
            x, y, w, h = box; px, py, pw, ph = previous
            displacement = math.hypot(x + w / 2 - px - pw / 2, y + h / 2 - py - ph / 2)
            if displacement > max(pw, ph) * .8 or not .4 <= (w * h) / (pw * ph) <= 2.5:
                raise ValueError("Face track changed abruptly; record again without leaving the camera")
        previous = box
        crop = encode_image(face["crop"])
        crops.append(crop)
        phase = min(2, int(timestamp / SEGMENT_SECONDS))
        # Only settled poses, after time to follow the prompt, are used for instruction checks.
        if 1.5 <= timestamp - phase * SEGMENT_SECONDS <= 2.9:
            phases[phase].append((face["yaw"], crop))
    if any(len(phase) < 3 for phase in phases):
        raise ValueError("Each recording prompt needs a clear held pose")
    poses = [float(np.median([item[0] for item in phase])) for phase in phases]
    if abs(poses[0]) > .25:
        raise ValueError("Begin by looking straight at the camera")
    for index, instruction in enumerate(instructions[1:], 1):
        shift = poses[index] - poses[0]
        if (instruction == "TURN_LEFT" and shift < .12) or (instruction == "TURN_RIGHT" and shift > -.12):
            raise ValueError("Head turns do not match the issued prompt order")
    selected = [min(phase, key=lambda item: abs(item[0] - poses[index]))[1] for index, phase in enumerate(phases)]
    return {"faceCrops": crops, "challengeCrops": selected, "durationSeconds": round(duration, 3),
            "sampledFrames": len(crops), "recordingSha256": hashlib.sha256(raw).hexdigest()}
