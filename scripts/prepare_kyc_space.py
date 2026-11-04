"""Export pretrained CPU KYC to HF Docker, excluding private evidence and secrets."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

from prepare_hf_space import prepare


def prepare_kyc(pretrained, output, documents=None, sdk='docker'):
    source = Path(__file__).resolve().parents[1] / 'services/cv-ml'
    pretrained, output = Path(pretrained).resolve(), Path(output).resolve()
    manifest = json.loads((source / 'app/models/assets/pretrained-manifest.json').read_text())['models']
    files = []
    for spec in manifest.values():
        path = pretrained / spec['file']
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != spec['sha256']:
            raise ValueError('Pretrained weights missing or checksum mismatch: ' + spec['file'])
        files.append(path)
    files += [pretrained / name for name in ('acceptance.json', 'ocr-acceptance.json') if (pretrained / name).is_file()]
    if documents:
        documents = Path(documents).resolve()
        for name in ('weights.pt', 'evaluation.json'):
            if not (documents / 'tampering' / name).is_file():
                raise ValueError('Missing tampering artifact: ' + name)
    # The common exporter supports the original trained backend and is shared with fraud.
    prepare('cv-ml', output)
    target = output / 'artifacts/pretrained'
    target.mkdir()
    for path in files:
        shutil.copy2(path, target / path.name)
    if documents:
        target_doc = output / 'artifacts/tampering'
        target_doc.mkdir()
        for name in ('weights.pt', 'evaluation.json'):
            shutil.copy2(documents / 'tampering' / name, target_doc / name)
    dockerfile = output / 'Dockerfile'
    text = dockerfile.read_text(encoding='utf-8')
    libraries = 'RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*\n'
    lines = text.splitlines(keepends=True)
    text = ''.join(lines[:1]) + libraries + ''.join(lines[1:])
    text += '\nENV CV_PRETRAINED_DIR=/home/user/app/artifacts/pretrained CV_DOCUMENT_OCR=true\n'
    dockerfile.write_text(text, encoding='utf-8')
    readme_path = output / 'README.md'
    readme_path.write_text(readme_path.read_text(encoding='utf-8').replace('colorFrom: orange', 'colorFrom: yellow'), encoding='utf-8')
    with (output / 'README.md').open('a', encoding='utf-8') as readme:
        readme.write('''
## Pretrained KYC

SFace/MiniFASNet weights are bundled and checksum-verified. PP-OCRv4 mobile models
are bundled with the pinned RapidOCR package. No training or startup downloads
are needed. Inference runs on CPU. Model licences are included under app/models.

Set ML_SERVICE_API_KEY as a Space secret (at least 32 characters), matching the
Sentinel Java API. The health endpoint reports loading and evaluation separately.
Automatic verification requires independent face/OCR holdout acceptance and an
evaluated document-authenticity artifact. OCR and MRZ checks do not prove that an
ID is genuine. Missing checks return review flags and cannot grant VERIFIED.

Routes: GET /health, POST /cv/liveness/challenge,
POST /cv/kyc-verify-recording, POST /cv/document-verify.
Set the deployed Space URL as CV_ML_BASE_URL on Sentinel; keep credentials secret.
Space restarts invalidate interrupted SQLite-backed challenges. Start a new KYC
session after a restart; durable storage is required for a production deployment.
''')
    if sdk == 'gradio':
        shutil.copy2(source / 'space_app.py', output / 'space_app.py')
        dockerfile.unlink()
        with (output / 'requirements.txt').open('a') as requirements:
            requirements.write('\n# HF ZeroGPU hosting runtime\ngradio==5.49.1\nspaces>=0.51,<1\ntorch==2.8.0\n')
        (output / 'packages.txt').write_text('libgl1\nlibglib2.0-0t64\n', newline='\n')
        (output / 'README.md').write_text('''---
title: Sentinel KYC API
emoji: 🛡️
colorFrom: yellow
colorTo: gray
sdk: gradio
sdk_version: 5.49.1
python_version: '3.12'
app_file: space_app.py
---

Authenticated KYC REST service, hosted using Gradio's ZeroGPU lifecycle.
There is no public identity upload form or demo inference interface.
MiniFASNet anti-spoof inference runs on actual CUDA inside a ZeroGPU allocation.
YuNet, SFace and PP-OCRv4 run on CPU. Model weights are bundled and hash-verified.

Set ML_SERVICE_API_KEY as a Space secret (32+ characters), matching Sentinel.
GET / and GET /health are public; every inference and Gradio route requires
X-ML-API-Key. Public websocket connections are disabled. No customer secrets or
identity samples belong in this repository.

POST /cv/liveness/challenge
POST /cv/kyc-verify-recording
POST /cv/document-verify
POST /cv/runtime-check (authenticated diagnostic; consumes a GPU allocation)

Model loading and actual CUDA execution do not establish identity accuracy.
Automatic verification remains unavailable until independent face/OCR holdout
acceptance and evaluated document-authenticity checks are supplied. Missing
checks are explicitly flagged and cannot grant VERIFIED status.

ZeroGPU quotas, queues and cold starts apply. Challenges use ephemeral SQLite;
restart interrupted sessions after a Space restart. This free host does not
provide durable production identity storage or an availability guarantee.
Model licences and notices are included under app/models.
''', encoding='utf-8')
    print('Pretrained KYC export complete. No upload performed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pretrained', type=Path, default=Path('services/cv-ml/artifacts/pretrained'))
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--documents', type=Path, help='Optional evaluated directory containing tampering/weights.pt and evaluation.json')
    parser.add_argument('--sdk', choices=['docker', 'gradio'], default='docker')
    args = parser.parse_args()
    prepare_kyc(args.pretrained, args.output, args.documents, args.sdk)
