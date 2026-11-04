"""Identity inference with explicit evaluated or pretrained-threshold approval policy."""
import hashlib
import json
from pathlib import Path
import re
from datetime import date

from app.models.evaluation import passes_gate

from app.services.faces import PREPROCESSING, DETECTOR_SHA256

TASKS = ("face", "liveness", "tampering", "ocr")
EVALUATION_SIGNALS = frozenset({'PRETRAINED_HOLDOUT_EVALUATION_REQUIRED',
                               'OCR_HOLDOUT_EVALUATION_REQUIRED', 'TAMPERING_HOLDOUT_EVALUATION_REQUIRED'})


class IdentityModels:
    def __init__(self, directory=None, pretrained_directory=None, document_ocr=False, tampering_directory=None,
                 require_evaluation=True):
        self.require_evaluation = require_evaluation
        self.models, self.metadata, self.errors = {}, {}, {}
        self.pretrained = None
        self.document_ocr = None
        self.tampering = None
        if tampering_directory:
            from app.services.tampering import TamperingModel
            self.tampering = TamperingModel(tampering_directory)
        if document_ocr:
            from app.services.document_ocr import DocumentOcr
            acceptance = Path(pretrained_directory or directory or 'artifacts/pretrained') / 'ocr-acceptance.json'
            self.document_ocr = DocumentOcr(acceptance)
        if pretrained_directory:
            from app.services.pretrained import PretrainedFaces
            self.pretrained = PretrainedFaces(pretrained_directory)
        if directory is None:
            return
        from app.models.network import IdentityModel
        import torch
        for task in TASKS:
            try:
                folder = Path(directory) / task
                metadata = json.loads((folder / 'evaluation.json').read_text(encoding='utf-8'))
                if metadata['schemaVersion'] != 2 or metadata.get('preprocessing') != PREPROCESSING or metadata.get('detectorSha256') != DETECTOR_SHA256 or metadata['task'] != task or not passes_gate(task, metadata['evaluation']):
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
        if self.pretrained is not None:
            if self.initial_thresholds:
                return self.component_ready(self.pretrained) and self.documents_ready
            return self.pretrained.loaded and self.pretrained.evaluated and self.documents_ready
        return all(task in self.models for task in TASKS)

    @property
    def documents_ready(self):
        if self.initial_thresholds:
            return self.component_ready(self.document_ocr) and self.component_ready(self.tampering)
        ocr_ready = (self.document_ocr.loaded and self.document_ocr.evaluated) if self.document_ocr else 'ocr' in self.models
        tamper_ready = (self.tampering.loaded and self.tampering.evaluated) if self.tampering else 'tampering' in self.models
        return bool(ocr_ready and tamper_ready)

    @property
    def initial_thresholds(self):
        # This opt-in applies only to the complete, pinned pretrained pipeline.
        # Custom trained artifacts must still pass their existing loader gates.
        return not self.require_evaluation and all(component is not None for component in
                                                    (self.pretrained, self.document_ocr, self.tampering))

    @staticmethod
    def component_ready(component):
        return bool(component.loaded and not component.error)

    def policy_metadata(self):
        components = (self.pretrained, self.document_ocr, self.tampering)
        validated = all(component is not None and component.loaded and component.evaluated
                        and not component.error for component in components)
        if self.pretrained is None:
            validated = all(task in self.models for task in TASKS)
        return {'approvalPolicy': 'pretrained-thresholds' if self.initial_thresholds else 'evaluated',
                'evaluationRequired': not self.initial_thresholds,
                'localAccuracyValidated': validated,
                'evaluationWarnings': sorted(signal for component, signal in zip(components,
                    ('PRETRAINED_HOLDOUT_EVALUATION_REQUIRED', 'OCR_HOLDOUT_EVALUATION_REQUIRED',
                     'TAMPERING_HOLDOUT_EVALUATION_REQUIRED'), strict=True)
                    if component is not None and not component.evaluated)}

    def blocking_signals(self, signals):
        return [signal for signal in signals if not (self.initial_thresholds and signal in EVALUATION_SIGNALS)]

    def health(self):
        result = {'mode': 'trained-identity' if self.ready else 'evidence-validation',
                'faceModelLoaded': 'face' in self.models, 'spoofModelLoaded': 'liveness' in self.models,
                'ocrModelLoaded': 'ocr' in self.models, 'tamperingModelLoaded': 'tampering' in self.models,
                'verificationReady': self.ready, 'modelErrors': self.errors}
        if self.pretrained is not None:
            result.update(mode='pretrained-face', faceModelLoaded=self.pretrained.loaded,
                          spoofModelLoaded=self.pretrained.loaded,
                          faceModelsEvaluated=self.pretrained.evaluated,
                          antiSpoofBackend='zerogpu' if getattr(self.pretrained, 'gpu_predict', None) else 'cpu',
                          pretrainedError=self.pretrained.error)
            result['modelErrors'] = {task: error for task, error in self.errors.items() if task in ('ocr', 'tampering')}
        if self.document_ocr is not None:
            result.update(ocrModelLoaded=self.document_ocr.loaded, ocrModelEvaluated=self.document_ocr.evaluated,
                          ocrError=self.document_ocr.error)
            result['modelErrors'] = {key: error for key, error in result['modelErrors'].items() if key != 'ocr'}
        if self.tampering is not None:
            result.update(tamperingModelLoaded=self.tampering.loaded, tamperingModelEvaluated=self.tampering.evaluated,
                          tamperingError=self.tampering.error)
            result['modelErrors'] = {key: error for key, error in result['modelErrors'].items() if key != 'tampering'}
        result['documentChecksReady'] = self.documents_ready
        result['automaticApprovalReady'] = self.ready
        result['readinessBlockers'] = self.readiness_blockers()
        result.update(self.policy_metadata())
        return result

    def readiness_blockers(self):
        blockers = []
        for component, loaded, evaluated in (
            ('FACE', self.pretrained.loaded if self.pretrained else 'face' in self.models,
             self.pretrained.evaluated if self.pretrained else 'face' in self.models),
            ('OCR', self.document_ocr.loaded if self.document_ocr else 'ocr' in self.models,
             self.document_ocr.evaluated if self.document_ocr else 'ocr' in self.models),
            ('TAMPERING', self.tampering.loaded if self.tampering else 'tampering' in self.models,
             self.tampering.evaluated if self.tampering else 'tampering' in self.models)):
            if not loaded: blockers.append(component + '_MODEL_UNAVAILABLE')
            elif not evaluated and not self.initial_thresholds: blockers.append(component + '_HOLDOUT_EVALUATION_REQUIRED')
        if self.initial_thresholds:
            for component, name in ((self.pretrained, 'FACE'), (self.document_ocr, 'OCR'), (self.tampering, 'TAMPERING')):
                if component.loaded and component.error: blockers.append(name + '_MODEL_INVALID')
        if self.pretrained is None and 'liveness' not in self.models:
            blockers.append('LIVENESS_MODEL_UNAVAILABLE')
        return blockers

    def liveness(self, frames, instructions, cropped=False):
        if 'liveness' not in self.models:
            return {'livenessScore': 0., 'modelRan': False, 'spoofLikely': False, 'signals': ['ANTI_SPOOF_MODEL_UNAVAILABLE']}
        if len(frames) != 3:
            raise ValueError('Trained liveness requires exactly three challenge frames')
        import torch
        from app.models.preprocessing import image_tensor, challenge_order
        images = torch.stack([image_tensor(frame, 'liveness', encoded=True, cropped=cropped) for frame in frames[:3]]).unsqueeze(0)
        with torch.inference_mode():
            score = float(self.models['liveness'](images, challenge_order(instructions).unsqueeze(0)).sigmoid().item())
        accepted = score >= self.metadata['liveness']['threshold']
        return {'livenessScore': score if accepted else 0., 'modelRan': True, 'spoofLikely': not accepted,
                'signals': [] if accepted else ['LIVENESS_OR_INSTRUCTIONS_REJECTED']}

    def kyc(self, document, selfie):
        if self.pretrained is not None or not self.ready:
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
            tamper_score = float(self.models['tampering'](image_tensor(document, 'tampering', encoded=True).unsqueeze(0)).sigmoid().item())
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

    def recording_kyc(self, document, track, instructions):
        if self.pretrained is not None:
            return self.pretrained_recording(document, track)
        if not self.ready:
            return {"extractedFields": {}, "faceMatchScore": 0., "livenessScore": 0., "tamperingScore": 1.,
                    "spoofLikely": False, "modelRan": False,
                    "signals": [task.upper() + "_MODEL_UNAVAILABLE" for task in TASKS if task not in self.models]}
        import torch
        from app.models.preprocessing import image_tensor
        from app.models.network import decode_text
        from app.services.faces import face_image
        portrait = face_image(document, encoded=True)
        # Crops and training use the same preprocessing; document OCR/tamper keep the full image.
        from app.services.faces import encode_image
        import numpy as np
        portrait_tensor = image_tensor(encode_image(np.asarray(portrait)), "face", encoded=True, cropped=True)
        comparisons = []
        with torch.inference_mode():
            captured = torch.stack([image_tensor(crop, "face", encoded=True, cropped=True) for crop in track["faceCrops"]])
            pairs = torch.stack((portrait_tensor.unsqueeze(0).expand_as(captured), captured), dim=1)
            comparisons = self.models['face'](pairs).sigmoid().tolist()
            tamper = float(self.models['tampering'](image_tensor(document, 'tampering', encoded=True).unsqueeze(0)).sigmoid().item())
            text = decode_text(self.models['ocr'](image_tensor(document, 'ocr', encoded=True).unsqueeze(0)).argmax(-1)[:, 0].tolist())
        live = self.liveness(track["challengeCrops"], instructions, cropped=True)
        fields = extract_fields(text)
        face_score = min(comparisons) if comparisons else 0.
        signals = list(live["signals"])
        if face_score < self.metadata['face']['threshold']:
            signals.append('RECORDING_FACE_MISMATCH'); face_score = 0.
        if tamper >= self.metadata['tampering']['threshold']:
            signals.append('DOCUMENT_TAMPERING_DETECTED'); tamper = 1.
        if len(fields) != 2: signals.append('REQUIRED_ID_FIELDS_UNREADABLE')
        return {"extractedFields": fields, "faceMatchScore": face_score, "livenessScore": live['livenessScore'],
                "tamperingScore": tamper, "spoofLikely": live['spoofLikely'], "modelRan": True, "signals": signals,
                "comparedFrames": len(comparisons),
                "modelVersions": {task: meta['weightsSha256'][:16] for task, meta in self.metadata.items()}}

    def pretrained_recording(self, document, track):
        if not self.pretrained.loaded:
            return self.decide({'extractedFields': {}, 'faceMatchScore': 0., 'livenessScore': 0., 'tamperingScore': 1.,
                    'spoofLikely': False, 'modelRan': False, 'signals': ['PRETRAINED_FACE_MODELS_UNAVAILABLE']}
                    )
        result = self.pretrained.score_recording(document, track)
        if self.document_ocr is not None:
            document_result = self.document_verify(document, 'ID')
            return self.decide({**result, 'recordingChallengePassed': track.get('challengeVerified') is True,
                    'extractedFields': document_result['extractedFields'],
                    'tamperingScore': document_result['tamperingScore'],
                    'documentChecksAccepted': document_result['documentChecksAccepted'],
                    'signals': result['signals'] + document_result['signals'],
                    'modelVersions': {**result['modelVersions'], **document_result['modelVersions']},
                    'faceModelsRan': True, 'ocrModelRan': document_result['ocrModelRan'],
                    'modelRan': self.ready and document_result['documentChecksAccepted']})
        fields, tamper = {}, 1.
        if all(task in self.models for task in ('ocr', 'tampering')):
            import torch
            from app.models.preprocessing import image_tensor
            from app.models.network import decode_text
            with torch.inference_mode():
                tamper = float(self.models['tampering'](image_tensor(document, 'tampering', encoded=True).unsqueeze(0)).sigmoid().item())
                text = decode_text(self.models['ocr'](image_tensor(document, 'ocr', encoded=True).unsqueeze(0)).argmax(-1)[:, 0].tolist())
            fields = extract_fields(text)
            if tamper >= self.metadata['tampering']['threshold']:
                tamper = 1.; result['signals'].append('DOCUMENT_TAMPERING_DETECTED')
            result['modelVersions'].update({task: self.metadata[task]['weightsSha256'] for task in ('ocr', 'tampering')})
        else:
            result['signals'].append('DOCUMENT_CHECKS_UNAVAILABLE')
        if len(fields) != 2:
            result['signals'].append('REQUIRED_ID_FIELDS_UNREADABLE')
        return self.decide({**result, 'recordingChallengePassed': track.get('challengeVerified') is True,
                'extractedFields': fields, 'tamperingScore': tamper,
                'faceModelsRan': True, 'modelRan': self.ready})

    def decide(self, result):
        from app.services.decision import automatic_decision
        face_threshold = self.pretrained.face_threshold if self.pretrained else self.metadata['face']['threshold']
        live_threshold = self.pretrained.live_threshold if self.pretrained else self.metadata['liveness']['threshold']
        result = {**result, 'signals': self.blocking_signals(result.get('signals', []))}
        return {**result, **automatic_decision(result, self.ready, face_threshold, live_threshold),
                **self.policy_metadata()}

    def document_verify(self, document, doc_type='ID', reference=None):
        signals, fields, versions = [], {}, {}
        ocr_ran, tamper_ran, score = False, False, 1.
        if self.document_ocr is not None and self.document_ocr.loaded:
            result = self.document_ocr.inspect(document)
            fields, signals, versions = result['extractedFields'], list(result['signals']), result['modelVersions']
            ocr_ran = True
        elif self.document_ocr is None and 'ocr' in self.models:
            import torch
            from app.models.preprocessing import image_tensor
            from app.models.network import decode_text
            with torch.inference_mode():
                text = decode_text(self.models['ocr'](image_tensor(document, 'ocr', encoded=True).unsqueeze(0)).argmax(-1)[:, 0].tolist())
            fields = extract_fields(text)
            ocr_ran = True
            versions['ocr'] = self.metadata['ocr']['weightsSha256']
        else:
            signals.append('OCR_MODEL_UNAVAILABLE')
        if doc_type == 'ID' and not all(key in fields for key in ('idNumber', 'dob')):
            signals.append('REQUIRED_ID_FIELDS_UNREADABLE')
        if self.tampering is not None and self.tampering.loaded:
            result = self.tampering.score(document)
            score, tamper_ran = result['tamperingScore'], result['tamperingModelRan']
            signals.extend(result['signals'])
            versions.update(result['modelVersions'])
            if result['tamperingDetected']: score = 1.
        elif self.tampering is None and 'tampering' in self.models:
            import torch
            import math
            from app.models.preprocessing import image_tensor
            with torch.inference_mode():
                score = float(self.models['tampering'](image_tensor(document, 'tampering', encoded=True).unsqueeze(0)).sigmoid().item())
            if not math.isfinite(score):
                raise ValueError('Invalid document model output')
            tamper_ran = True
            versions['tampering'] = self.metadata['tampering']['weightsSha256']
            if score >= self.metadata['tampering']['threshold']:
                score = 1.; signals.append('DOCUMENT_TAMPERING_DETECTED')
        else:
            signals.append('DOCUMENT_AUTHENTICITY_UNAVAILABLE')
        if doc_type != 'ID':
            signals.append('DOCUMENT_TYPE_REQUIRES_SPECIALIST_REVIEW')
        if reference is not None:
            signals.append('SIGNATURE_MODEL_UNAVAILABLE')
        signals = self.blocking_signals(signals)
        accepted = self.documents_ready and not signals and doc_type == 'ID' and reference is None
        return {'extractedFields': fields, 'tamperingScore': score,
                'signatureMatchScore': None, 'signatureModelRan': False,
                'ocrModelRan': ocr_ran, 'tamperingModelRan': tamper_ran,
                'modelRan': bool(ocr_ran and tamper_ran and self.documents_ready and reference is None),
                'documentChecksAccepted': bool(accepted), 'manualReviewRequired': False,
                'verificationDecision': 'APPROVED' if accepted else ('UNAVAILABLE' if not self.documents_ready else 'REJECTED'),
                'signals': sorted(set(signals)), 'modelVersions': versions, **self.policy_metadata()}


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
