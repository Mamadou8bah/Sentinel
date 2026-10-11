"""Compare pre-debit-context candidates on validation only; evaluate one selected model."""
import argparse
import hashlib
import json
from importlib.metadata import version
from pathlib import Path
from time import perf_counter
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, HistGradientBoostingClassifier
from threadpoolctl import threadpool_limits

from app.services.scoring import BALANCE_FEATURE_NAMES, balance_feature_matrix, normalize_type
from app.training.train import evaluate, select_threshold


def compare(frame, output, digest, seed=42, max_fpr=.005, max_train_rows=300_000):
    started = perf_counter()
    def progress(message):
        print(f'[{perf_counter()-started:8.1f}s] {message}', file=sys.stderr, flush=True)
    required = ['step', 'amount', 'isFraud', 'oldbalanceOrg', 'type']
    if any(column not in frame for column in required): raise ValueError(f'Required columns: {required}')
    if not 0 < max_fpr < 1 or max_train_rows < 200: raise ValueError('Invalid FPR budget or training row target')
    frame = frame[required].copy()
    numeric = ['step', 'amount', 'isFraud', 'oldbalanceOrg']
    frame[numeric] = frame[numeric].apply(pd.to_numeric, errors='raise')
    if not np.isfinite(frame[numeric].to_numpy()).all(): raise ValueError('Non-finite dataset values')
    if (frame.amount < 0).any() or (frame.oldbalanceOrg < 0).any() or not frame.isFraud.isin([0, 1]).all():
        raise ValueError('Invalid amount, pre-balance or fraud labels')
    frame = frame[frame.amount > 0].sort_values('step', kind='stable')
    steps = np.sort(frame.step.unique())
    if len(frame) < 200 or len(steps) < 10: raise ValueError('Need 200 records and ten distinct steps')
    end_train, end_validation = steps[int(len(steps)*.6)-1], steps[int(len(steps)*.8)-1]
    masks = {'train': (frame.step <= end_train).to_numpy(),
             'validation': ((frame.step > end_train) & (frame.step <= end_validation)).to_numpy(),
             'test': (frame.step > end_validation).to_numpy()}
    labels = frame.isFraud.to_numpy(dtype=int)
    for name, mask in masks.items():
        if len(np.unique(labels[mask])) != 2: raise ValueError('Each temporal window needs both labels')
        progress(f'{name}: {mask.sum():,} rows, {labels[mask].sum():,} fraud')
    progress('Building pre-debit balance features; post-outcome fields are excluded...')
    features = balance_feature_matrix(frame.amount, frame.step % 24, frame.type, frame.oldbalanceOrg)
    rng = np.random.default_rng(seed)
    positive = np.flatnonzero(masks['train'] & (labels == 1))
    negative = np.flatnonzero(masks['train'] & (labels == 0))
    sampled = rng.choice(negative, min(len(negative), max(1, max_train_rows-len(positive))), replace=False)
    selected = np.sort(np.concatenate((positive, sampled)))
    positive_weight = min(25., np.sqrt(len(negative)/len(positive)))
    weights = np.where(labels[selected] == 1, positive_weight, len(negative)/len(sampled))
    training_features = features[selected].copy()
    # Train missing-context behaviour without changing validation or test inputs.
    dropped = rng.random(len(selected)) < .1
    training_features[dropped, -3:] = [0., 0., 1.]
    validation_features, validation_labels = features[masks['validation']], labels[masks['validation']]
    candidates = [
        ('gradient-180-depth4', GradientBoostingClassifier(n_estimators=180, max_depth=4,
            min_samples_leaf=30, subsample=.8, random_state=seed)),
        ('histogram-250-leaves15', HistGradientBoostingClassifier(max_iter=250, max_leaf_nodes=15,
            min_samples_leaf=30, l2_regularization=2., early_stopping=False, random_state=seed, verbose=2)),
    ]
    reports, winner, winner_key = [], None, None
    with threadpool_limits(limits=4):
        for name, model in candidates:
            progress(f'Fitting candidate {name} on {len(selected):,} sampled training rows...')
            if isinstance(model, GradientBoostingClassifier):
                def monitor(index, estimator, state):
                    if index == 0 or (index+1) % 10 == 0: progress(f'{name}: tree {index+1}/{estimator.n_estimators}')
                    return False
                model.fit(training_features, labels[selected], sample_weight=weights, monitor=monitor)
            else: model.fit(training_features, labels[selected], sample_weight=weights)
            probabilities = model.predict_proba(validation_features)[:, 1]
            try: threshold, policy = select_threshold(validation_labels, probabilities, max_fpr)
            except ValueError:
                reports.append({'name': name, 'eligible': False}); continue
            metrics = evaluate(validation_labels, probabilities, threshold)
            reports.append({'name': name, 'eligible': True, 'threshold': threshold, 'validation': metrics,
                            'parameters': model.get_params()})
            progress(f'{name}: validation recall={metrics["recall"]:.4f}, precision={metrics["precision"]:.4f}, FPR={metrics["falsePositiveRate"]:.4f}')
            key = metrics['recall'], metrics['precision'], metrics['averagePrecision']
            if winner_key is None or key > winner_key:
                winner_key, winner = key, (name, model, threshold, policy, metrics)
        if winner is None: raise ValueError('No candidate passes validation threshold selection; nothing saved')
        name, model, threshold, policy, validation_metrics = winner
        progress(f'Locked winner {name} using validation only. Evaluating previously used test window...')
        test_features, test_labels = features[masks['test']], labels[masks['test']]
        probabilities = model.predict_proba(test_features)[:, 1]
        test_metrics = evaluate(test_labels, probabilities, threshold)
        missing = test_features.copy(); missing[:, -3:] = [0., 0., 1.]
        missing_metrics = evaluate(test_labels, model.predict_proba(missing)[:, 1], threshold)
        amount_rules = frame.amount.to_numpy()[masks['test']] >= 10_000
        combined = (probabilities >= threshold) | (probabilities >= .65) | amount_rules
        combined_metrics = evaluate(test_labels, combined.astype(float), .5)
        python_flag_metrics = evaluate(test_labels, (probabilities >= min(threshold, .65)).astype(float), .5)
        tenant_default_metrics = evaluate(test_labels, ((probabilities >= min(threshold, .70)) | amount_rules).astype(float), .5)
        debit = frame.type.map(normalize_type).isin(['TRANSFER', 'CASH_OUT', 'PAYMENT', 'DEBIT']).to_numpy()[masks['test']]
        feasible = debit & (frame.amount.to_numpy()[masks['test']] <= frame.oldbalanceOrg.to_numpy()[masks['test']])
        feasible_metrics = evaluate(test_labels[feasible], probabilities[feasible], threshold) if len(np.unique(test_labels[feasible])) == 2 else None
        # Reject candidates whose model implementation cannot provide the required real SHAP contract.
        import shap
        explainer = shap.TreeExplainer(model)
        row = test_features[:1]
        explained = float(np.asarray(explainer.expected_value).item()) + float(np.asarray(explainer.shap_values(row)).sum())
        if not np.isclose(explained, model.decision_function(row)[0], atol=1e-6): raise ValueError('SHAP contract failed')
    packages = {name: version(name) for name in ('scikit-learn', 'numpy', 'shap')}
    provenance = {'dataset': digest, 'seed': seed, 'candidateReports': reports, 'maxFpr': max_fpr,
                  'maxTrainRows': max_train_rows, 'featureVersion': 3, 'packages': packages, 'missingContextDropout': .1}
    model_version = hashlib.sha256(json.dumps(provenance, sort_keys=True).encode()).hexdigest()[:16]
    report = {'modelVersion': model_version, 'datasetSource': 'PaySim (caller-supplied CSV; pre-debit context)',
              'datasetSha256': digest, 'featureVersion': 3, 'featureNames': BALANCE_FEATURE_NAMES,
              'seed': seed, 'packageVersions': packages, 'selectedCandidate': name, 'modelParameters': model.get_params(),
              'candidateReports': reports, 'threshold': threshold, 'thresholdSelection': policy,
              'split': '60/20/20 of distinct chronological steps; final window previously evaluated by v1/v2',
              **{f'{name}Rows': int(mask.sum()) for name, mask in masks.items()},
              **{f'{name}Fraud': int(labels[mask].sum()) for name, mask in masks.items()},
              'splitBoundaries': {'trainEnd': float(end_train), 'validationEnd': float(end_validation), 'testEnd': float(steps[-1])},
              'fittedRows': len(selected), 'missingContextDropout': .1, 'positiveTrainingWeight': float(positive_weight),
              'negativeSamplingWeight': float(len(negative)/len(sampled)), 'validation': validation_metrics, **test_metrics,
              'testWithoutBalance': missing_metrics, 'testFeasibleDebitRows': int(feasible.sum()), 'testFeasibleDebits': feasible_metrics,
              'testWithAvailableAmountRules': combined_metrics,
              'testWithPythonFlagPolicyNoAmountRules': python_flag_metrics,
              'testWithDefaultTenantAndAmountRules': tenant_default_metrics,
              'limitations': 'Reused simulated PaySim test window; not independent confirmation. Old origin balance is pre-transaction but simulator artefacts may dominate. Only debit-type balances are represented. Zero-amount rows excluded. Missing-balance stress and feasible-debit subgroup reported separately. Combined report includes amount rules and raw score threshold, not unavailable customer velocity rules. Scores are uncalibrated. No post-outcome balance or fraud flags used. No production safety claim.'}
    output.mkdir(parents=True, exist_ok=True)
    joblib.dump({'model': model, **report}, output/'model.joblib')
    (output/'evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    progress(f'Saved {output.resolve()}: test precision={report["precision"]:.4f}, recall={report["recall"]:.4f}, FPR={report["falsePositiveRate"]:.4f}')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--paysim', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('artifacts/paysim-v3'))
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--max-fpr', type=float, default=.005)
    parser.add_argument('--max-train-rows', type=int, default=300_000)
    args = parser.parse_args()
    with args.paysim.open('rb') as stream: digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    print('Loading pre-transaction PaySim columns...', file=sys.stderr, flush=True)
    frame = pd.read_csv(args.paysim, usecols=['step','amount','type','oldbalanceOrg','isFraud'])
    print(json.dumps(compare(frame, args.output, digest, args.seed, args.max_fpr, args.max_train_rows), indent=2))


if __name__ == '__main__': main()
