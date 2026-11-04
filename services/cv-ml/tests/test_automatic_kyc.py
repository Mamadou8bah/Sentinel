"""Decision contracts use explicit fixtures, not claims of model accuracy."""
import base64
from copy import deepcopy
from io import BytesIO

import pytest
from PIL import Image

from app.services.decision import automatic_decision
from app.services.tampering import TamperingModel, PIPELINE, prepare_tensor


def evidence():
    return {'modelRan': True, 'signals': [], 'faceMatchScore': .9, 'livenessScore': .99,
            'spoofLikely': False, 'documentChecksAccepted': True, 'recordingChallengePassed': True,
            'comparedFrames': 36, 'extractedFields': {'idNumber': 'TEST123', 'dob': '1990-01-01',
                                                  'expiryDate': '2099-01-01'}}


def decide(result, ready=True):
    return automatic_decision(result, ready, .363, .9)


def test_verified_recording_and_document_can_approve_automatically():
    assert decide(evidence()) == {'verificationDecision': 'APPROVED', 'automaticApproval': True,
                                  'decisionReasons': []}


@pytest.mark.parametrize('field,value,reason', [
    ('faceMatchScore', .2, 'FACE_MATCH_REJECTED'),
    ('faceMatchScore', float('nan'), 'FACE_MATCH_REJECTED'),
    ('livenessScore', float('inf'), 'LIVENESS_REJECTED'),
    ('livenessScore', True, 'LIVENESS_REJECTED'),
    ('spoofLikely', True, 'PRESENTATION_ATTACK_SUSPECTED'),
    ('documentChecksAccepted', False, 'DOCUMENT_CHECKS_REJECTED'),
    ('recordingChallengePassed', False, 'RECORDING_CHALLENGE_NOT_CONFIRMED'),
    ('comparedFrames', 24, 'RECORDING_CHALLENGE_NOT_CONFIRMED'),
])
def test_bad_evidence_cannot_be_approved(field, value, reason):
    result = evidence(); result[field] = value
    outcome = decide(result)
    assert outcome['verificationDecision'] == 'REJECTED' and not outcome['automaticApproval']
    assert reason in outcome['decisionReasons']


@pytest.mark.parametrize('fields', [{}, {'dob': '1990-01-01'},
    {'idNumber': 123, 'dob': '1990-01-01', 'expiryDate': '2099-01-01'},
    {'idNumber': 'TEST123', 'dob': '1990-01-01', 'expiryDate': '2000-01-01'},
    {'idNumber': 'TEST123', 'dob': '2990-01-01', 'expiryDate': '2999-01-01'}])
def test_missing_or_expired_document_fields_reject(fields):
    result = evidence(); result['extractedFields'] = fields
    assert decide(result)['verificationDecision'] == 'REJECTED'


def test_missing_evaluation_is_unavailable_and_never_an_identity_rejection():
    result = evidence()
    assert decide(result, ready=False)['verificationDecision'] == 'UNAVAILABLE'
    result.update(modelRan=False, signals=['OCR_MODEL_UNAVAILABLE'])
    assert decide(result)['verificationDecision'] == 'UNAVAILABLE'
    result['signals'] = ['DOCUMENT_TAMPERING_DETECTED']
    assert decide(result)['verificationDecision'] == 'REJECTED'


def test_pscc_preprocessing_preserves_rgb_unit_scale_and_bounds_size():
    output = BytesIO(); Image.new('RGB', (1801, 100), (255, 0, 0)).save(output, format='PNG')
    tensor = prepare_tensor(base64.b64encode(output.getvalue()).decode())
    assert tensor.shape == (1, 3, 64, 1024)
    assert tensor[0, :, 0, 0].tolist() == [1., 0., 0.]
    assert tensor[0, :, -1, -1].tolist() == [1., 1., 1.]


def test_pscc_acceptance_requires_hashes_pipeline_and_independent_metrics():
    model = object.__new__(TamperingModel)
    model.manifest = {'HRNet': {'sha256': 'a' * 64}, 'DetectionHead': {'sha256': 'b' * 64}}
    model.evaluated = False
    report = {'pipeline': PIPELINE, 'models': model.versions, 'threshold': .4,
              'evaluation': {split: {'tp': 100, 'tn': 100, 'fp': 0, 'fn': 0}
                             for split in ('validation', 'test')}}
    model.accept(report)
    assert model.evaluated and model.threshold == .4
    for bad in [dict(report, models={}), dict(report, pipeline='different'),
                dict(report, threshold=float('nan')), dict(report, evaluation={})]:
        with pytest.raises(ValueError): model.accept(bad)
    bad = deepcopy(report); bad['evaluation']['test']['fn'] = 10
    with pytest.raises(ValueError, match='holdout'): model.accept(bad)


def test_missing_pscc_weights_cannot_assert_readiness(tmp_path):
    model = TamperingModel(tmp_path)
    assert not model.loaded and not model.evaluated and model.error


@pytest.mark.parametrize('case', ['leakage', 'duplicate', 'outside'])
def test_document_evaluation_rejects_bad_holdouts_before_inference(tmp_path, case):
    import json
    from app.models.evaluate_tampering import evaluate
    first, second = tmp_path / 'first.jpg', tmp_path / 'second.jpg'
    first.write_bytes(b'first'); second.write_bytes(b'first' if case == 'duplicate' else b'second')
    rows = [{'scope': 'identity-documents', 'split': split, 'subjects': [subject],
             'document': name, 'label': 0} for split, subject, name in [
                 ('validation', 'a', first.name), ('test', 'a' if case == 'leakage' else 'b',
                  '../outside.jpg' if case == 'outside' else second.name)]]
    manifest = tmp_path / 'tampering.jsonl'
    manifest.write_text('\n'.join(map(json.dumps, rows)))
    with pytest.raises(ValueError, match={'leakage': 'leakage', 'duplicate': 'Duplicate', 'outside': 'outside'}[case]):
        evaluate(manifest, None)
