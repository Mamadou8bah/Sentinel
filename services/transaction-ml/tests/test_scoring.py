import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.api.schemas import TransactionInput
from app.services.scoring import Scorer, feature_row
from app.training.train import synthetic_frame, train


def payload(amount=100):
    return {"transactions": [{"amount": amount, "timestamp": "2026-10-07T12:00:00Z", "currency": "GMD", "channel": "api"}]}


@pytest.fixture
def client():
    return TestClient(create_app("rules"))


@pytest.mark.parametrize("amount,score,flag", [(100, .1, None), (10_000, .75, "AMOUNT_ELEVATED"), (50_000, .9, "AMOUNT_OUTLIER")])
def test_rule_outcomes_are_honest(client, amount, score, flag):
    response = client.post("/ml/transaction-score", json=payload(amount))
    assert response.status_code == 200
    result = response.json()["scores"][0]
    assert result["anomalyScore"] == score
    assert result["modelRan"] is False
    assert result["shapTopFeatures"] == []
    assert result["modelScore"] is None
    if flag:
        assert flag in result["ruleFlags"]


@pytest.mark.parametrize("amount", [0, -1, "NaN", "Infinity", 1e15, "1.00001"])
def test_invalid_amounts_rejected(client, amount):
    assert client.post("/ml/transaction-score", json=payload(amount)).status_code == 422


def test_time_requires_timezone_and_batch_is_bounded(client):
    body = payload()
    body["transactions"][0]["timestamp"] = "2026-10-07T12:00:00"
    assert client.post("/ml/transaction-score", json=body).status_code == 422
    assert client.post("/ml/transaction-score", json={"transactions": []}).status_code == 422
    assert client.post("/ml/transaction-score", json={"transactions": payload()["transactions"] * 101}).status_code == 422


def test_missing_trained_artifact_never_falls_back():
    client = TestClient(create_app("trained", "missing-artifact.joblib"))
    assert client.get("/health").status_code == 503
    assert client.post("/ml/transaction-score", json=payload()).status_code == 503


def test_velocity_and_baseline_require_actual_supplied_features(client):
    body = payload(1000)
    body["transactions"][0]["customerFeatures"] = {"avgAmount30d": 100, "txCount24h": 21}
    result = client.post("/ml/transaction-score", json=body).json()["scores"][0]
    assert result["ruleFlags"] == ["ABOVE_CUSTOMER_BASELINE", "HIGH_FREQUENCY"]


def test_training_roundtrip_and_real_shap_additivity(tmp_path):
    report = train(synthetic_frame(4000, 42), tmp_path, "synthetic-test", 42, "test-digest")
    assert report["trainRows"] + report["testRows"] == 4000
    assert 0 <= report["recall"] <= 1
    scorer = Scorer("trained", str(tmp_path / "model.joblib"))
    tx = TransactionInput.model_validate(payload()["transactions"][0])
    result = scorer.score(tx)
    assert result["modelRan"] is True
    assert result["datasetSource"] == "synthetic-test"
    assert len(result["shapTopFeatures"]) == 3
    margin = float(scorer.bundle["model"].decision_function(np.asarray([feature_row(100, 12)]))[0])
    explained = float(np.asarray(scorer.explainer.expected_value).item()) + sum(item["contribution"] for item in result["shapTopFeatures"])
    assert explained == pytest.approx(margin, abs=1e-6)


def test_one_class_dataset_cannot_train(tmp_path):
    frame = synthetic_frame(1000, 42)
    frame["isFraud"] = 0
    with pytest.raises(ValueError, match="both labels"):
        train(frame, tmp_path, "synthetic", 42, "test")
