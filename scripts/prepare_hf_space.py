"""Export one ML service to a new local Docker Space directory; never upload datasets/secrets."""
import argparse
from pathlib import Path
import shutil
from importlib.metadata import version


def prepare(service, output, artifacts=None):
    source=Path(__file__).resolve().parents[1]/"services"/service
    output=Path(output).resolve()
    if output.exists() and any(output.iterdir()):
        raise ValueError("Choose a new or empty output directory")
    if output.is_relative_to(source):
        raise ValueError("Export outside the service source directory")
    if artifacts:
        artifacts=Path(artifacts).resolve()
        required=([f"{task}/{name}" for task in ("face","liveness","tampering","ocr") for name in ("weights.pt","evaluation.json")]
                  if service=="cv-ml" else ["model.joblib","evaluation.json"])
        for name in required:
            if not (artifacts/name).is_file(): raise ValueError(f"Missing artifact: {name}")
    output.mkdir(parents=True,exist_ok=True)
    shutil.copytree(source/"app",output/"app",ignore=shutil.ignore_patterns("__pycache__","*.pyc"))
    shutil.copy2(source/"requirements.txt",output/"requirements.txt")
    if artifacts and service=="transaction-ml":
        # Match the locally validated pickle/SHAP runtime instead of silently upgrading it.
        with (output/"requirements.txt").open("a",encoding="utf-8") as requirements:
            requirements.write("\n# Locally validated artifact runtime\n")
            for package in ("numpy","scikit-learn","joblib","shap"):
                requirements.write(f"{package}=={version(package)}\n")
    (output/"artifacts").mkdir(exist_ok=True)
    if artifacts:
        for name in required:
            target=output/"artifacts"/name;target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(artifacts/name,target)
    environment=("CV_ML_ARTIFACT_DIR=/home/user/app/artifacts CV_CHALLENGE_DB=/home/user/app/runtime/challenges.sqlite3"
                 if service=="cv-ml" else "TRANSACTION_ML_MODE="+("trained" if artifacts else "rules")+" TRANSACTION_ML_MODEL_PATH=/home/user/app/artifacts/model.joblib")
    torch_install="pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch && " if service=="cv-ml" else ""
    (output/"Dockerfile").write_text(f"""FROM python:3.12-slim
RUN useradd -m -u 1000 user
WORKDIR /home/user/app
COPY requirements.txt .
RUN {torch_install}pip install --no-cache-dir -r requirements.txt
COPY --chown=user:user app ./app
COPY --chown=user:user artifacts ./artifacts
RUN mkdir runtime && chown user:user runtime
ENV OMP_NUM_THREADS=2 MKL_NUM_THREADS=2 {environment}
USER user
EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--limit-concurrency", "4"]
""",encoding="utf-8")
    (output/"README.md").write_text(f"""---
title: Sentinel {service}
emoji: 🛡️
colorFrom: orange
colorTo: gray
sdk: docker
app_port: 7860
---

Set the Space secret `ML_SERVICE_API_KEY` to at least 32 random characters.
Set the identical secret on the Sentinel Java API. Do not publish credentials or
identity datasets. Health is public; inference requires `X-ML-API-Key`.

{'Evaluated artifacts included; runtime validates their reports.' if artifacts else 'No trained artifacts included; verification remains unavailable or transaction scoring explicitly uses rules.'}

CPU Basic availability and plan eligibility must be checked in your HF account.
Space restarts erase local SQLite challenge state; interrupted KYC needs a new
session. Do not present this ephemeral deployment as durable production KYC.
""",encoding="utf-8")
    (output/".gitignore").write_text(".env\n__pycache__/\nruntime/\n",encoding="utf-8")
    print(f"Prepared {service} at {output}; no upload performed.")

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--service",choices=["cv-ml","transaction-ml"],required=True)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--artifacts",type=Path)
    args=parser.parse_args()
    prepare(args.service,args.output,args.artifacts)
