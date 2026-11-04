"""Offline PP-OCRv4 mobile inference through pinned RapidOCR, with explicit acceptance."""
import hashlib
from importlib.metadata import version
import json
import math
from pathlib import Path
import threading

from app.models.evaluation import passes_gate
from app.services.document_fields import extract_document_fields
from app.services.faces import rgb_image

MODEL_HASHES = {
    'ch_PP-OCRv4_det_infer.onnx': 'd2a7720d45a54257208b1e13e36a8479894cb74155a5efe29462512d42f49da9',
    'ch_PP-OCRv4_rec_infer.onnx': '48fc40f24f6d2a207a2b1091d3437eb3cc3eb6b676dc3ef9c37384005483683b',
    'ch_ppocr_mobile_v2.0_cls_infer.onnx': 'e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c',
    'ppocr_keys_v1.txt': '28b2362ad4ab2dc38769aa72feb535e3a9ddb3fd2a7585a05920e6393b1dc7f7',
}
PIPELINE = 'ppocrv4-labelled-td3-v1'


class DocumentOcr:
    def __init__(self, acceptance=None):
        self.loaded, self.evaluated, self.error = False, False, None
        self._lock = threading.Lock()
        try:
            import rapidocr
            if version('rapidocr') != '3.4.2':
                raise ValueError('Unsupported OCR runtime')
            directory = Path(rapidocr.__file__).parent / 'models'
            for name, digest in MODEL_HASHES.items():
                if hashlib.sha256((directory / name).read_bytes()).hexdigest() != digest:
                    raise ValueError('OCR model checksum mismatch')
            # Explicit local paths prevent inference startup from downloading replacements.
            self.engine = rapidocr.RapidOCR(params={
                'Det.model_path': str(directory / 'ch_PP-OCRv4_det_infer.onnx'),
                'Cls.model_path': str(directory / 'ch_ppocr_mobile_v2.0_cls_infer.onnx'),
                'Rec.model_path': str(directory / 'ch_PP-OCRv4_rec_infer.onnx'),
                'Rec.rec_keys_path': str(directory / 'ppocr_keys_v1.txt'),
                'EngineConfig.onnxruntime.intra_op_num_threads': 2,
                'EngineConfig.onnxruntime.inter_op_num_threads': 1,
                'Global.log_level': 'error', 'Global.max_side_len': 1600,
                'Det.limit_type': 'max', 'Det.limit_side_len': 1280, 'Det.max_candidates': 300,
            })
            self.loaded = True
            if acceptance and Path(acceptance).exists():
                self.accept(json.loads(Path(acceptance).read_text()))
        except Exception:
            self.error = 'OCR runtime, pinned models or acceptance report unavailable/incompatible'

    def accept(self, report):
        if report.get('pipeline') != PIPELINE or report.get('models') != MODEL_HASHES:
            raise ValueError('OCR acceptance does not match model pipeline')
        if not passes_gate('ocr', report.get('evaluation', {})):
            raise ValueError('OCR independent holdout acceptance failed')
        self.evaluated = True

    def inspect(self, encoded):
        if not self.loaded:
            raise RuntimeError('Document OCR unavailable')
        image = rgb_image(encoded, encoded=True)
        # RapidOCR's ndarray loader expects BGR, like cv2.imread.
        with self._lock:
            output = self.engine(image[:, :, ::-1].copy(), text_score=.8)
        texts = output.txts if output.txts is not None else ()
        scores = output.scores if output.scores is not None else ()
        if len(texts) != len(scores) or len(texts) > 300:
            raise ValueError('Invalid or excessive OCR output')
        lines = []
        for text, score in zip(texts, scores, strict=True):
            if not isinstance(text, str) or not math.isfinite(float(score)) or not 0 <= score <= 1:
                raise ValueError('Invalid OCR output')
            if score >= .8 and len(text) <= 200:
                lines.append(text)
        parsed = extract_document_fields(lines)
        return {**parsed, 'ocrModelRan': True, 'ocrEvaluated': self.evaluated,
                'ocrLineCount': len(lines), 'modelVersions': {'ocr': dict(MODEL_HASHES)},
                'signals': parsed['signals'] + ([] if self.evaluated else ['OCR_HOLDOUT_EVALUATION_REQUIRED'])}
