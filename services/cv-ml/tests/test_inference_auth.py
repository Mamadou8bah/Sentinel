from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from app.api.security import InferenceAuth

def application():
    app=FastAPI()
    @app.get('/health')
    def health(): return {'status':'UP'}
    @app.post('/inference')
    def inference(): return {'ok':True}
    app.add_middleware(InferenceAuth)
    return app

def test_remote_inference_requires_secret_and_keeps_health_public(monkeypatch):
    monkeypatch.setenv('ML_SERVICE_API_KEY','test-key-long-enough-for-hosting-123456')
    client=TestClient(application())
    assert client.get('/health').status_code==200
    assert client.post('/inference').status_code==401
    assert client.post('/inference',headers={'X-ML-API-Key':'wrong'}).status_code==401
    assert client.post('/inference',headers={'X-ML-API-Key':'test-key-long-enough-for-hosting-123456'}).status_code==200

def test_space_refuses_unprotected_inference(monkeypatch):
    monkeypatch.setenv('SPACE_ID','example/service')
    monkeypatch.delenv('ML_SERVICE_API_KEY',raising=False)
    with pytest.raises(RuntimeError,match='ML_SERVICE_API_KEY'):
        TestClient(application()).get('/health')
