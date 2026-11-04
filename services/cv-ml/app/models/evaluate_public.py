"""Offline component benchmarks. Reports never enable automatic KYC verification."""
import argparse
import base64
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
import random
import time
import unicodedata

import numpy as np

from app.models.evaluation import binary_metrics
from app.models.public_data import checksum
from app.services.faces import locate_face, rgb_image


class AcquisitionError(ValueError):
    """A capture could not be acquired; report it instead of dropping the example."""


def acquisition_reason(error):
    text = str(error).lower()
    if 'exactly one' in text: return 'FACE_MISSING_OR_MULTIPLE'
    if 'too small' in text or 'outside' in text: return 'FACE_SMALL_OR_CLIPPED'
    if 'blurred' in text or 'detail' in text: return 'FACE_LOW_DETAIL'
    if 'landmark' in text: return 'FACE_LANDMARKS_INSUFFICIENT'
    if 'video' in text or 'fps' in text: return 'INVALID_VIDEO_CAPTURE'
    if 'dimension' in text: return 'IMAGE_DIMENSIONS'
    return 'CAPTURE_INVALID'


def local_file(root, name):
    if not isinstance(name, str) or not name:
        raise ValueError('Each sample needs a relative local file path')
    path = Path(name)
    resolved = (root / path).resolve()
    if path.is_absolute() or not resolved.is_relative_to(root.resolve()) or not resolved.is_file():
        raise ValueError('Sample is missing or outside the manifest directory: ' + name)
    return resolved


def load_rows(dataset, task):
    dataset = Path(dataset)
    rows = []
    for number, line in enumerate(dataset.read_text(encoding='utf-8-sig').splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
            if row['split'] not in ('benchmark', 'validation', 'test'):
                raise ValueError('Use benchmark, validation or test split')
            if not isinstance(row['subjects'], list) or not row['subjects'] or not all(isinstance(s, str) and s for s in row['subjects']):
                raise ValueError('List every involved subject identity')
            if task in ('face', 'spoof') and (type(row['label']) is not int or row['label'] not in (0, 1)):
                raise ValueError('label must be integer 0 or 1')
            if task == 'face':
                if not isinstance(row['images'], list) or len(row['images']) != 2:
                    raise ValueError('Face verification needs two images')
                paths = [local_file(dataset.parent, name) for name in row['images']]
            elif task == 'spoof':
                paths = [local_file(dataset.parent, row['video'])]
            else:
                paths = [local_file(dataset.parent, row['document'])]
                text, fields = row.get('expectedText'), row.get('expectedFields')
                if (text is None) == (fields is None):
                    raise ValueError('Provide exactly one of expectedText or expectedFields')
                if text is not None and (not isinstance(text, str) or not 1 <= len(text) <= 1000):
                    raise ValueError('expectedText must contain 1–1000 characters')
                if fields is not None and (not isinstance(fields, dict) or not fields
                        or not set(fields) <= {'idNumber', 'dob', 'expiryDate', 'name'}
                        or not all(isinstance(value, str) and value for value in fields.values())):
                    raise ValueError('Unsupported expectedFields')
            row['_paths'] = paths
            rows.append(row)
        except (KeyError, TypeError, ValueError) as error:
            raise ValueError(f'Manifest line {number}: {error}') from None
    if not rows:
        raise ValueError('The component dataset is empty')
    # Official LFW folds deliberately remain a benchmark, not disjoint identity holdouts.
    subjects = defaultdict(set)
    content_splits = defaultdict(set)
    for row in rows:
        subjects[row['split']].update(row['subjects'])
        for path in row['_paths']:
            content_splits[path].add(row['split'])
    if subjects['validation'] & subjects['test']:
        raise ValueError('Validation/test subject identities overlap')
    if any({'validation', 'test'} <= splits for splits in content_splits.values()):
        raise ValueError('Validation/test files overlap')
    return rows


def select_rows(rows, limit, task, seed):
    if limit is None or limit >= len(rows):
        return list(rows)
    if limit < 2:
        raise ValueError('Use a limit of at least two samples')
    rng = random.Random(seed)
    if task == 'ocr':
        selected = set(rng.sample(range(len(rows)), limit))
    else:
        groups = [[index for index, row in enumerate(rows) if row['label'] == label] for label in (0, 1)]
        each = min(limit // 2, *(len(group) for group in groups))
        if each == 0:
            raise ValueError('A partial binary benchmark must contain both labels')
        selected = set(rng.sample(groups[0], each) + rng.sample(groups[1], each))
    return [row for index, row in enumerate(rows) if index in selected]


def normal_text(value):
    return unicodedata.normalize('NFC', ' '.join(value.split()))


def edit_distance(first, second):
    previous = list(range(len(second) + 1))
    for index, left in enumerate(first, 1):
        current = [index]
        for column, right in enumerate(second, 1):
            current.append(min(current[-1] + 1, previous[column] + 1, previous[column - 1] + (left != right)))
        previous = current
    return previous[-1]


def passive_observations(path):
    """First nine seconds at four FPS; no pretend head-turn/challenge annotations."""
    import cv2
    started = time.monotonic()
    capture = cv2.VideoCapture(str(path), cv2.CAP_FFMPEG,
                               [cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 2000, cv2.CAP_PROP_READ_TIMEOUT_MSEC, 2000])
    observations = []
    try:
        fps = float(capture.get(cv2.CAP_PROP_FPS))
        if not capture.isOpened() or not math.isfinite(fps) or not 8 <= fps <= 60:
            raise AcquisitionError('Video cannot be decoded at 8–60 FPS')
        previous, next_sample = -1., 0.
        for index in range(600):
            if time.monotonic() - started > 20:
                raise AcquisitionError('Video processing budget exceeded')
            ok, bgr = capture.read()
            if not ok:
                break
            if max(bgr.shape[:2]) > 1920 or bgr.shape[0] * bgr.shape[1] > 2_073_600:
                raise AcquisitionError('Video dimensions exceed component benchmark limits')
            timestamp = index / fps
            previous = timestamp
            if timestamp >= 9:
                break
            if timestamp + 1e-6 >= next_sample:
                scale = min(1., 640 / max(bgr.shape[:2]))
                if scale < 1:
                    bgr = cv2.resize(bgr, (round(bgr.shape[1] * scale), round(bgr.shape[0] * scale)))
                rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                try:
                    face = locate_face(rgb, minimum=64)
                except ValueError as error:
                    raise AcquisitionError(str(error)) from None
                observations.append({'image': rgb, 'face': face})
                next_sample += .25
        if previous < 8.5 or len(observations) < 25:
            raise AcquisitionError('At least 8.5 seconds of clear video are required')
        return observations
    finally:
        capture.release()


class ComponentScorer:
    def __init__(self, task, models=None, ocr=None):
        self.task, self.models, self.ocr = task, models, ocr
        self.embeddings = {}

    def face_embedding(self, path):
        if path not in self.embeddings:
            try:
                rgb = rgb_image(path)
                face = locate_face(rgb)
            except (OSError, ValueError) as error:
                raise AcquisitionError(str(error)) from None
            self.embeddings[path] = self.models.embedding(rgb, face)
        return self.embeddings[path]

    def score(self, row):
        if self.task == 'face':
            first, second = (self.face_embedding(path) for path in row['_paths'])
            return {'score': float(np.clip(np.dot(first, second), -1., 1.))}
        if self.task == 'spoof':
            observations = passive_observations(row['_paths'][0])
            prediction = self.models.anti_spoof(observations)
            score = float(prediction[:, 1].min()) if bool(np.all(prediction.argmax(axis=1) == 1)) else 0.
            return {'score': score, 'sampledFrames': len(observations)}
        raw = row['_paths'][0].read_bytes()
        encoded = base64.b64encode(raw).decode('ascii')
        if 'expectedText' in row:
            expected = normal_text(row['expectedText'])
            predicted = normal_text(' '.join(self.ocr.read_lines(encoded)))
            if len(predicted) > 5000:
                raise ValueError('Excessive OCR transcription')
            return {'exact': predicted == expected, 'characterErrors': edit_distance(expected, predicted),
                    'characters': len(expected)}
        fields = self.ocr.inspect(encoded)['extractedFields']
        return {'exact': all(fields.get(key) == value for key, value in row['expectedFields'].items())}


def metrics(labels, scores, threshold):
    counts = binary_metrics(labels, scores, threshold)
    def ratio(top, bottom):
        return top / bottom if bottom else None
    return {**counts, 'sensitivity': ratio(counts['tp'], counts['tp'] + counts['fn']),
            'specificity': ratio(counts['tn'], counts['tn'] + counts['fp']),
            'falseAcceptRate': ratio(counts['fp'], counts['fp'] + counts['tn']),
            'falseRejectRate': ratio(counts['fn'], counts['fn'] + counts['tp'])}


def evaluate(dataset, task, scorer, threshold, limit=None, seed=42):
    rows = load_rows(dataset, task)
    selected = select_rows(rows, limit, task, seed)
    groups, failures, reasons, predictions = defaultdict(list), Counter(), Counter(), []
    # Hash files once; renamed copies cannot silently cross validation/test boundaries.
    hashes, splits = {}, defaultdict(set)
    print('Checking dataset paths and content hashes before inference', flush=True)
    for row in rows:
        for path in row['_paths']:
            if path not in hashes:
                hashes[path] = checksum(path)
                if len(hashes) % 1000 == 0:
                    print(f'  Hashed {len(hashes)} unique dataset files', flush=True)
            splits[hashes[path]].add(row['split'])
    if any({'validation', 'test'} <= split for split in splits.values()):
        raise ValueError('Identical file contents overlap validation/test')
    for index, row in enumerate(selected, 1):
        acquired = True
        try:
            result = scorer.score(row)
        except AcquisitionError as error:
            acquired = False
            failures[str(row.get('label', 'ocr'))] += 1
            reasons[acquisition_reason(error)] += 1
            result = {'score': 0.} if task != 'ocr' else {'exact': False}
        if task != 'ocr' and (not math.isfinite(result['score']) or not -1 <= result['score'] <= 1):
            raise ValueError('Non-finite or invalid component score')
        groups[row['split']].append((row, result, acquired))
        predictions.append({'index': index, 'label': row.get('label'), 'acquired': acquired, **result})
        if index == 1 or index % 25 == 0 or index == len(selected):
            print(f'{task}: evaluated {index}/{len(selected)} ({sum(failures.values())} acquisition failures)', flush=True)
    reports = {}
    for split, examples in groups.items():
        if task == 'ocr':
            errors = sum(result.get('characterErrors', 0) for _row, result, _ok in examples)
            chars = sum(result.get('characters', 0) for _row, result, _ok in examples)
            reports[split] = {'total': len(examples), 'exactMatches': sum(result['exact'] for _row, result, _ok in examples),
                              'characterErrorRate': errors / chars if chars else None}
        else:
            labels = [row['label'] for row, _result, _ok in examples]
            scores = [result['score'] for _row, result, _ok in examples]
            valid = [(row, result) for row, result, ok in examples if ok]
            reports[split] = {'total': len(examples), 'acquired': len(valid), 'overall': metrics(labels, scores, threshold),
                              'inferenceOnly': metrics([r['label'] for r, _ in valid], [v['score'] for _, v in valid], threshold)}
    return {'schemaVersion': 1, 'pipeline': 'public-component-benchmark-v1', 'task': task,
            'scope': 'component-only', 'grantsKycAcceptance': False, 'recordingChallengesEvaluated': False,
            'documentAuthenticityEvaluated': False, 'pretrainedTrainingOverlap': 'unknown',
            'datasetSha256': hashlib.sha256(Path(dataset).read_bytes()).hexdigest(),
            'datasetContentSha256': hashlib.sha256('\n'.join(sorted(hashes.values())).encode()).hexdigest(),
            'thresholdSelection': 'fixed-before-evaluation',
            'threshold': threshold if task != 'ocr' else None, 'seed': seed, 'totalAvailable': len(rows),
            'evaluatedSamples': len(selected), 'partialBenchmark': len(selected) < len(rows),
            'acquisitionFailuresByLabel': dict(failures), 'acquisitionFailureReasons': dict(reasons),
            'evaluation': reports, 'predictions': predictions,
            'models': scorer.models.versions if getattr(scorer, 'models', None) else {}}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--task', choices=['face', 'spoof', 'ocr'], required=True)
    parser.add_argument('--dataset', type=Path, required=True)
    parser.add_argument('--models', type=Path, default=Path('artifacts/pretrained'))
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--threshold', type=float)
    parser.add_argument('--limit', type=int)
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()
    if args.output.name in {'acceptance.json', 'ocr-acceptance.json', 'evaluation.json'}:
        parser.error('Component reports cannot replace KYC acceptance or artifact evaluation files')
    if not args.dataset.is_file():
        parser.error('Dataset manifest missing. See docs/public-benchmarks.md for acquisition and import commands.')
    threshold = args.threshold if args.threshold is not None else (.363 if args.task == 'face' else .9)
    if not math.isfinite(threshold) or not 0 < threshold < 1:
        parser.error('Use a finite threshold between zero and one')
    # CPU benchmarking does not consume the hosted service GPU quota.
    import os
    os.environ['CV_ZERO_GPU'] = 'false'
    import torch
    import cv2
    torch.set_num_threads(2)
    cv2.setNumThreads(2)
    models = ocr = None
    if args.task == 'ocr':
        from app.services.document_ocr import DocumentOcr, MODEL_HASHES
        ocr = DocumentOcr()
        if not ocr.loaded: parser.error(ocr.error)
    else:
        from app.services.pretrained import PretrainedFaces
        models = PretrainedFaces(args.models)
        if not models.loaded: parser.error(models.error or 'Install pretrained models first')
    try:
        report = evaluate(args.dataset, args.task, ComponentScorer(args.task, models, ocr), threshold, args.limit, args.seed)
        if args.task == 'ocr': report['models'] = MODEL_HASHES
    except (OSError, ValueError) as error:
        parser.exit(1, f'Benchmark failed: {error}\n')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    print(f'Report: {args.output}. Component results do NOT enable KYC verification.', flush=True)
