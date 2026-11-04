"""Measure PSCC on labelled ID-document holdouts without retraining or invented acceptance."""
import argparse
import base64
import hashlib
import json
import math
from pathlib import Path

from app.models.evaluation import binary_metrics
from app.models.public_data import checksum
from app.services.tampering import TamperingModel, PIPELINE


def evaluate(dataset, model, threshold=.5):
    if type(threshold) not in (float, int) or not math.isfinite(threshold) or not 0 < threshold < 1:
        raise ValueError('Tampering threshold must be finite and between zero and one')
    dataset = Path(dataset)
    rows = [json.loads(line) for line in dataset.read_text(encoding='utf-8-sig').splitlines() if line.strip()]
    if not rows:
        raise ValueError('Labelled ID-document dataset is empty')
    subjects = {'validation': set(), 'test': set()}
    measurements = {split: ([], []) for split in subjects}
    inputs, hashes = [], set()
    for row in rows:
        if row.get('scope') != 'identity-documents' or row.get('split') not in subjects:
            raise ValueError('Use identity-documents scope and validation/test splits')
        if not isinstance(row.get('subjects'), list) or not row['subjects'] or not all(isinstance(s, str) and s for s in row['subjects']):
            raise ValueError('Include all person/document source identities in subjects')
        if type(row.get('label')) is not int or row['label'] not in (0, 1):
            raise ValueError('Use label 0 for genuine, 1 for tampered documents')
        subjects[row['split']].update(row['subjects'])
        name = row.get('document')
        if not isinstance(name, str): raise ValueError('Missing document path')
        path = (dataset.parent / name).resolve()
        if Path(name).is_absolute() or not path.is_relative_to(dataset.parent.resolve()) or not path.is_file():
            raise ValueError('Document path missing or outside dataset directory')
        digest = checksum(path)
        if digest in hashes: raise ValueError('Duplicate document content in holdouts')
        hashes.add(digest); inputs.append(path)
    if subjects['validation'] & subjects['test']:
        raise ValueError('Validation/test identity or document source leakage')
    for index, (row, path) in enumerate(zip(rows, inputs, strict=True), 1):
        result = model.score(base64.b64encode(path.read_bytes()).decode())
        labels, scores = measurements[row['split']]
        labels.append(row['label']); scores.append(result['tamperingScore'])
        print(f'PSCC document evaluation {index}/{len(rows)}', flush=True)
    return {'pipeline': PIPELINE, 'models': model.versions, 'threshold': threshold,
            'evaluation': {split: binary_metrics(*values, threshold) for split, values in measurements.items()},
            'scope': 'identity-documents', 'datasetSha256': hashlib.sha256(dataset.read_bytes()).hexdigest(),
            'datasetContentSha256': hashlib.sha256('\n'.join(sorted(hashes)).encode()).hexdigest()}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset', type=Path, required=True)
    parser.add_argument('--models', type=Path, default=Path('artifacts/pscc'))
    parser.add_argument('--threshold', type=float, default=.5)
    args = parser.parse_args()
    if not args.dataset.is_file(): parser.error('Labelled ID-document manifest missing; see docs/automatic-kyc.md')
    import torch
    torch.set_num_threads(2)
    model = TamperingModel(args.models)
    if not model.loaded: parser.error(model.error)
    try:
        report = evaluate(args.dataset, model, args.threshold)
        candidate = args.models / 'evaluation-candidate.json'
        candidate.write_text(json.dumps(report, indent=2, allow_nan=False) + '\n', encoding='utf-8')
        model.accept(report)
        candidate.replace(args.models / 'acceptance.json')
    except (OSError, ValueError) as error:
        parser.exit(1, f'Evaluation did not establish acceptance: {error}\n')
    print('Independent document-tampering gates passed; acceptance.json installed')
