# Evaluate pretrained models with public data

Run these commands from `sentinel/services/cv-ml`. Public benchmark results are
component diagnostics. They do not test the complete ID-to-video KYC flow, prove
that a document is authentic, or enable automatic verification. Reports never
become `acceptance.json` or `ocr-acceptance.json`. Keep data and reports in their
Git-ignored directories; never upload identity datasets to the public Space.

## Face matching: LFW, automatic download

```powershell
python -m app.models.public_data --output data/public/lfw
python -m app.models.evaluate_public --task face --dataset data/public/lfw/face-pairs.jsonl --models artifacts/pretrained --limit 200 --output artifacts/benchmarks/lfw-200.json
```

The downloader retrieves approximately 181 MB of original unaligned RGB images
and the official 6000-pair protocol from the mirror used by
[scikit-learn's LFW loader](https://github.com/scikit-learn/scikit-learn/blob/main/sklearn/datasets/_lfw.py).
It resumes interrupted downloads, verifies published SHA-256 values, bounds
archive extraction, and rejects archive links and escaping paths. It preserves
the original pair labels and fold numbers. No training occurs.

The partial run samples 100 matching and 100 nonmatching pairs using a fixed
seed. It is explicitly labelled partial. Remove `--limit 200` for all 6000 pairs.
Face detection, landmark alignment, quality rejection and SFace matching are
included. The cosine threshold is fixed at 0.363 unless explicitly changed using
`--threshold`. Do not tune it on the reported test examples.

Reports include acquisition failures, overall sensitivity/specificity, false
accept/reject rates and metrics for examples where inference actually ran.
Failed face acquisition is counted as a rejection, not silently discarded.
Original LFW folds can share identities; these are not our identity-disjoint KYC
holdouts. We have not established whether pretrained training included these
people. LFW is a face-photo benchmark, not ID-to-selfie validation. Use is subject
to the publisher's dataset and image terms; do not redistribute the photos as
application assets.

## Passive anti-spoofing: Replay-Mobile

The [publisher's dataset page](https://www.idiap.ch/en/dataset/replay-mobile)
links to [its restricted Zenodo record](https://zenodo.org/records/4593248).
Access requires the publisher's non-commercial research agreement and an
authorised institutional signatory. Request access through the publisher; no
download bypass or automated agreement submission is provided.

After approval, keep the original videos and publisher-defined protocol splits.
Create a CSV at `data/public/replay-mobile/protocol.csv` with these columns,
transcribing the official labels and subject IDs:

```csv
split,subject,video,label
validation,subject001,videos/genuine001.mov,1
validation,subject001,videos/attack001.mov,0
test,subject002,videos/genuine002.mov,1
test,subject002,videos/attack002.mov,0
```

Those paths illustrate the schema; they are not supplied dataset samples.
Use **1 for a genuine live presentation**, **0 for a photo/screen attack**. If
the publisher uses a different encoding, map it explicitly. Never infer a label
from an arbitrary filename. Development/dev/devel maps to validation; training
rows are excluded. Keep validation and test people disjoint.

```powershell
python -m app.models.import_public --task spoof --csv data/public/replay-mobile/protocol.csv --output data/public/replay-mobile/spoof.jsonl
python -m app.models.evaluate_public --task spoof --dataset data/public/replay-mobile/spoof.jsonl --models artifacts/pretrained --output artifacts/benchmarks/replay-mobile.json
```

The evaluator uses the first nine seconds at four samples/second, the same
YuNet localization and two MiniFASNet context scales as production, and the
minimum live score across acquired frames. Portrait videos up to 1920 pixels
and 2,073,600 pixels/frame are supported. Videos must have 8–60 FPS and at least
8.5 seconds of usable capture. All sampled frames must contain one clear face.
CPU inference runs locally and does not consume hosted ZeroGPU quota.

This tests **passive PAD only**. It does not call the production recording
challenge validator, invent head-turn instructions or claim these videos were
captured by our app. Acquisition failures are separated from actual model
classification so broken decoding cannot masquerade as successful anti-spoofing.

## Document OCR: MIDV-2020

Request access from the [official MIDV-2020 page](https://l3i-share.univ-lr.fr/MIDV2020/midv2020.html).
It contains mock identities, annotated scans/photos and document videos. Obtain
only the still images and annotation subset needed for OCR; the complete dataset
is roughly 124 GB and is not automatically downloaded.

Use publisher-labelled text regions/crops and their exact text, keeping crops
from a single mock identity in one split. For end-to-end extraction of printed
ID fields, the existing `evaluate_documents` command remains available. A line
transcription benchmark instead uses this CSV format, with paths to authorised
text-region crops:

```csv
split,subject,document,expectedText
validation,mock001,crops/mock001-number.png,AB1234567
test,mock002,crops/mock002-birth.png,1990-12-31
```

```powershell
python -m app.models.import_public --task ocr --csv data/public/midv2020/ocr.csv --output data/public/midv2020/ocr.jsonl
python -m app.models.evaluate_public --task ocr --dataset data/public/midv2020/ocr.jsonl --output artifacts/benchmarks/midv2020-ocr.json
```

This runs the same pinned PP-OCRv4 reader. Unicode NFC and whitespace are
normalised; case and punctuation remain significant. Reports show exact-match
counts and character error rate. Cropped-region transcription does not establish
that full-document field extraction works. The importer does not guess an
annotation format or manufacture text labels; raw MIDV annotations need a
schema-specific conversion after the authorised files are available.

## What remains after public benchmarks

Keep the reports for the project presentation and model comparisons. The full
recording challenge, document-to-video matching on representative cameras and
IDs, document authenticity, and the bank's actual decision thresholds still need
separate evaluation. Existing runtime acceptance gates remain unchanged.
