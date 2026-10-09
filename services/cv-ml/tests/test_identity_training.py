import argparse
import json

from PIL import Image
import pytest
import torch

from app.models.evaluation import passes_gate
from app.models.network import IdentityModel, decode_text
from app.services.identity import IdentityModels, extract_fields
from app.training.train import load_manifest, train


def manifest(tmp_path):
    rows = []
    for i, split in enumerate(('train', 'validation', 'test')):
        for label in (0, 1):
            name = f'{split}-{label}.png'
            Image.new('RGB', (96, 96), (i * 50 + 20, label * 100, 20)).save(tmp_path / name)
            rows.append({'split': split, 'subjects': [split], 'images': [name, name], 'label': label})
    path = tmp_path / 'samples.jsonl'
    path.write_text('\n'.join(json.dumps(row) for row in rows))
    return path, rows


def test_subject_and_image_leakage_are_rejected(tmp_path):
    path, rows = manifest(tmp_path)
    rows[-1]['subjects'] = ['train']
    path.write_text('\n'.join(json.dumps(row) for row in rows))
    with pytest.raises(ValueError, match='leakage'): load_manifest(path, 'face')
    path, rows = manifest(tmp_path)
    rows[-1]['images'] = rows[0]['images']
    path.write_text('\n'.join(json.dumps(row) for row in rows))
    with pytest.raises(ValueError, match='image content'): load_manifest(path, 'face')


def test_small_smoke_training_writes_artifact_but_cannot_enable_verification(tmp_path):
    # Limit threads for this tiny CPU fixture; restore the host setting afterwards.
    threads = torch.get_num_threads()
    torch.set_num_threads(1)
    try:
        path, _ = manifest(tmp_path)
        output = tmp_path / 'models' / 'face'
        report = train(argparse.Namespace(task='face', manifest=path, output=output, epochs=1,
                       batch_size=2, seed=42, learning_rate=.001, device='cpu'))
        assert not report['accepted']
        assert (output / 'weights.pt').is_file()
        models = IdentityModels(output.parent)
        assert not models.ready and 'face' not in models.models
    finally:
        torch.set_num_threads(threads)


@pytest.mark.parametrize('task', ['face', 'liveness', 'tampering', 'ocr'])
def test_all_network_heads_produce_finite_outputs(task):
    threads = torch.get_num_threads(); torch.set_num_threads(1)
    try:
        model = IdentityModel(task).eval()
        shape = (2, 2, 3, 96, 96) if task == 'face' else (2, 3, 3, 96, 96) if task == 'liveness' else (2, 3, 128, 512) if task == 'ocr' else (2, 3, 96, 96)
        with torch.inference_mode(): output = model(torch.zeros(shape), torch.tensor([[1., 0.], [0., 1.]]))
        assert torch.isfinite(output).all()
        assert output.shape[1] == 2 if task == 'ocr' else output.shape == (2,)
    finally: torch.set_num_threads(threads)


def test_gates_require_measured_counts_and_both_holdouts():
    good = {'tp': 100, 'tn': 100, 'fp': 0, 'fn': 0}
    assert passes_gate('face', {'validation': good, 'test': good})
    assert not passes_gate('face', {'validation': good})
    assert not passes_gate('face', {'validation': good, 'test': {**good, 'fp': 10}})
    assert not passes_gate('tampering', {'validation': good, 'test': {**good, 'fn': 10}})
    assert not passes_gate('face', {'validation': good, 'test': {**good, 'tp': -1}})


def test_ocr_fields_are_explicit_and_dates_valid():
    assert extract_fields('ID=AB123\nDOB=1998-03-04') == {'idNumber': 'AB123', 'dob': '1998-03-04'}
    assert 'dob' not in extract_fields('ID=AB123\nDOB=1998-02-31')
    assert not extract_fields('some unrelated date 1998-03-04')
    assert decode_text([0, 1, 1, 0, 1]) == 'AA'


def test_ocr_loss_backpropagates_finite_gradients():
    from app.training.train import loss_for
    threads = torch.get_num_threads(); torch.set_num_threads(1)
    try:
        model = IdentityModel('ocr')
        output = model(torch.rand(2, 3, 128, 512))
        loss = loss_for('ocr', output, ['ID=ABC123\\nDOB=1998-03-04'.replace('\\n', '\n'), 'ID=DEF456'])
        assert torch.isfinite(loss)
        loss.backward()
        assert all(torch.isfinite(parameter.grad).all() for parameter in model.parameters() if parameter.grad is not None)
    finally: torch.set_num_threads(threads)


def test_artifact_loading_checks_checksum_and_finite_weights(tmp_path):
    import hashlib
    folder = tmp_path / 'face'; folder.mkdir()
    weights = folder / 'weights.pt'
    torch.save(IdentityModel('face').state_dict(), weights)
    counts = {'tp': 100, 'tn': 100, 'fp': 0, 'fn': 0}
    # Fixture reports exercise loader validation, not measured model performance.
    report = {'schemaVersion': 1, 'task': 'face', 'threshold': .5,
              'evaluation': {'validation': counts, 'test': counts},
              'weightsSha256': hashlib.sha256(weights.read_bytes()).hexdigest()}
    metadata = folder / 'evaluation.json'
    metadata.write_text(json.dumps(report))
    registry = IdentityModels(tmp_path)
    assert 'face' in registry.models and not registry.ready
    weights.write_bytes(weights.read_bytes() + b'corruption')
    assert 'face' not in IdentityModels(tmp_path).models
    state = IdentityModel('face').state_dict()
    first = next(iter(state)); state[first].fill_(float('nan'))
    torch.save(state, weights)
    report['weightsSha256'] = hashlib.sha256(weights.read_bytes()).hexdigest()
    metadata.write_text(json.dumps(report))
    assert 'face' not in IdentityModels(tmp_path).models
