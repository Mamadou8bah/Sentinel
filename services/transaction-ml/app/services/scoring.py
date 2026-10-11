"""Rules and optional trained model. Rules are never presented as SHAP values."""
from datetime import timezone
from pathlib import Path
import math

import joblib
import numpy as np

from app.api.schemas import TransactionInput

LEGACY_FEATURE_NAMES = ["log_amount", "hour_sin", "hour_cos"]
TRANSACTION_TYPES = ("CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER", "UNKNOWN")
FEATURE_NAMES = LEGACY_FEATURE_NAMES + ["type_" + kind.lower() for kind in TRANSACTION_TYPES]
FEATURE_VERSION = 2
BALANCE_FEATURE_NAMES = FEATURE_NAMES + ["log_available_balance", "amount_balance_ratio", "balance_missing"]


def normalize_type(value):
    kind = str(value or "UNKNOWN").strip().upper()
    return {"DEPOSIT": "CASH_IN", "WITHDRAWAL": "CASH_OUT"}.get(kind, kind) if kind in TRANSACTION_TYPES or kind in {"DEPOSIT", "WITHDRAWAL"} else "UNKNOWN"


def feature_row(amount: float, hour: float, transaction_type=None, version=FEATURE_VERSION, available_balance=None) -> list[float]:
    angle = 2 * math.pi * hour / 24
    row = [math.log1p(amount), math.sin(angle), math.cos(angle)]
    if version == 1: return row
    row += [float(normalize_type(transaction_type) == kind) for kind in TRANSACTION_TYPES]
    if version == 3:
        balance = effective_balance(transaction_type, available_balance)
        row += [math.log1p(balance or 0), min(amount / max(balance, 1.), 1_000_000.) if balance is not None else 0., float(balance is None)]
    return row


def feature_matrix(amounts, hours, types):
    amounts = np.asarray(amounts, dtype=float)
    angle = np.asarray(hours, dtype=float) * (2 * math.pi / 24)
    normalized = np.asarray([normalize_type(value) for value in types])
    return np.column_stack([np.log1p(amounts), np.sin(angle), np.cos(angle),
                            *[(normalized == kind).astype(float) for kind in TRANSACTION_TYPES]]).astype(np.float32)


def effective_balance(kind, balance):
    # A credit recipient's balance is not the PaySim debit origin's balance.
    if normalize_type(kind) not in {"CASH_OUT", "TRANSFER", "DEBIT", "PAYMENT"} or balance is None:
        return None
    balance = float(balance)
    if not math.isfinite(balance) or balance < 0: raise ValueError("Invalid pre-transaction balance")
    return balance


def balance_feature_matrix(amounts, hours, types, balances):
    base = feature_matrix(amounts, hours, types)
    effective = np.asarray([np.nan if (value := effective_balance(kind, balance)) is None else value
                            for kind, balance in zip(types, balances, strict=True)], dtype=float)
    missing = np.isnan(effective)
    values = np.nan_to_num(effective, nan=0.)
    ratio = np.where(missing, 0., np.clip(np.asarray(amounts) / np.maximum(values, 1.), 0., 1_000_000.))
    return np.column_stack((base, np.log1p(values), ratio, missing.astype(float))).astype(np.float32)


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
            expected = {1: LEGACY_FEATURE_NAMES, 2: FEATURE_NAMES, 3: BALANCE_FEATURE_NAMES}.get(self.bundle["featureVersion"])
            if self.bundle["featureVersion"] not in (1, 2, 3) or self.bundle["featureNames"] != expected:
                raise ValueError("Model feature contract does not match the service")
            if list(self.bundle["model"].classes_) != [0, 1]:
                raise ValueError("Model must use binary labels 0 and 1")
            threshold = self.bundle.get("threshold", .5)
            if not isinstance(threshold, (float, int)) or not 0 < threshold <= 1:
                raise ValueError("Invalid model threshold")
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
            row = np.asarray([feature_row(amount, moment.hour + moment.minute / 60, tx.transactionType, self.bundle["featureVersion"], tx.availableBalance)], dtype=float)
            model_score = float(self.bundle["model"].predict_proba(row)[0, 1])
            if not math.isfinite(model_score) or not 0 <= model_score <= 1:
                raise ValueError("Invalid raw model score")
            values = np.asarray(self.explainer.shap_values(row))[0]
            if not np.isfinite(values).all():
                raise ValueError("Invalid model attributions")
            contributions = sorted([
                {"feature": name, "contribution": float(value), "value": float(row[0, i])}
                for i, (name, value) in enumerate(zip(self.bundle["featureNames"], values, strict=True))
            ], key=lambda item: abs(item["contribution"]), reverse=True)
            version = self.bundle["modelVersion"]
            provenance = self.bundle["datasetSource"]
            dominant = ", ".join(item["feature"] for item in contributions[:2])
            explanation = f"Model {version} ({provenance}); main model inputs: {dominant}. "
            explanation += "Rules: " + (", ".join(flags) or "none triggered")
        model_flagged = model_score is not None and self.bundle["featureVersion"] >= 2 and model_score >= self.bundle.get("threshold", .5)
        if model_flagged:
            explanation += f" Model score exceeds validation review threshold {self.bundle.get('threshold', .5):.6f}."
        if self.bundle is not None and self.bundle['featureVersion'] >= 2 and normalize_type(tx.transactionType) == 'UNKNOWN':
            explanation += " Transaction type unavailable or unsupported; context is incomplete."
        if self.bundle is not None and self.bundle['featureVersion'] == 3 and effective_balance(tx.transactionType, tx.availableBalance) is None:
            explanation += " Debit balance context unavailable; balance-missing inputs used."
        score = max(rule_score, model_score or 0.0)
        if not math.isfinite(score) or not 0 <= score <= 1:
            raise ValueError("Invalid model score")
        return {
            "transactionId": tx.transactionId, "anomalyScore": score,
            "flagged": score >= 0.65 or model_flagged, "modelFlagged": model_flagged,
            "modelThreshold": self.bundle.get("threshold", .5) if self.bundle is not None else None, "ruleFlags": flags, "ruleScore": rule_score,
            "modelScore": model_score, "modelRan": self.bundle is not None,
            "modelVersion": version, "datasetSource": provenance,
            "explanation": explanation, "shapTopFeatures": contributions,
            "attributionUnits": "log_odds" if contributions else None,
        }
