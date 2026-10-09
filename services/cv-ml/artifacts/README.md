# Local identity artifacts

Training writes `identity/<task>/weights.pt` and `evaluation.json` for each of
face, liveness, tampering and OCR. Generated artifacts are ignored by Git.
The Compose inference profile mounts this folder read-only. Without accepted
artifacts, health reports verification unavailable. See the service README.
