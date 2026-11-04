import base64
from datetime import date
from io import BytesIO
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
import numpy as np
from PIL import Image
import pytest

from app.services.document_fields import extract_document_fields, check_digit
from app.services.document_ocr import DocumentOcr, MODEL_HASHES, PIPELINE
from app.services.identity import IdentityModels
from app.api.routes import create_router
from app.storage.challenges import ChallengeStore


TODAY = date(2026, 11, 4)


def test_labelled_fields_and_expiry_checks_do_not_guess_ambiguous_dates():
    result = extract_document_fields(['ID NUMBER: GM123456', 'DATE OF BIRTH', '1990-12-31',
                                      'EXPIRY DATE: 2030-12-31', 'FULL NAME: TEST PERSON'], TODAY)
    assert result['extractedFields']['idNumber'] == 'GM123456'
    assert result['extractedFields']['dob'] == '1990-12-31'
    assert result['signals'] == [] and not result['authenticityEstablished']
    result = extract_document_fields(['ID: GM123456', 'DOB: 01/02/1990', 'EXPIRES: 2020-01-01'], TODAY)
    assert 'dob' not in result['extractedFields']
    assert 'DOCUMENT_EXPIRED' in result['signals'] and 'UNREADABLE_DOB' in result['signals']


def test_conflicting_dates_and_accidental_label_prefixes_are_rejected():
    result = extract_document_fields(['IDENTIFIERFAKE', 'NAMELESS', 'DOB: 1990-01-01', 'DOB: 1991-01-01'], TODAY)
    assert result['extractedFields'] == {}
    assert 'CONFLICTING_DOB' in result['signals']


def passport(expiry='301231'):
    top = 'P<UTOTEST<<PERSON'.ljust(44, '<')
    number, birth, optional = 'AB1234567', '900101', '<' * 14
    second = number + check_digit(number) + 'UTO' + birth + check_digit(birth) + 'F' + expiry + check_digit(expiry) + optional + check_digit(optional)
    second += check_digit(second[:10] + second[13:20] + second[21:43])
    return [top, second]


def test_td3_checks_each_digit_and_composite_without_equating_checksum_to_authenticity():
    lines = passport()
    result = extract_document_fields(lines, TODAY)
    assert result['mrzChecksumValid'] and not result['authenticityEstablished']
    assert result['extractedFields']['dob'] == '1990-01-01'
    assert result['extractedFields']['expiryDate'] == '2030-12-31'
    corrupted = [lines[0], 'Z' + lines[1][1:]]
    assert 'MRZ_CHECK_DIGIT_MISMATCH' in extract_document_fields(corrupted, TODAY)['signals']
    result = extract_document_fields(lines + ['ID NUMBER: DIFFERENT123'], TODAY)
    assert 'idNumber' not in result['extractedFields'] and 'MRZ_PRINTED_FIELD_MISMATCH' in result['signals']
    assert 'MULTIPLE_MRZ_DOCUMENTS' in extract_document_fields(lines + lines, TODAY)['signals']


def test_invalid_dates_and_expired_mrz_never_pass_document_checks():
    result = extract_document_fields(passport('200101'), TODAY)
    assert 'DOCUMENT_EXPIRED' in result['signals']
    result = extract_document_fields(['ID: TEST123', 'DOB: 2990-01-01'], TODAY)
    assert 'INVALID_DATE_OF_BIRTH' in result['signals']
    assert 'dob' not in result['extractedFields']


def fake_ocr(evaluated=False):
    return SimpleNamespace(loaded=True, evaluated=evaluated, error=None,
        inspect=lambda _: {'extractedFields': {'idNumber': 'TEST123', 'dob': '1990-01-01'},
                           'signals': [], 'modelVersions': {'ocr': MODEL_HASHES}})


def test_ocr_alone_cannot_assert_document_authenticity_or_signatures():
    models = IdentityModels()
    models.document_ocr = fake_ocr(evaluated=True)
    result = models.document_verify('fixture', reference='fixture')
    assert result['ocrModelRan'] and not result['modelRan'] and not result['manualReviewRequired']
    assert result['verificationDecision'] == 'UNAVAILABLE'
    assert result['tamperingScore'] == 1. and result['signatureMatchScore'] is None
    assert 'DOCUMENT_AUTHENTICITY_UNAVAILABLE' in result['signals']
    assert 'SIGNATURE_MODEL_UNAVAILABLE' in result['signals']
    assert not models.documents_ready


def test_ocr_acceptance_binds_models_and_measured_counts():
    models = object.__new__(DocumentOcr)
    models.evaluated = False
    report = {'pipeline': PIPELINE, 'models': MODEL_HASHES,
              'evaluation': {split: {'total': 100, 'exactMatches': 95} for split in ('validation', 'test')}}
    models.accept(report)
    assert models.evaluated
    report['evaluation']['test']['exactMatches'] = 90
    with pytest.raises(ValueError, match='holdout'): models.accept(report)
    report['models'] = {}
    with pytest.raises(ValueError, match='pipeline'): models.accept(report)


def test_document_endpoint_is_bounded_and_reports_unavailable_without_manual_review(tmp_path):
    models = IdentityModels()
    models.document_ocr = fake_ocr()
    app = FastAPI(); app.include_router(create_router(ChallengeStore(str(tmp_path / 'state.sqlite')), models))
    image = BytesIO(); Image.fromarray(np.random.default_rng(1).integers(0, 255, (100, 100, 3), dtype=np.uint8)).save(image, format='PNG')
    encoded = base64.b64encode(image.getvalue()).decode()
    client = TestClient(app)
    response = client.post('/cv/document-verify', json={'documentImage': encoded, 'docType': 'ID'})
    assert response.status_code == 200
    assert not response.json()['manualReviewRequired'] and not response.json()['modelRan']
    assert response.json()['verificationDecision'] == 'UNAVAILABLE'
    assert response.json()['extractedFields']['idNumber'] == 'TEST123'
    assert client.post('/cv/document-verify', json={'documentImage': encoded, 'docType': 'UNKNOWN'}).status_code == 422
    assert client.post('/cv/document-verify', json={'documentImage': 'invalid'}).status_code == 422


def test_document_holdout_refuses_subject_and_content_leakage(tmp_path):
    import json
    from app.models.evaluate_documents import evaluate
    path = tmp_path / 'holdout.jsonl'
    rows = [{'split': split, 'subjectIds': ['same-person'], 'document': 'sample.png',
             'expectedFields': {'idNumber': 'TEST123', 'dob': '1990-01-01'}} for split in ('validation', 'test')]
    path.write_text('\n'.join(map(json.dumps, rows)))
    with pytest.raises(ValueError, match='disjoint'): evaluate(path, fake_ocr())
    rows[1]['subjectIds'] = ['another-person']
    (tmp_path / 'sample.png').write_bytes(b'contract fixture only')
    path.write_text('\n'.join(map(json.dumps, rows)))
    with pytest.raises(ValueError, match='Duplicate'): evaluate(path, fake_ocr())


def test_low_confidence_or_nonfinite_ocr_does_not_become_valid_fields():
    models = object.__new__(DocumentOcr)
    models.loaded, models.evaluated, models._lock = True, False, __import__('threading').Lock()
    output = BytesIO(); Image.new('RGB', (100, 100), 'white').save(output, format='PNG')
    encoded = base64.b64encode(output.getvalue()).decode()
    models.engine = lambda *_args, **_kwargs: SimpleNamespace(txts=['ID: TEST123'], scores=[.5])
    assert models.inspect(encoded)['extractedFields'] == {}
    models.engine = lambda *_args, **_kwargs: SimpleNamespace(txts=['ID: TEST123'], scores=[float('nan')])
    with pytest.raises(ValueError, match='Invalid OCR'): models.inspect(encoded)
