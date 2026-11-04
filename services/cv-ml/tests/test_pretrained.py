import json
import threading
from io import BytesIO

import numpy as np
import pytest
import torch

from app.services import pretrained
from app.services.identity import IdentityModels


def fixture_models(monkeypatch, spoof=False, mismatch=False):
    models = object.__new__(pretrained.PretrainedFaces)
    models.loaded, models.evaluated, models.error = True, False, None
    models.face_threshold, models.live_threshold = .363, .9
    models.manifest = {'sface': {'sha256': 'fixture'}}
    models._lock = threading.Lock()
    rgb = np.zeros((120, 160, 3), dtype=np.uint8)
    face = {'detection': np.array([40, 30, 50, 60] + [0] * 11, dtype=np.float32)}
    monkeypatch.setattr(pretrained, 'rgb_image', lambda *_args, **_kwargs: rgb)
    monkeypatch.setattr(pretrained, 'locate_face', lambda _: face)
    calls = []
    def embedding(*_):
        calls.append(1)
        return np.array([0., 1.]) if mismatch and len(calls) == 20 else np.array([1., 0.])
    models.embedding = embedding
    class Network(torch.nn.Module):
        def forward(self, tensor):
            logits = torch.tensor([[0., 10., 0.]]).expand(len(tensor), -1).clone()
            if spoof: logits[20] = torch.tensor([10., 0., 0.])
            return logits
    models.spoof_models = [(Network(), 2.7), (Network(), 4.)]
    track = {'observations': [{'image': rgb, 'face': face} for _ in range(30)]}
    return models, track


def test_context_crop_preserves_upstream_bgr_raw_range_and_boundary():
    rgb = np.zeros((100, 100, 3), dtype=np.uint8)
    rgb[:] = [12, 67, 240]
    output = pretrained.context_crop(rgb, [0, 0, 45, 50], 4.)
    assert output.shape == (3, 80, 80) and output.dtype == np.float32
    np.testing.assert_array_equal(output[:, 20, 20], [240., 67., 12.])


@pytest.mark.parametrize('spoof,mismatch', [(False, False), (True, False), (False, True)])
def test_every_recording_frame_must_match_and_pass_anti_spoof(monkeypatch, spoof, mismatch):
    models, track = fixture_models(monkeypatch, spoof, mismatch)
    result = models.score_recording('fixture', track)
    assert result['comparedFrames'] == 30
    assert result['spoofLikely'] is spoof
    assert (result['faceMatchScore'] == 0.) is mismatch
    assert (result['livenessScore'] == 0.) is spoof
    assert 'PRETRAINED_HOLDOUT_EVALUATION_REQUIRED' in result['signals']


def acceptance(models):
    return {'models': models.versions, 'pipeline': 'yunet-sface-minifasnet-v1',
            'thresholds': {'face': .363, 'liveness': .9},
            'evaluation': {task: {split: {'tp': 100, 'tn': 100, 'fp': 0, 'fn': 0}
                                  for split in ('validation', 'test')} for task in ('face', 'liveness')}}


def test_acceptance_binds_actual_models_and_independent_holdout(monkeypatch):
    models, _ = fixture_models(monkeypatch)
    report = acceptance(models)
    report['evaluation']['liveness']['test']['fp'] = 20
    with pytest.raises(ValueError, match='holdout'): models.accept(report)
    report = acceptance(models); report['models'] = {}
    with pytest.raises(ValueError, match='pipeline'): models.accept(report)
    report = acceptance(models); report['thresholds']['face'] = float('nan')
    with pytest.raises(ValueError, match='threshold'): models.accept(report)
    models.accept(acceptance(models))
    assert models.evaluated


def test_face_models_cannot_substitute_for_missing_document_models(monkeypatch):
    face_models, track = fixture_models(monkeypatch)
    models = IdentityModels()
    models.pretrained = face_models
    face_models.accept(acceptance(face_models))
    result = models.recording_kyc('fixture', track, [])
    assert result['faceModelsRan'] and not result['modelRan'] and not models.ready
    assert result['tamperingScore'] == 1. and result['extractedFields'] == {}
    assert 'DOCUMENT_CHECKS_UNAVAILABLE' in result['signals']


def test_missing_weights_fail_closed(tmp_path):
    models = pretrained.PretrainedFaces(tmp_path)
    assert not models.loaded and not models.evaluated and models.error


def test_evaluator_rejects_subject_leakage_before_inference(tmp_path):
    from app.models.evaluate_pretrained import evaluate
    rows = [{'split': split, 'subjectIds': ['same-person'], 'faceMatch': True, 'live': True}
            for split in ('validation', 'test')]
    path = tmp_path / 'samples.jsonl'
    path.write_text('\n'.join(map(json.dumps, rows)))
    with pytest.raises(ValueError, match='disjoint'): evaluate(path, None)


def test_installer_rejects_changed_download_without_replacing_existing_file(tmp_path, monkeypatch):
    from app.models import install_pretrained
    manifest = tmp_path / 'manifest.json'
    manifest.write_text(json.dumps({'models': {'face': {'file': 'model.onnx', 'url': 'https://example.invalid/model',
                                                       'sha256': '0' * 64}}}))
    monkeypatch.setattr(pretrained, 'MANIFEST', manifest)
    monkeypatch.setattr(install_pretrained.urllib.request, 'urlopen', lambda *_args, **_kw: BytesIO(b'changed weights'))
    target = tmp_path / 'models/model.onnx'
    target.parent.mkdir(); target.write_bytes(b'previous weights')
    with pytest.raises(ValueError, match='checksum'): install_pretrained.install(target.parent)
    assert target.read_bytes() == b'previous weights'
    assert not list(target.parent.glob('*.download'))
