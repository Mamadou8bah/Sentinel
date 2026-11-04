"""Measure frozen thresholds on disjoint validation/test recordings; never train weights."""
import argparse
import base64
import hashlib
import json
from pathlib import Path

from app.models.evaluation import binary_metrics, passes_gate
from app.services.pretrained import PretrainedFaces
from app.services.recording import recording_bytes, analyze_recording


def evaluate(dataset, models, face_threshold=.363, live_threshold=.9):
    dataset = Path(dataset)
    rows = [json.loads(line) for line in dataset.read_text().splitlines() if line.strip()]
    subjects = {'validation': set(), 'test': set()}
    evidence, documents = set(), {}
    measurements = {task: {split: ([], []) for split in subjects} for task in ('face', 'liveness')}
    # Preflight all identities before performing expensive inference.
    for row in rows:
        split = row['split']
        if split not in subjects or not isinstance(row['subjectIds'], list) or not row['subjectIds'] or not all(isinstance(x, str) and x for x in row['subjectIds']):
            raise ValueError('Each row needs validation/test split and all involved subjectIds')
        subjects[split].update(row['subjectIds'])
        if any(type(row[key]) is not bool for key in ('faceMatch', 'live')):
            raise ValueError('faceMatch/live must be boolean ground-truth labels')
    if subjects['validation'] & subjects['test']:
        raise ValueError('Validation/test subjects must be disjoint')
    for index, row in enumerate(rows, 1):
        def encoded(key):
            path = (dataset.parent / row[key]).resolve()
            # Both file formats are validated by the same runtime pipeline.
            return base64.b64encode(path.read_bytes()).decode('ascii')
        document, video = encoded('document'), encoded('video')
        document_digest = hashlib.sha256(document.encode('ascii')).hexdigest()
        if document_digest in documents and documents[document_digest] != row['split']:
            raise ValueError('Document content overlaps validation/test')
        documents[document_digest] = row['split']
        raw, extension = recording_bytes(video)
        digest = hashlib.sha256(raw).hexdigest()
        if digest in evidence:
            raise ValueError('Duplicate recording in evaluation')
        evidence.add(digest)
        try:
            track = analyze_recording(raw, extension, row['instructions'])
            result = models.score_recording(document, track)
            face_score, live_score = result['faceCosineSimilarity'], result['antiSpoofRealScore']
        except ValueError:
            # Rejected captures count as rejected, including false rejects of genuine users.
            face_score = live_score = 0.
        for task, label, score in [('face', row['faceMatch'], face_score), ('liveness', row['live'], live_score)]:
            labels, scores = measurements[task][row['split']]
            labels.append(int(label)); scores.append(score)
        print(f'Evaluated recording {index}/{len(rows)}', flush=True)
    thresholds = {'face': face_threshold, 'liveness': live_threshold}
    evaluation = {task: {split: binary_metrics(*values, thresholds[task]) for split, values in splits.items()}
                  for task, splits in measurements.items()}
    return {'pipeline': 'yunet-sface-minifasnet-v1', 'models': models.versions,
            'thresholds': thresholds, 'evaluation': evaluation,
            'datasetSha256': hashlib.sha256(dataset.read_bytes()).hexdigest(),
            'accepted': all(passes_gate(task, report) for task, report in evaluation.items())}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset', required=True, type=Path)
    parser.add_argument('--models', default='artifacts/pretrained', type=Path)
    parser.add_argument('--face-threshold', type=float, default=.363)
    parser.add_argument('--live-threshold', type=float, default=.9)
    args = parser.parse_args()
    models = PretrainedFaces(args.models)
    if not models.loaded:
        raise SystemExit('Install pretrained models first')
    report = evaluate(args.dataset, models, args.face_threshold, args.live_threshold)
    # Validate thresholds and independent metrics before installing an acceptance report.
    report_path = args.models / 'evaluation-candidate.json'
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    models.accept(report)
    report_path.replace(args.models / 'acceptance.json')
    print('Holdout gates passed; acceptance.json installed')
