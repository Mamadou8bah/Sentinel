"""Rules and optional trained model. Rules are never presented as SHAP values."""
from datetime import timezone
from pathlib import Path
import math

import joblib
import numpy as np

from app.api.schemas import TransactionInput

FEATURE_NAMES = ["log_amount", "hour_sin", "hour_cos"]
FEATURE_VERSION = 1


def feature_row(amount: float, hour: float) -> list[float]:
    angle = 2 * math.pi * hour / 24
    return [math.log1p(amount), math.sin(angle), math.cos(angle)]


class Scorer:
    def __init__(self, mode: str = "rules", model_path: str | None = None):
        if mode not in {"rules", "trained"}:
            raise ValueError("TRANSACTION_ML_MODE must be rules or trained")
        self.mode = mode
        self.bundle = None
        self.explainer = None
        if mode == "trained":
            if not model_path or not Path(model_path).is_file():
                raise ValueError("Trained mode requires a local model artifact")
            # Artifacts are trusted local build outputs, never customer uploads.
            self.bundle = joblib.load(model_path)
            if self.bundle["featureVersion"] != FEATURE_VERSION or self.bundle["featureNames"] != FEATURE_NAMES:
                raise ValueError("Model feature contract does not match the service")
            if list(self.bundle["model"].classes_) != [0, 1]:
                raise ValueError("Model must use binary labels 0 and 1")
            import shap
            self.explainer = shap.TreeExplainer(self.bundle["model"])

    def score(self, tx: TransactionInput) -> dict:
        amount = float(tx.amount)
        flags = []
        rule_score = 0.10
        if amount >= 50_000:
            flags.append("AMOUNT_OUTLIER")
            rule_score = 0.90
        elif amount >= 10_000:
            flags.append("AMOUNT_ELEVATED")
            rule_score = 0.75
        history = tx.customerFeatures
        if history.avgAmount30d and amount / history.avgAmount30d >= 5:
            flags.append("ABOVE_CUSTOMER_BASELINE")
            rule_score = max(rule_score, 0.75)
        if history.txCount24h >= 20:
            flags.append("HIGH_FREQUENCY")
            rule_score = max(rule_score, 0.75)
        if tx.channel.upper() == "ATM" and amount >= 5_000:
            flags.append("CHANNEL_AMOUNT")
            rule_score = max(rule_score, 0.75)

        model_score = None
        contributions = []
        version = None
        provenance = "none"
        explanation = "RULES ONLY (no trained model): " + (", ".join(flags) or "No configured rule triggered")
        if self.bundle is not None:
            moment = tx.timestamp.astimezone(timezone.utc)
            row = np.asarray([feature_row(amount, moment.hour + moment.minute / 60)], dtype=float)
            model_score = float(self.bundle["model"].predict_proba(row)[0, 1])
            values = np.asarray(self.explainer.shap_values(row))[0]
            contributions = sorted([
                {"feature": name, "contribution": float(value), "value": float(row[0, i])}
                for i, (name, value) in enumerate(zip(FEATURE_NAMES, values, strict=True))
            ], key=lambda item: abs(item["contribution"]), reverse=True)
            version = self.bundle["modelVersion"]
            provenance = self.bundle["datasetSource"]
            dominant = ", ".join(item["feature"] for item in contributions[:2])
            explanation = f"Model {version} ({provenance}); main model inputs: {dominant}. "
            explanation += "Rules: " + (", ".join(flags) or "none triggered")
        score = max(rule_score, model_score or 0.0)
        if not math.isfinite(score) or not 0 <= score <= 1:
            raise ValueError("Invalid model score")
        return {
            "transactionId": tx.transactionId, "anomalyScore": score,
            "flagged": score >= 0.65, "ruleFlags": flags, "ruleScore": rule_score,
            "modelScore": model_score, "modelRan": self.bundle is not None,
            "modelVersion": version, "datasetSource": provenance,
            "explanation": explanation, "shapTopFeatures": contributions,
            "attributionUnits": "log_odds" if contributions else None,
        }
