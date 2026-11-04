"""CPU YuNet/SFace + MiniFASNet inference; evaluated readiness is separate from loading."""
import hashlib
import json
import math
from pathlib import Path
import threading

import numpy as np

from app.models.evaluation import passes_gate
from app.services.faces import locate_face, rgb_image, DETECTOR_SHA256

MANIFEST = Path(__file__).parents[1] / 'models/assets/pretrained-manifest.json'


def context_crop(rgb, detection, scale):
    """Match upstream CropImage boundary translation, BGR order and raw 0..255 tensors."""
    # CropImage boundary algorithm adapted from MiniVision's generate_patches.py
    # (Apache-2.0, revision/source attribution in app/models/minifasnet/NOTICE).
    import cv2
    height, width = rgb.shape[:2]
    x, y, w, h = map(float, detection[:4])
    scale = min((height - 1) / h, (width - 1) / w, scale)
    new_w, new_h = w * scale, h * scale
    left, top = x + w / 2 - new_w / 2, y + h / 2 - new_h / 2
    right, bottom = left + new_w, top + new_h
    if left < 0: right -= left; left = 0
    if top < 0: bottom -= top; top = 0
    if right > width - 1: left -= right - width + 1; right = width - 1
    if bottom > height - 1: top -= bottom - height + 1; bottom = height - 1
    crop = rgb[int(top):int(bottom) + 1, int(left):int(right) + 1]
    return cv2.resize(crop[:, :, ::-1], (80, 80)).transpose(2, 0, 1).copy().astype(np.float32)


class PretrainedFaces:
    def __init__(self, directory):
        self.loaded, self.evaluated, self.error = False, False, None
        self._lock = threading.Lock()
        self.face_threshold, self.live_threshold = .363, .9
        try:
            import cv2
            import torch
            from app.models.minifasnet.network import MiniFASNetV2, MiniFASNetV1SE
            directory = Path(directory)
            self.manifest = json.loads(MANIFEST.read_text())['models']
            for spec in self.manifest.values():
                path = directory / spec['file']
                if path.stat().st_size > 50_000_000 or hashlib.sha256(path.read_bytes()).hexdigest() != spec['sha256']:
                    raise ValueError('Pretrained model checksum mismatch')
            self.recognizer = cv2.FaceRecognizerSF.create(str(directory / self.manifest['sface']['file']), '')
            self.spoof_models = []
            for name, constructor, scale in [('minifasnet_v2', MiniFASNetV2, 2.7),
                                               ('minifasnet_v1se', MiniFASNetV1SE, 4.)]:
                model = constructor(conv6_kernel=(5, 5))
                weights = torch.load(directory / self.manifest[name]['file'], map_location='cpu', weights_only=True)
                weights = {key.removeprefix('module.'): value for key, value in weights.items()}
                model.load_state_dict(weights, strict=True)
                if any(not torch.isfinite(value).all() for value in model.state_dict().values()):
                    raise ValueError('Non-finite pretrained weights')
                self.spoof_models.append((model.eval(), scale))
            self.loaded = True
            policy = directory / 'acceptance.json'
            if policy.exists():
                self.accept(json.loads(policy.read_text()))
        except (OSError, ValueError, KeyError, RuntimeError, TypeError):
            self.error = 'Pretrained files or acceptance report missing, invalid or incompatible'

    @property
    def versions(self):
        return {name: spec['sha256'] for name, spec in self.manifest.items()} | {'yunet': DETECTOR_SHA256}

    def accept(self, report):
        if report.get('models') != self.versions or report.get('pipeline') != 'yunet-sface-minifasnet-v1':
            raise ValueError('Acceptance report does not match model pipeline')
        for task in ('face', 'liveness'):
            threshold = report['thresholds'][task]
            if not isinstance(threshold, (int, float)) or not math.isfinite(threshold) or not 0 < threshold < 1:
                raise ValueError('Invalid acceptance threshold')
            if not passes_gate(task, report['evaluation'][task]):
                raise ValueError('Independent holdout acceptance failed')
        self.face_threshold = report['thresholds']['face']
        self.live_threshold = report['thresholds']['liveness']
        self.evaluated = True

    def embedding(self, rgb, face):
        import cv2
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        with self._lock:
            aligned = self.recognizer.alignCrop(bgr, face['detection'])
            embedding = self.recognizer.feature(aligned).flatten().copy()
        if not np.isfinite(embedding).all() or np.linalg.norm(embedding) <= 0:
            raise ValueError('Invalid face embedding')
        return embedding / np.linalg.norm(embedding)

    def score_recording(self, document, track):
        if not self.loaded:
            raise RuntimeError('Pretrained face models unavailable')
        import torch
        rgb = rgb_image(document, encoded=True)
        reference = self.embedding(rgb, locate_face(rgb))
        observations = track.get('observations', [])
        if not 25 <= len(observations) <= 48:
            raise ValueError('Continuous recording observations required')
        similarities, probabilities = [], []
        for item in observations:
            embedding = self.embedding(item['image'], item['face'])
            similarities.append(float(np.clip(np.dot(reference, embedding), -1., 1.)))
        # Evaluate all sampled frames, with both original pretrained context scales.
        with torch.inference_mode(), self._lock:
            for model, scale in self.spoof_models:
                batch = torch.from_numpy(np.stack([context_crop(item['image'], item['face']['detection'], scale)
                                                    for item in observations]))
                logits = model(batch)
                if logits.shape != (len(observations), 3) or not torch.isfinite(logits).all():
                    raise ValueError('Invalid anti-spoof inference')
                probabilities.append(logits.softmax(dim=1).numpy())
        prediction = np.mean(probabilities, axis=0)
        # Upstream class 1 is real; both spoof classes must lose on every sampled frame.
        live = float(prediction[:, 1].min())
        spoof = bool(np.any(prediction.argmax(axis=1) != 1)) or live < self.live_threshold
        cosine = min(similarities)
        return {'faceCosineSimilarity': cosine, 'faceMatchScore': max(0., cosine) if cosine >= self.face_threshold else 0.,
                'livenessScore': 0. if spoof else live, 'spoofLikely': spoof,
                'antiSpoofRealScore': live if bool(np.all(prediction.argmax(axis=1) == 1)) else 0.,
                'comparedFrames': len(observations), 'modelVersions': self.versions,
                'signals': (['RECORDING_FACE_MISMATCH'] if cosine < self.face_threshold else [])
                           + (['PRESENTATION_ATTACK_SUSPECTED'] if spoof else [])
                           + ([] if self.evaluated else ['PRETRAINED_HOLDOUT_EVALUATION_REQUIRED'])}
