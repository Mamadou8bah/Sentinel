"""Artifact contract fixtures only: invented metrics below are not accuracy evidence."""
import hashlib
from io import BytesIO
import importlib.util
import json
from pathlib import Path
import zipfile

import pytest
import torch

from app.models.network import IdentityModel
from app.services.faces import PREPROCESSING, DETECTOR_SHA256

spec = importlib.util.spec_from_file_location(
    "identity_import", Path(__file__).resolve().parents[3] / "scripts/import_identity_artifacts.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def artifact_fixture(path, prefix="", bad_hash=False, research=False):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        for task in module.TASKS:
            data = BytesIO()
            torch.save(IdentityModel(task).state_dict(), data)
            weights = data.getvalue()
            measurement = {"total": 100, "exactMatches": 100} if task == "ocr" else {"tp": 100, "tn": 100, "fp": 0, "fn": 0}
            report = {"schemaVersion": 2, "task": task, "threshold": .5,
                "preprocessing": PREPROCESSING, "detectorSha256": DETECTOR_SHA256,
                "weightsSha256": "wrong" if bad_hash else hashlib.sha256(weights).hexdigest(),
                "evaluation": {"validation": measurement, "test": measurement},
                "scope": "research-pretraining" if research else "representative-kyc"}
            archive.writestr(f"{prefix}{task}/weights.pt", weights)
            archive.writestr(f"{prefix}{task}/evaluation.json", json.dumps(report))


@pytest.mark.parametrize("prefix", ["", "identity/"])
def test_validated_contract_installs_to_new_directory(tmp_path, prefix):
    archive = tmp_path / "models.zip"
    artifact_fixture(archive, prefix)
    output = tmp_path / "new-artifacts"
    result = module.install(archive, output)
    assert result["verificationReady"] and result["restartRequired"]
    assert all((output / task / "weights.pt").is_file() for task in module.TASKS)
    with pytest.raises(ValueError, match="never overwritten"):
        module.install(archive, output)


@pytest.mark.parametrize("bad_hash,research", [(True, False), (False, True)])
def test_invalid_models_never_leave_an_installed_directory(tmp_path, bad_hash, research):
    archive = tmp_path / "models.zip"
    artifact_fixture(archive, bad_hash=bad_hash, research=research)
    output = tmp_path / "rejected"
    with pytest.raises(ValueError):
        module.install(archive, output)
    assert not output.exists()
    assert not list(tmp_path.glob(".identity-import-*"))


def test_zip_paths_and_partial_model_sets_are_rejected(tmp_path):
    unsafe = tmp_path / "unsafe.zip"
    with zipfile.ZipFile(unsafe, "w") as archive:
        archive.writestr("../escape.pt", "invalid")
    with pytest.raises(ValueError, match="Unsafe"):
        module.install(unsafe, tmp_path / "unsafe-output")
    partial = tmp_path / "partial.zip"
    with zipfile.ZipFile(partial, "w") as archive:
        archive.writestr("face/research_evaluation.json", "{}")
    with pytest.raises(ValueError, match="Missing deployable"):
        module.install(partial, tmp_path / "partial-output")
