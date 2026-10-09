"""Reproducible training/evaluation CLI. Synthetic output is labelled as such."""
import argparse
import hashlib
import json
import sys
from time import perf_counter
from importlib.metadata import version as package_version
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import confusion_matrix, precision_score, recall_score, average_precision_score

from app.services.scoring import FEATURE_NAMES, FEATURE_VERSION, feature_row


def synthetic_frame(rows: int, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    amount = np.exp(rng.normal(7.5, 1.8, rows))
    step = np.arange(rows) // 20 + 1
    logit = -5 + 1.1 * (np.log1p(amount) - 7.5) + 1.5 * ((step % 24) < 5)
    labels = rng.binomial(1, 1 / (1 + np.exp(-logit)))
    return pd.DataFrame({"step": step, "amount": amount, "isFraud": labels})


def train(frame: pd.DataFrame, output: Path, source: str, seed: int, dataset_hash: str) -> dict:
    started = perf_counter()

    def progress(message: str):
        print(f"[{perf_counter() - started:8.1f}s] {message}", file=sys.stderr, flush=True)

    progress(f"Validating and sorting {len(frame):,} rows by time step...")
    required = ["step", "amount", "isFraud"]
    if any(name not in frame for name in required):
        raise ValueError("Input needs step, amount and isFraud columns")
    frame = frame[required].apply(pd.to_numeric, errors="raise").sort_values("step", kind="stable")
    if len(frame) < 200 or not np.isfinite(frame.to_numpy()).all():
        raise ValueError("Need at least 200 finite records")
    if (frame.amount <= 0).any() or not frame.isFraud.isin([0, 1]).all():
        raise ValueError("Amounts must be positive and labels binary")
    steps = np.sort(frame.step.unique())
    if len(steps) < 10:
        raise ValueError("Need at least ten distinct time steps for a temporal holdout")
    boundary = steps[int(len(steps) * 0.8) - 1]
    training = frame.step <= boundary
    if frame.loc[training, "isFraud"].nunique() != 2 or frame.loc[~training, "isFraud"].nunique() != 2:
        raise ValueError("Training and held-out windows must each contain both labels")
    progress(f"Temporal split: {int(training.sum()):,} training rows, {int((~training).sum()):,} evaluation rows")
    progress(f"Fraud labels: {int(frame.loc[training, 'isFraud'].sum()):,} train, {int(frame.loc[~training, 'isFraud'].sum()):,} evaluation")
    progress("Building amount/time features...")
    features = np.asarray([feature_row(a, s % 24) for a, s in zip(frame.amount, frame.step, strict=True)])
    labels = frame.isFraud.to_numpy(dtype=int)
    model = GradientBoostingClassifier(n_estimators=80, max_depth=2, min_samples_leaf=10, random_state=seed)
    progress(f"Fitting {model.n_estimators} boosting trees; seed={seed}. Large datasets may take several minutes.")
    fit_started = perf_counter()

    def report_iteration(index, estimator, state):
        completed = index + 1
        if completed == 1 or completed % 5 == 0 or completed == estimator.n_estimators:
            elapsed = perf_counter() - fit_started
            remaining = elapsed / completed * (estimator.n_estimators - completed)
            progress(f"Trees {completed:2d}/{estimator.n_estimators}: training loss={estimator.train_score_[index]:.6f}, "
                     f"fit elapsed={elapsed:.1f}s, estimated remaining={remaining:.1f}s")
        return False

    model.fit(features[training], labels[training], monitor=report_iteration)
    progress("Predicting held-out probabilities and calculating evaluation metrics...")
    probabilities = model.predict_proba(features[~training])[:, 1]
    predictions = probabilities >= 0.5
    tn, fp, fn, tp = confusion_matrix(labels[~training], predictions, labels=[0, 1]).ravel()
    versions = {name: package_version(name) for name in ("scikit-learn", "numpy", "shap")}
    build = json.dumps({"dataset": dataset_hash, "seed": seed, "featureVersion": FEATURE_VERSION,
                        "parameters": model.get_params(), "packages": versions}, sort_keys=True)
    version = hashlib.sha256(build.encode()).hexdigest()[:16]
    report = {
        "modelVersion": version, "datasetSource": source, "datasetSha256": dataset_hash,
        "seed": seed, "featureNames": FEATURE_NAMES, "featureVersion": FEATURE_VERSION,
        "packageVersions": versions, "modelParameters": model.get_params(),
        "split": "chronological by step, first 80% of steps train, final 20% test; no resampling",
        "trainRows": int(training.sum()), "testRows": int((~training).sum()),
        "trainFraud": int(labels[training].sum()), "testFraud": int(labels[~training].sum()),
        "threshold": 0.5, "precision": float(precision_score(labels[~training], predictions, zero_division=0)),
        "recall": float(recall_score(labels[~training], predictions, zero_division=0)),
        "falsePositiveRate": float(fp / (fp + tn)),
        "averagePrecision": float(average_precision_score(labels[~training], probabilities)),
        "confusionMatrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "limitations": "Amount/time baseline only; model scores are uncalibrated. Synthetic metrics do not establish PaySim or real payment performance. No balance, identity, or post-outcome features are used. Rules are evaluated separately.",
    }
    progress(f"Evaluation: precision={report['precision']:.4f}, recall={report['recall']:.4f}, "
             f"false-positive rate={report['falsePositiveRate']:.4f}, average precision={report['averagePrecision']:.4f}")
    progress(f"Saving model and evaluation report to {output.resolve()}...")
    output.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, **report}, output / "model.joblib")
    (output / "evaluation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    progress("Finished. Saved model.joblib and evaluation.json.")
    return report


def main():
    parser = argparse.ArgumentParser()
    inputs = parser.add_mutually_exclusive_group(required=True)
    inputs.add_argument("--paysim", type=Path)
    inputs.add_argument("--synthetic", action="store_true")
    parser.add_argument("--rows", type=int, default=20_000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=Path, default=Path("artifacts/local"))
    args = parser.parse_args()
    print("Starting transaction model training...", file=sys.stderr, flush=True)
    if args.paysim:
        print(f"Hashing dataset: {args.paysim.resolve()} ({args.paysim.stat().st_size / 1024**2:,.1f} MiB)...", file=sys.stderr, flush=True)
        with args.paysim.open("rb") as source_file:
            digest = hashlib.file_digest(source_file, "sha256").hexdigest()
        print("Reading step, amount and isFraud columns from CSV...", file=sys.stderr, flush=True)
        frame = pd.read_csv(args.paysim, usecols=["step", "amount", "isFraud"])
        # PaySim includes zero-amount records; these are outside the spending API contract.
        loaded = len(frame)
        frame = frame[frame.amount > 0]
        print(f"Loaded {loaded:,} rows; kept {len(frame):,} positive-amount rows, excluded {loaded - len(frame):,}.", file=sys.stderr, flush=True)
        source = "PaySim (caller-supplied CSV; positive amounts only)"
    else:
        print(f"Generating {args.rows:,} synthetic rows (not PaySim)...", file=sys.stderr, flush=True)
        frame = synthetic_frame(args.rows, args.seed)
        digest = hashlib.sha256(frame.to_csv(index=False).encode()).hexdigest()
        source = "synthetic-generator-v1 (not PaySim)"
    print(json.dumps(train(frame, args.output, source, args.seed, digest), indent=2))


if __name__ == "__main__":
    main()
