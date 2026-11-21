"""The public Gradio mount must not expose an unauthenticated scoring path."""
import importlib

import pytest
from fastapi.testclient import TestClient

pytest.importorskip("gradio")


def test_space_preserves_api_authentication(monkeypatch):
    monkeypatch.setenv("SPACE_ID", "test/sentinel-fraud")
    monkeypatch.setenv("ML_SERVICE_API_KEY", "test-key-" * 8)
    monkeypatch.setenv("TRANSACTION_ML_MODE", "rules")
    monkeypatch.setenv("TRANSACTION_ML_ZERO_GPU", "0")
    space = importlib.import_module("space_app")
    with TestClient(space.create_space_app()) as client:
        assert client.get("/ui/").status_code == 200
        assert client.get("/health").status_code == 200
        payload = {"transactions": [{"amount": 100, "timestamp": "2026-10-31T12:00:00Z"}]}
        assert client.post("/ml/transaction-score", json=payload).status_code == 401
        response = client.post(
            "/ml/transaction-score", json=payload,
            headers={"X-ML-API-Key": "test-key-" * 8},
        )
        assert response.status_code == 200
        assert len(response.json()["scores"]) == 1
