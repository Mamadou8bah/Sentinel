"""PSCC-Net image-manipulation classifier; local document acceptance is independent."""
import hashlib
import json
import math
from pathlib import Path
import threading

import numpy as np
from PIL import Image

from app.models.evaluation import passes_gate
from app.services.faces import rgb_image

MANIFEST = Path(__file__).parents[1] / 'models/assets/pscc-manifest.json'
PIPELINE = 'pscc-rgb-unit-max1024-pad32-v1'


def prepare_tensor(encoded):
    import torch
    rgb = rgb_image(encoded, encoded=True)
    height, width = rgb.shape[:2]
    scale = min(1., 1024 / max(height, width))
    if scale < 1:
        rgb = np.asarray(Image.fromarray(rgb).resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.Resampling.BICUBIC))
    height, width = rgb.shape[:2]
    padded = np.full((max(64, math.ceil(height / 32) * 32), max(64, math.ceil(width / 32) * 32), 3), 255, dtype=np.uint8)
    padded[:height, :width] = rgb
    return torch.from_numpy(padded.copy()).permute(2, 0, 1).float().div(255).unsqueeze(0)


class TamperingModel:
    def __init__(self, directory):
        self.loaded, self.evaluated, self.error = False, False, None
        self.threshold = .5
        self._lock = threading.Lock()
        try:
            import torch
            from app.models.pscc.seg_hrnet import HighResolutionNet
            from app.models.pscc.seg_hrnet_config import get_hrnet_cfg
            from app.models.pscc.detection_head import DetectionHead
            self.manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))['models']
            directory = Path(directory)
            self.backbone = HighResolutionNet(get_hrnet_cfg())
            self.head = DetectionHead({'crop_size': [256, 256]})
            for name, model in [('HRNet', self.backbone), ('DetectionHead', self.head)]:
                spec = self.manifest[name]
                weights = directory / spec['file']
                if weights.stat().st_size > 25_000_000 or hashlib.sha256(weights.read_bytes()).hexdigest() != spec['sha256']:
                    raise ValueError('Tampering model checksum/size mismatch')
                state = torch.load(weights, map_location='cpu', weights_only=True)
                model.load_state_dict({key.removeprefix('module.'): value for key, value in state.items()}, strict=True)
                if any(not torch.isfinite(value).all() for value in model.state_dict().values()):
                    raise ValueError('Non-finite tampering weights')
                model.eval()
            self.loaded = True
            report = directory / 'acceptance.json'
            if report.exists():
                self.accept(json.loads(report.read_text(encoding='utf-8')))
        except (ImportError, OSError, KeyError, RuntimeError, TypeError, ValueError):
            self.error = 'PSCC weights, runtime or acceptance report unavailable/incompatible'

    @property
    def versions(self):
        return {name: spec['sha256'] for name, spec in self.manifest.items()}

    def accept(self, report):
        if report.get('pipeline') != PIPELINE or report.get('models') != self.versions:
            raise ValueError('Tampering acceptance does not match model/preprocessing')
        threshold = report.get('threshold')
        if type(threshold) not in (int, float) or not math.isfinite(threshold) or not 0 < threshold < 1:
            raise ValueError('Invalid tampering threshold')
        if not passes_gate('tampering', report.get('evaluation', {})):
            raise ValueError('Document holdout acceptance failed')
        self.threshold, self.evaluated = threshold, True

    def score(self, encoded):
        if not self.loaded:
            raise RuntimeError('Tampering inference unavailable')
        import torch
        tensor = prepare_tensor(encoded)
        with self._lock, torch.inference_mode():
            logits = self.head(self.backbone(tensor))
            if logits.shape != (1, 2) or not torch.isfinite(logits).all():
                raise ValueError('Invalid tampering output')
            # The upstream test labels class 1 as forged, class 0 as authentic.
            probability = float(logits.softmax(dim=1)[0, 1].item())
        return {'tamperingScore': probability, 'tamperingModelRan': True,
                'tamperingEvaluated': self.evaluated,
                'tamperingDetected': probability >= self.threshold,
                'modelVersions': {'tampering': self.versions},
                'signals': ([] if self.evaluated else ['TAMPERING_HOLDOUT_EVALUATION_REQUIRED'])
                           + (['DOCUMENT_TAMPERING_DETECTED'] if probability >= self.threshold else [])}
