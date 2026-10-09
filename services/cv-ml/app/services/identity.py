"""Load locally trained identity artifacts only after their independent evaluation gates pass."""
import hashlib
import json
from pathlib import Path
import re
from datetime import date

from app.models.evaluation import passes_gate

TASKS = ("face", "liveness", "tampering", "ocr")


class IdentityModels:
    def __init__(self, directory=None):
        self.models, self.metadata, self.errors = {}, {}, {}
        if directory is None:
            return
        from app.models.network import IdentityModel
        import torch
        for task in TASKS:
            try:
                folder = Path(directory) / task
                metadata = json.loads((folder / 'evaluation.json').read_text(encoding='utf-8'))
                if metadata['schemaVersion'] != 1 or metadata['task'] != task or not passes_gate(task, metadata['evaluation']):
                    raise ValueError('Artifact evaluation gate failed')
                threshold = metadata['threshold']
                if not isinstance(threshold, (int, float)) or not 0 < threshold < 1:
                    raise ValueError('Invalid artifact threshold')
                weights = folder / 'weights.pt'
                if weights.stat().st_size > 20_000_000 or hashlib.sha256(weights.read_bytes()).hexdigest() != metadata['weightsSha256']:
                    raise ValueError('Artifact checksum/size mismatch')
                model = IdentityModel(task)
                model.load_state_dict(torch.load(weights, weights_only=True, map_location='cpu'), strict=True)
                if any(not torch.isfinite(value).all() for value in model.state_dict().values()):
                    raise ValueError('Non-finite model weights')
                self.models[task], self.metadata[task] = model.eval(), metadata
            except (OSError, KeyError, ValueError, RuntimeError, TypeError):
                self.errors[task] = 'Missing, incompatible or unevaluated artifact'

    @property
    def ready(self):
        return all(task in self.models for task in TASKS)

    def health(self):
        return {'mode': 'trained-identity' if self.ready else 'evidence-validation',
                'faceModelLoaded': 'face' in self.models, 'spoofModelLoaded': 'liveness' in self.models,
                'ocrModelLoaded': 'ocr' in self.models, 'tamperingModelLoaded': 'tampering' in self.models,
                'verificationReady': self.ready, 'modelErrors': self.errors}

    def liveness(self, frames, instructions):
        if 'liveness' not in self.models:
            return {'livenessScore': 0., 'modelRan': False, 'spoofLikely': False, 'signals': ['ANTI_SPOOF_MODEL_UNAVAILABLE']}
        if len(frames) != 3:
            raise ValueError('Trained liveness requires exactly three challenge frames')
        import torch
        from app.models.preprocessing import image_tensor, challenge_order
        images = torch.stack([image_tensor(frame, 'liveness', encoded=True) for frame in frames[:3]]).unsqueeze(0)
        with torch.inference_mode():
            score = float(self.models['liveness'](images, challenge_order(instructions).unsqueeze(0)).sigmoid().item())
        accepted = score >= self.metadata['liveness']['threshold']
        return {'livenessScore': score if accepted else 0., 'modelRan': True, 'spoofLikely': not accepted,
                'signals': [] if accepted else ['LIVENESS_OR_INSTRUCTIONS_REJECTED']}

    def kyc(self, document, selfie):
        if not self.ready:
            return {'extractedFields': {}, 'faceMatchScore': 0., 'tamperingScore': 1., 'modelRan': False,
                    'signals': [task.upper() + '_MODEL_UNAVAILABLE' for task in TASKS if task not in self.models]}
        import torch
        from app.models.network import decode_text
        from app.models.preprocessing import image_tensor
        doc = image_tensor(document, 'face', encoded=True)
        face = image_tensor(selfie, 'face', encoded=True)
        with torch.inference_mode():
            pair = torch.stack((doc, face)).unsqueeze(0)
            face_score = float(self.models['face'](pair).sigmoid().item())
            tamper_score = float(self.models['tampering'](doc.unsqueeze(0)).sigmoid().item())
            text = decode_text(self.models['ocr'](image_tensor(document, 'ocr', encoded=True).unsqueeze(0)).argmax(-1)[:, 0].tolist())
        fields = extract_fields(text)
        signals = []
        if face_score < self.metadata['face']['threshold']:
            face_score = 0.; signals.append('FACE_MATCH_REJECTED')
        if tamper_score >= self.metadata['tampering']['threshold']:
            tamper_score = 1.; signals.append('DOCUMENT_TAMPERING_DETECTED')
        if len(fields) != 2: signals.append('REQUIRED_ID_FIELDS_UNREADABLE')
        return {'extractedFields': fields, 'faceMatchScore': face_score, 'tamperingScore': tamper_score,
                'modelRan': True, 'signals': signals,
                'modelVersions': {task: meta['weightsSha256'][:16] for task, meta in self.metadata.items()}}


def extract_fields(text):
    # Explicit structured labels avoid guessing a date or ID from unrelated document text.
    identifier = re.search(r'(?:^|\n)ID=([A-Z0-9-]{3,40})(?:\n|$)', text)
    birth = re.search(r'(?:^|\n)DOB=(\d{4}-\d{2}-\d{2})(?:\n|$)', text)
    result = {}
    if identifier: result['idNumber'] = identifier[1]
    if birth:
        try:
            value = date.fromisoformat(birth[1])
            if date(1900, 1, 1) <= value <= date.today(): result['dob'] = value.isoformat()
        except ValueError: pass
    return result
