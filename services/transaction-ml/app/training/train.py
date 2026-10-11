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
from sklearn.metrics import confusion_matrix, precision_score, recall_score, average_precision_score, roc_curve

from app.services.scoring import FEATURE_NAMES, FEATURE_VERSION, feature_matrix, TRANSACTION_TYPES


def synthetic_frame(rows: int, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    amount = np.exp(rng.normal(7.5, 1.8, rows))
    step = np.arange(rows) // 20 + 1
    logit = -5 + 1.1 * (np.log1p(amount) - 7.5) + 1.5 * ((step % 24) < 5)
    labels = rng.binomial(1, 1 / (1 + np.exp(-logit)))
    return pd.DataFrame({"step": step, "amount": amount, "isFraud": labels, "type": rng.choice(TRANSACTION_TYPES, rows)})


def evaluate(labels, probabilities, threshold):
    predicted = probabilities >= threshold
    tn, fp, fn, tp = confusion_matrix(labels, predicted, labels=[0, 1]).ravel()
    return {"precision": float(precision_score(labels, predicted, zero_division=0)),
            "recall": float(recall_score(labels, predicted, zero_division=0)),
            "falsePositiveRate": float(fp / (fp + tn)),
            "averagePrecision": float(average_precision_score(labels, probabilities)),
            "confusionMatrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}}


def select_threshold(labels, probabilities, max_fpr):
    false_positive, recall, thresholds = roc_curve(labels, probabilities, drop_intermediate=False)
    eligible = np.flatnonzero((false_positive <= max_fpr) & np.isfinite(thresholds)
                              & (thresholds > 0) & (thresholds <= 1))
    if not len(eligible) or max(recall[eligible], default=0) == 0:
        raise ValueError("No useful validation threshold satisfies the false-positive budget; artifact not saved")
    best = max(eligible, key=lambda i: (recall[i], -false_positive[i], thresholds[i]))
    return float(thresholds[best]), {"source": "validation only", "objective": "maximum recall within FPR budget",
                                    "maxFalsePositiveRate": max_fpr}


def train(frame: pd.DataFrame, output: Path, source: str, seed: int, dataset_hash: str, max_fpr: float = .005, max_train_rows: int = 500_000) -> dict:
    started = perf_counter()

    def progress(message: str):
        print(f"[{perf_counter() - started:8.1f}s] {message}", file=sys.stderr, flush=True)

    progress(f"Validating and sorting {len(frame):,} rows by time step...")
    required = ["step", "amount", "isFraud"]
    if any(name not in frame for name in required):
        raise ValueError("Input needs step, amount and isFraud columns")
    if not 0 < max_fpr < 1 or max_train_rows < 200:
        raise ValueError("max_fpr must be between zero and one and max_train_rows at least 200")
    types = frame["type"] if "type" in frame else pd.Series("UNKNOWN", index=frame.index)
    frame = frame[required].apply(pd.to_numeric, errors="raise").assign(type=types).sort_values("step", kind="stable")
    if len(frame) < 200 or not np.isfinite(frame[required].to_numpy()).all():
        raise ValueError("Need at least 200 finite records")
    if (frame.amount <= 0).any() or not frame.isFraud.isin([0, 1]).all():
        raise ValueError("Amounts must be positive and labels binary")
    steps = np.sort(frame.step.unique())
    if len(steps) < 10:
        raise ValueError("Need at least ten distinct time steps for a temporal holdout")
    train_boundary = steps[int(len(steps) * .6) - 1]
    validation_boundary = steps[int(len(steps) * .8) - 1]
    training = (frame.step <= train_boundary).to_numpy()
    validation = ((frame.step > train_boundary) & (frame.step <= validation_boundary)).to_numpy()
    testing = (frame.step > validation_boundary).to_numpy()
    labels = frame.isFraud.to_numpy(dtype=int)
    for name, mask in (("train", training), ("validation", validation), ("test", testing)):
        if len(np.unique(labels[mask])) != 2:
            raise ValueError("Train, validation and test windows must each contain both labels")
        progress(f"{name}: {int(mask.sum()):,} rows, {int(labels[mask].sum()):,} fraud labels")
    progress("Building vectorized amount/time/type features (no post-outcome balances)...")
    features = feature_matrix(frame.amount, frame.step % 24, frame.type)
    rng = np.random.default_rng(seed)
    positive = np.flatnonzero(training & (labels == 1))
    negative = np.flatnonzero(training & (labels == 0))
    negative_budget = max(1, max_train_rows - len(positive))
    selected_negative = rng.choice(negative, min(len(negative), negative_budget), replace=False)
    selected = np.sort(np.concatenate((positive, selected_negative)))
    # Keep all training fraud; inverse sampling weights restore original negative mass.
    # Moderate positive weighting addresses imbalance without claiming calibrated probabilities.
    positive_weight = min(25., np.sqrt(len(negative) / len(positive)))
    weights = np.where(labels[selected] == 1, positive_weight, len(negative) / len(selected_negative))
    model = GradientBoostingClassifier(n_estimators=120, max_depth=3, min_samples_leaf=20,
                                       subsample=.8, random_state=seed)
    progress(f"Fitting {model.n_estimators} trees on {len(selected):,} training rows; positive weight={positive_weight:.2f}.")
    fit_started = perf_counter()

    def report_iteration(index, estimator, state):
        completed = index + 1
        if completed == 1 or completed % 5 == 0 or completed == estimator.n_estimators:
            elapsed = perf_counter() - fit_started
            remaining = elapsed / completed * (estimator.n_estimators - completed)
            progress(f"Trees {completed:2d}/{estimator.n_estimators}: training loss={estimator.train_score_[index]:.6f}, "
                     f"fit elapsed={elapsed:.1f}s, estimated remaining={remaining:.1f}s")
        return False

    model.fit(features[selected], labels[selected], sample_weight=weights, monitor=report_iteration)
    progress("Selecting a threshold using validation data only...")
    validation_probabilities = model.predict_proba(features[validation])[:, 1]
    threshold, selection = select_threshold(labels[validation], validation_probabilities, max_fpr)
    validation_metrics = evaluate(labels[validation], validation_probabilities, threshold)
    progress(f"Selected threshold={threshold:.6f}; validation recall={validation_metrics['recall']:.4f}, FPR={validation_metrics['falsePositiveRate']:.4f}")
    progress("Evaluating untouched chronological test data...")
    probabilities = model.predict_proba(features[testing])[:, 1]
    test_metrics = evaluate(labels[testing], probabilities, threshold)
    versions = {name: package_version(name) for name in ("scikit-learn", "numpy", "shap")}
    build = json.dumps({"dataset": dataset_hash, "seed": seed, "featureVersion": FEATURE_VERSION,
                        "parameters": model.get_params(), "packages": versions, "maxFpr": max_fpr, "maxTrainRows": max_train_rows, "trainingPolicy": "temporal-60-20-20-weighted-v2"}, sort_keys=True)
    version = hashlib.sha256(build.encode()).hexdigest()[:16]
    report = {
        "modelVersion": version, "datasetSource": source, "datasetSha256": dataset_hash,
        "seed": seed, "featureNames": FEATURE_NAMES, "featureVersion": FEATURE_VERSION,
        "packageVersions": versions, "modelParameters": model.get_params(),
        "split": "chronological by distinct step: first 60% train, next 20% validation, final 20% test",
        "trainRows": int(training.sum()), "validationRows": int(validation.sum()), "testRows": int(testing.sum()),
        "fittedRows": len(selected), "positiveTrainingWeight": float(positive_weight),
        "negativeSamplingWeight": float(len(negative) / len(selected_negative)),
        "trainFraud": int(labels[training].sum()), "validationFraud": int(labels[validation].sum()),
        "testFraud": int(labels[testing].sum()), "threshold": threshold,
        "thresholdSelection": selection, "validation": validation_metrics,
        **test_metrics, "testAtDefaultThreshold": evaluate(labels[testing], probabilities, .5),
        "limitations": "Amount/time/type model; scores are uncalibrated and training positives are weighted. Threshold selected on validation only. PaySim is simulated and may not represent real payments or operation semantics. No identity, account identifiers, isFlaggedFraud, or post-outcome balances are used. Rules are evaluated separately; no production accuracy claim.",
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
    parser.add_argument("--max-fpr", type=float, default=.005)
    parser.add_argument("--max-train-rows", type=int, default=500_000)
    parser.add_argument("--output", type=Path, default=Path("artifacts/local"))
    args = parser.parse_args()
    print("Starting transaction model training...", file=sys.stderr, flush=True)
    if args.paysim:
        print(f"Hashing dataset: {args.paysim.resolve()} ({args.paysim.stat().st_size / 1024**2:,.1f} MiB)...", file=sys.stderr, flush=True)
        with args.paysim.open("rb") as source_file:
            digest = hashlib.file_digest(source_file, "sha256").hexdigest()
        print("Reading step, amount, type and isFraud columns from CSV...", file=sys.stderr, flush=True)
        frame = pd.read_csv(args.paysim, usecols=["step", "amount", "type", "isFraud"])
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
    print(json.dumps(train(frame, args.output, source, args.seed, digest, args.max_fpr, args.max_train_rows), indent=2))


if __name__ == "__main__":
    main()
