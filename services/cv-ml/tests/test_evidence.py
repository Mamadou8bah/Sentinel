import base64
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import sqlite3
import time

from fastapi.testclient import TestClient
from PIL import Image
import pytest

from app.main import create_app


def image(color="red", size=(96, 96)):
    out = BytesIO()
    Image.new("RGB", size, color).save(out, format="PNG")
    return base64.b64encode(out.getvalue()).decode()


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(str(tmp_path / "challenges.db")))


def test_health_does_not_claim_model_readiness(client):
    health = client.get("/health").json()
    assert health["status"] == "UP"
    assert health["verificationReady"] is False


@pytest.mark.parametrize("value", ["invalid", "aWQx", "data:text/html;base64,PHNjcmlwdD4=", "a" * 4_000_101],
                         ids=["invalid-base64", "not-image", "html-data-url", "oversized"])
def test_invalid_image_evidence_rejected(client, value):
    response = client.post("/cv/kyc-verify", json={"idImage": value, "selfieImage": image()})
    assert response.status_code == 422


def test_single_still_cannot_be_verified(client):
    response = client.post("/cv/kyc-verify", json={"idImage": image(), "selfieImage": image()})
    assert response.status_code == 200
    assert response.json()["faceMatchScore"] == response.json()["livenessScore"] == 0
    assert response.json()["modelRan"] is False
    assert "NO_MATCHING_LIVENESS_EVIDENCE" in response.json()["signals"]


def test_challenge_single_use_and_duplicate_frames_never_live(client):
    challenge = client.post("/cv/liveness/challenge").json()
    body = {"challengeId": challenge["challengeId"], "frames": [image()] * 3}
    first = client.post("/cv/liveness/verify", json=body)
    assert first.status_code == 200
    assert first.json()["spoofLikely"] is True
    assert first.json()["livenessScore"] == 0
    assert client.post("/cv/liveness/verify", json=body).status_code == 409


def test_unknown_challenge_is_rejected(client):
    assert client.post("/cv/liveness/verify", json={"challengeId": "unknown", "frames": [image()] * 3}).status_code == 404


def test_challenge_expiry_and_restart_persistence(tmp_path):
    path = str(tmp_path / "challenges.db")
    client = TestClient(create_app(path))
    challenge = client.post("/cv/liveness/challenge").json()["challengeId"]
    with sqlite3.connect(path) as db:
        db.execute("UPDATE challenges SET expires=? WHERE id=?", (time.time() - 1, challenge))
    restarted = TestClient(create_app(path))
    assert restarted.post("/cv/liveness/verify", json={"challengeId": challenge, "frames": [image()] * 3}).status_code == 410


def test_concurrent_consumes_have_one_success(client):
    challenge = client.post("/cv/liveness/challenge").json()["challengeId"]
    body = {"challengeId": challenge, "frames": [image()] * 3}
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(lambda _: client.post("/cv/liveness/verify", json=body).status_code, range(2)))
    assert sorted(statuses) == [200, 409]


def test_different_frames_are_not_proof_of_anti_spoof(client):
    challenge = client.post("/cv/liveness/challenge").json()["challengeId"]
    result = client.post("/cv/liveness/verify", json={"challengeId": challenge, "frames": [image("red"), image("green"), image("blue")]}).json()
    assert result["livenessScore"] == 0
    assert result["modelRan"] is False


def test_kyc_binds_frames_and_can_retry_same_evidence(client):
    challenge = client.post("/cv/liveness/challenge").json()["challengeId"]
    frames = [image("red"), image("green"), image("blue")]
    body = {"idImage": image("white"), "selfieImage": frames[-1], "frames": frames, "challengeId": challenge}
    first = client.post("/cv/kyc-verify", json=body)
    assert first.status_code == 200
    assert "NO_MATCHING_LIVENESS_EVIDENCE" not in first.json()["signals"]
    assert first.json()["livenessScore"] == 0
    assert client.post("/cv/kyc-verify", json=body).status_code == 200
    body["frames"][-1] = image("black")
    assert client.post("/cv/kyc-verify", json=body).status_code == 409


def test_retry_cannot_replace_an_earlier_frame_even_with_identical_selfie(client):
    challenge = client.post("/cv/liveness/challenge").json()["challengeId"]
    frames = [image("red"), image("green"), image("blue")]
    body = {"idImage": image("white"), "selfieImage": frames[-1], "frames": frames, "challengeId": challenge}
    assert client.post("/cv/kyc-verify", json=body).status_code == 200
    body["frames"][0] = image("yellow")
    assert client.post("/cv/kyc-verify", json=body).status_code == 409


def test_extra_liveness_frames_are_rejected_without_consuming_challenge(client):
    challenge = client.post("/cv/liveness/challenge").json()["challengeId"]
    body = {"challengeId": challenge, "frames": [image()] * 4}
    assert client.post("/cv/liveness/verify", json=body).status_code == 422
    body["frames"] = body["frames"][:3]
    assert client.post("/cv/liveness/verify", json=body).status_code == 200
