import hashlib
from io import BytesIO
import json
from pathlib import Path
import tarfile
from types import SimpleNamespace

import pytest

from app.models import public_data
from app.models.evaluate_public import AcquisitionError, evaluate, load_rows, select_rows, normal_text, edit_distance
from app.models import evaluate_public
from app.models.import_public import convert
from app.services.document_ocr import DocumentOcr
from app.services.pretrained import PretrainedFaces


def put(path, content=b'fixture'):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def test_official_lfw_pair_order_and_folds_are_preserved(tmp_path):
    for person in ('A', 'B', 'C', 'D'):
        for index in (1, 2): put(tmp_path / f'lfw/{person}/{person}_{index:04d}.jpg')
    (tmp_path / 'pairs.txt').write_text('2 1\nA 1 2\nA 1 B 1\nC 1 2\nC 1 D 1\n')
    rows = public_data.lfw_pairs(tmp_path)
    assert [row['label'] for row in rows] == [1, 0, 1, 0]
    assert [row['fold'] for row in rows] == [0, 0, 1, 1]
    assert all(row['split'] == 'benchmark' and 'instructions' not in row for row in rows)
    (tmp_path / 'pairs.txt').write_text('2 1\nA 1 2\n')
    with pytest.raises(ValueError, match='count'): public_data.lfw_pairs(tmp_path)


def test_partial_binary_benchmarks_are_balanced_and_reproducible():
    rows = [{'label': label, 'id': index} for label in (0, 1) for index in range(100)]
    selected = select_rows(rows, 40, 'face', 42)
    assert sum(row['label'] for row in selected) == 20 and len(selected) == 40
    assert selected == select_rows(rows, 40, 'face', 42)
    assert selected != select_rows(rows, 40, 'face', 43)


def test_archive_extraction_rejects_traversal_and_links(tmp_path):
    for filename, kind in [('../escape.jpg', tarfile.REGTYPE), ('lfw/A/A_0001.jpg', tarfile.SYMTYPE)]:
        archive = tmp_path / 'unsafe.tar.gz'
        with tarfile.open(archive, 'w:gz') as output:
            item = tarfile.TarInfo(filename); item.type = kind
            if kind == tarfile.SYMTYPE:
                item.linkname = '../../escape'
                output.addfile(item)
            else:
                item.size = 4; output.addfile(item, BytesIO(b'data'))
        with pytest.raises(ValueError, match='Unsafe'): public_data.extract_lfw(archive, tmp_path / 'output')
    assert not (tmp_path / 'escape.jpg').exists()


def test_failed_download_checksum_preserves_existing_target(tmp_path, monkeypatch):
    class Response(BytesIO):
        status, headers = 200, {'Content-Length': '7'}
    monkeypatch.setattr(public_data.urllib.request, 'urlopen', lambda *_a, **_k: Response(b'changed'))
    target = tmp_path / 'dataset.bin'; target.write_bytes(b'previous')
    with pytest.raises(ValueError, match='checksum'):
        public_data.download('https://example.invalid/data', target, '0' * 64)
    assert target.read_bytes() == b'previous' and not target.with_suffix('.bin.part').exists()


def test_range_download_resumes_prefix_and_verifies_complete_checksum(tmp_path, monkeypatch):
    content = b'complete archive fixture'
    class Response(BytesIO):
        status = 206
    def request(req, **_kwargs):
        bounds = req.headers['Range'].removeprefix('bytes=').split('-')
        start, end = map(int, bounds)
        response = Response(content[start:end + 1])
        response.headers = {'Content-Range': f'bytes {start}-{end}/{len(content)}'}
        return response
    monkeypatch.setattr(public_data.urllib.request, 'urlopen', request)
    target = tmp_path / 'archive.tgz'
    target.with_suffix('.tgz.part').write_bytes(content[:8])
    public_data.download_parallel('https://example.invalid/data', target, hashlib.sha256(content).hexdigest())
    assert target.read_bytes() == content


def manifest(tmp_path, task='face'):
    rows = []
    for index, label in enumerate((0, 1)):
        for side in ('a', 'b'): put(tmp_path / f'{index}{side}.jpg', f'{index}{side}'.encode())
        rows.append({'split': 'benchmark', 'subjects': [f'person-{index}'],
                     'images': [f'{index}a.jpg', f'{index}b.jpg'], 'label': label})
    path = tmp_path / 'samples.jsonl'
    path.write_text('\n'.join(map(json.dumps, rows)))
    return path, rows


def test_capture_failures_are_reported_and_public_reports_cannot_enable_kyc(tmp_path):
    path, _rows = manifest(tmp_path)
    class Scorer:
        def score(self, row):
            if row['label'] == 0: raise AcquisitionError('No usable face')
            return {'score': .99}
    report = evaluate(path, 'face', Scorer(), .363)
    assert not report['grantsKycAcceptance'] and not report['recordingChallengesEvaluated']
    assert report['acquisitionFailuresByLabel'] == {'0': 1}
    assert report['evaluation']['benchmark']['overall']['tn'] == 1
    assert report['evaluation']['benchmark']['inferenceOnly']['specificity'] is None
    with pytest.raises(ValueError): PretrainedFaces(tmp_path).accept(report)
    with pytest.raises(ValueError): object.__new__(DocumentOcr).accept(report)


def test_invalid_model_outputs_abort_rather_than_become_successful_rejections(tmp_path):
    path, _rows = manifest(tmp_path)
    with pytest.raises(ValueError, match='invalid component score'):
        evaluate(path, 'face', SimpleNamespace(score=lambda _: {'score': float('nan')}), .363)


def test_subject_and_file_content_leakage_are_rejected(tmp_path):
    path, rows = manifest(tmp_path)
    rows[0]['split'], rows[1]['split'] = 'validation', 'test'
    rows[1]['subjects'] = rows[0]['subjects']
    path.write_text('\n'.join(map(json.dumps, rows)))
    with pytest.raises(ValueError, match='identities overlap'): load_rows(path, 'face')
    rows[1]['subjects'] = ['different-person']
    path.write_text('\n'.join(map(json.dumps, rows)))
    (tmp_path / '1a.jpg').write_bytes((tmp_path / '0a.jpg').read_bytes())
    with pytest.raises(ValueError, match='contents overlap'):
        evaluate(path, 'face', SimpleNamespace(score=lambda _: {'score': .5}), .363)


def test_csv_import_preserves_labels_and_excludes_training(tmp_path):
    for name in ('real.mov', 'spoof.mov'): put(tmp_path / name)
    csv = tmp_path / 'protocol.csv'
    csv.write_text('split,subject,video,label\ndevel,A,real.mov,1\ntest,B,spoof.mov,0\ntrain,C,real.mov,1\n')
    output = tmp_path / 'spoof.jsonl'
    convert(csv, output, 'spoof')
    rows = load_rows(output, 'spoof')
    assert [row['label'] for row in rows] == [1, 0]
    assert [row['split'] for row in rows] == ['validation', 'test']
    assert all('instructions' not in row for row in rows)
    with pytest.raises(ValueError, match='already exists'): convert(csv, output, 'spoof')


def test_manifest_paths_cannot_escape_dataset_directory(tmp_path):
    root = tmp_path / 'dataset'; root.mkdir()
    put(tmp_path / 'outside.jpg')
    path = root / 'unsafe.jsonl'
    path.write_text(json.dumps({'split': 'benchmark', 'subjects': ['A'], 'label': 1,
                                'images': ['../outside.jpg', '../outside.jpg']}))
    with pytest.raises(ValueError, match='outside'): load_rows(path, 'face')


def test_ocr_text_normalisation_keeps_case_and_punctuation_significant():
    assert normal_text(' A\n  B ') == 'A B'
    assert normal_text('e\u0301') == 'é'
    assert edit_distance('ABC', 'abc') == 3
    assert edit_distance('AB-123', 'AB123') == 1


def test_passive_video_benchmark_does_not_fabricate_recording_challenges(tmp_path, monkeypatch):
    import cv2
    import numpy as np
    path = tmp_path / 'static.mp4'
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*'mp4v'), 10., (160, 128))
    assert writer.isOpened()
    for _ in range(90): writer.write(np.full((128, 160, 3), 128, dtype=np.uint8))
    writer.release()
    monkeypatch.setattr(evaluate_public, 'locate_face', lambda *_args, **_kw: {'detection': np.zeros(15)})
    monkeypatch.setattr('app.services.recording.analyze_recording', lambda *_: pytest.fail('Public videos do not carry app-issued prompts'))
    observations = evaluate_public.passive_observations(path)
    assert 25 <= len(observations) <= 48
    assert all(set(item) == {'image', 'face'} for item in observations)
