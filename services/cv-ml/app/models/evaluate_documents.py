"""Evaluate pretrained OCR on consented, labelled, disjoint document holdouts."""
import argparse
import base64
import hashlib
import json
from pathlib import Path

from app.services.document_ocr import DocumentOcr, MODEL_HASHES, PIPELINE


def evaluate(dataset, ocr):
    dataset = Path(dataset)
    rows = [json.loads(line) for line in dataset.read_text(encoding='utf-8-sig').splitlines() if line.strip()]
    subjects = {'validation': set(), 'test': set()}
    counts = {split: {'total': 0, 'exactMatches': 0} for split in subjects}
    for row in rows:
        if row['split'] not in subjects or not isinstance(row['subjectIds'], list) or not row['subjectIds']:
            raise ValueError('Use validation/test split and nonempty subjectIds')
        if not all(isinstance(subject, str) and subject for subject in row['subjectIds']):
            raise ValueError('Invalid subject IDs')
        expected = row['expectedFields']
        if not isinstance(expected, dict) or not all(key in expected for key in ('idNumber', 'dob')):
            raise ValueError('Each document needs ground-truth idNumber and dob')
        if not set(expected) <= {'idNumber', 'dob', 'expiryDate', 'name'} or not all(isinstance(v, str) and v for v in expected.values()):
            raise ValueError('Unsupported ground-truth field')
        subjects[row['split']].update(row['subjectIds'])
    if subjects['validation'] & subjects['test']:
        raise ValueError('Document holdout subjects must be disjoint')
    hashes = set()
    for index, row in enumerate(rows, 1):
        raw = (dataset.parent / row['document']).read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        if digest in hashes:
            raise ValueError('Duplicate document content in evaluation')
        hashes.add(digest)
        expected = row['expectedFields']
        try:
            fields = ocr.inspect(base64.b64encode(raw).decode())['extractedFields']
            exact = all(fields.get(key) == value for key, value in expected.items())
        except ValueError:
            exact = False
        counts[row['split']]['total'] += 1
        counts[row['split']]['exactMatches'] += int(exact)
        print(f'Evaluated document {index}/{len(rows)}', flush=True)
    return {'pipeline': PIPELINE, 'models': MODEL_HASHES, 'evaluation': counts,
            'datasetSha256': hashlib.sha256(dataset.read_bytes()).hexdigest()}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset', required=True, type=Path)
    parser.add_argument('--output', default='artifacts/pretrained', type=Path)
    args = parser.parse_args()
    if not args.dataset.is_file():
        parser.error(f'Dataset manifest not found: {args.dataset.resolve()}. Collect labelled document photos and create the JSONL manifest first. See docs/pretrained-kyc.md.')
    if not args.dataset.read_text(encoding='utf-8-sig').strip():
        parser.error('The dataset manifest is empty. Add labelled document samples before evaluation.')
    ocr = DocumentOcr()
    if not ocr.loaded:
        raise SystemExit(ocr.error)
    report = evaluate(args.dataset, ocr)
    args.output.mkdir(parents=True, exist_ok=True)
    candidate = args.output / 'ocr-evaluation-candidate.json'
    candidate.write_text(json.dumps(report, indent=2) + '\n')
    ocr.accept(report)
    candidate.replace(args.output / 'ocr-acceptance.json')
    print('OCR holdout gates passed; ocr-acceptance.json installed')
