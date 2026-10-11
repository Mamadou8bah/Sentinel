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
    assert report["validation"]["falsePositiveRate"] <= .005
    assert report["thresholdSelection"]["source"] == "validation only"
    assert report["trainRows"] + report["validationRows"] + report["testRows"] == 4000
    assert 0 <= report["recall"] <= 1
    scorer = Scorer("trained", str(tmp_path / "model.joblib"))
    tx = TransactionInput.model_validate(payload()["transactions"][0])
    result = scorer.score(tx)
    assert result["modelRan"] is True
    assert result["datasetSource"] == "synthetic-test"
    assert len(result["shapTopFeatures"]) == 9
    margin = float(scorer.bundle["model"].decision_function(np.asarray([feature_row(100, 12)]))[0])
    explained = float(np.asarray(scorer.explainer.expected_value).item()) + sum(item["contribution"] for item in result["shapTopFeatures"])
    assert explained == pytest.approx(margin, abs=1e-6)


def test_one_class_dataset_cannot_train(tmp_path):
    frame = synthetic_frame(1000, 42)
    frame["isFraud"] = 0
    with pytest.raises(ValueError, match="both labels"):
        train(frame, tmp_path, "synthetic", 42, "test")


def test_type_features_match_training_and_inference():
    from app.services.scoring import feature_matrix, TRANSACTION_TYPES
    for kind in TRANSACTION_TYPES + ('deposit', 'withdrawal', 'web'):
        assert feature_matrix([123.45], [12.5], [kind])[0] == pytest.approx(feature_row(123.45, 12.5, kind), abs=1e-6)
    assert feature_row(1, 0, 'deposit') == feature_row(1, 0, 'CASH_IN')
    assert feature_row(1, 0, 'withdrawal') == feature_row(1, 0, 'CASH_OUT')
    assert len(feature_row(1, 0, version=1)) == 3


def test_validation_threshold_obeys_false_positive_budget():
    from app.training.train import select_threshold, evaluate
    labels = np.asarray([0, 0, 0, 1, 1])
    probabilities = np.asarray([.1, .2, .8, .4, .9])
    threshold, policy = select_threshold(labels, probabilities, .01)
    assert threshold == .9
    assert policy['source'] == 'validation only'
    metrics = evaluate(labels, probabilities, threshold)
    assert metrics['falsePositiveRate'] == 0 and metrics['recall'] == .5
    with pytest.raises(ValueError, match='No useful'):
        select_threshold(labels, np.asarray([.7, .8, .9, .1, .2]), .01)


def test_balance_features_match_serving_and_distinguish_missing_from_zero():
    from app.services.scoring import balance_feature_matrix
    for kind in ('TRANSFER', 'withdrawal', 'PAYMENT', 'CASH_IN', 'UNKNOWN'):
        for balance in (None, 0, 1000):
            matrix = balance_feature_matrix([100], [12.5], [kind], [balance])
            assert matrix[0] == pytest.approx(feature_row(100, 12.5, kind, 3, balance), abs=1e-6)
    assert feature_row(100, 0, 'TRANSFER', 3, 0)[-1] == 0
    assert feature_row(100, 0, 'TRANSFER', 3, None)[-1] == 1
    assert feature_row(100, 0, 'CASH_IN', 3, 1000)[-3:] == [0, 0, 1]


@pytest.mark.parametrize('balance', [-1, 'NaN', 'Infinity', '1.00001'])
def test_invalid_pre_balance_rejected(client, balance):
    body = payload(); body['transactions'][0]['availableBalance'] = balance
    assert client.post('/ml/transaction-score', json=body).status_code == 422


def test_candidate_comparison_roundtrip_and_validation_only_selection(tmp_path):
    from app.training.improve import compare
    frame = synthetic_frame(4000, 42)
    frame['type'] = 'CASH_OUT'
    # Deliberate synthetic signal tests plumbing, not real fraud accuracy.
    frame['oldbalanceOrg'] = frame.amount * np.where(frame.isFraud == 1, 1., 3.)
    frame['newbalanceOrig'] = float('inf')  # Post-outcome columns must never enter input validation/features.
    report = compare(frame, tmp_path, 'synthetic-fixture', max_train_rows=2000)
    eligible = [item for item in report['candidateReports'] if item['eligible']]
    winner = max(eligible, key=lambda item: (item['validation']['recall'], item['validation']['precision'], item['validation']['averagePrecision']))
    assert report['selectedCandidate'] == winner['name']
    assert report['thresholdSelection']['source'] == 'validation only'
    assert report['trainRows'] + report['validationRows'] + report['testRows'] == len(frame)
    assert report['testWithoutBalance'] and report['testWithAvailableAmountRules']
    scorer = Scorer('trained', str(tmp_path/'model.joblib'))
    tx = TransactionInput(amount=100, timestamp='2026-10-09T12:00:00Z', transactionType='CASH_OUT', availableBalance=100)
    result = scorer.score(tx)
    assert len(result['shapTopFeatures']) == 12
    explained = float(np.asarray(scorer.explainer.expected_value).item()) + sum(item['contribution'] for item in result['shapTopFeatures'])
    row = np.asarray([feature_row(100, 12, 'CASH_OUT', 3, 100)])
    assert explained == pytest.approx(scorer.bundle['model'].decision_function(row)[0], abs=1e-6)
    tx.availableBalance = None
    assert 'balance context unavailable' in scorer.score(tx)['explanation']
