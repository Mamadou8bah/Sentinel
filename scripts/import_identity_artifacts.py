"""Validate a trusted training ZIP and install all four KYC tasks into a NEW directory.

Run from the Sentinel root. No existing artifacts are overwritten, and trained
weights never bypass the application's schema/checksum/evaluation gates.
"""
import argparse
import json
from pathlib import Path, PurePosixPath
import sys
import tempfile
import zipfile

TASKS = ("face", "liveness", "tampering", "ocr")
MAXIMUM_BYTES = 100_000_000


def install(archive, output):
    archive, output = Path(archive).resolve(), Path(output).resolve()
    if not archive.is_file() or not zipfile.is_zipfile(archive):
        raise ValueError("Supply a trusted ZIP produced by identity training")
    if output.exists():
        raise ValueError("Choose a new artifact directory; existing models are never overwritten")
    service = Path(__file__).resolve().parents[1] / "services/cv-ml"
    sys.path.insert(0, str(service))
    from app.services.identity import IdentityModels

    required = {f"{task}/{name}" for task in TASKS for name in ("weights.pt", "evaluation.json")}
    with zipfile.ZipFile(archive) as bundle:
        if sum(item.file_size for item in bundle.infolist()) > MAXIMUM_BYTES:
            raise ValueError("Artifact ZIP exceeds the 100 MB expanded-size limit")
        selected = {}
        for item in bundle.infolist():
            path = PurePosixPath(item.filename)
            if path.is_absolute() or ".." in path.parts or "\\" in item.filename or ":" in item.filename:
                raise ValueError("Unsafe artifact ZIP path")
            if (item.external_attr >> 16) & 0o170000 == 0o120000 or item.flag_bits & 1:
                raise ValueError("Artifact ZIP cannot contain links or encrypted entries")
            name = item.filename.removeprefix("identity/")
            if name in required:
                if name in selected:
                    raise ValueError("ZIP contains duplicate task artifacts")
                maximum = 20_000_000 if name.endswith("weights.pt") else 256_000
                if item.file_size > maximum:
                    raise ValueError(f"Artifact too large: {name}")
                selected[name] = item
        missing = sorted(required - selected.keys())
        if missing:
            raise ValueError("Missing deployable artifacts: " + ", ".join(missing)
                             + ". Research/pretraining reports cannot substitute for evaluation.json.")
        # Stage only beneath the explicitly selected destination parent. Cleanup
        # can remove only this newly allocated staging directory, never old models.
        parent = output.parent
        parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=".identity-import-", dir=parent) as temporary:
            stage = Path(temporary).resolve()
            if stage.parent != parent or output.parent != parent:
                raise ValueError("Artifact staging escaped the destination parent")
            for name, item in selected.items():
                target = stage / name
                target.parent.mkdir(exist_ok=True)
                with bundle.open(item) as source, target.open("wb") as destination:
                    destination.write(source.read())
            for task in TASKS:
                report = json.loads((stage / task / "evaluation.json").read_text(encoding="utf-8"))
                if not isinstance(report, dict):
                    raise ValueError(f"{task}: evaluation report must be a JSON object")
                if report.get("scope") not in (None, "representative-kyc"):
                    raise ValueError(f"{task}: research-only artifacts cannot be installed as production KYC")
            models = IdentityModels(stage)
            if not models.ready:
                raise ValueError("KYC artifact validation failed for: " + ", ".join(sorted(models.errors)))
            # The source and destination were resolved and checked under parent.
            # Rename only our own new staging directory into a nonexistent target.
            if output.exists():
                raise ValueError("Destination appeared during validation; no models were replaced")
            stage.rename(output)
    return {"artifactDirectory": str(output), "verificationReady": True,
            "restartRequired": True, "tasks": list(TASKS)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = install(args.archive, args.output)
    except (ValueError, OSError, zipfile.BadZipFile) as error:
        parser.exit(2, f"Identity import failed: {error}\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
