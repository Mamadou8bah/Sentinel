# Identity training datasets

Place locally obtained, authorised images and JSONL manifests here. Datasets
and weights are ignored by Git and excluded from Docker build contexts. PaySim
belongs in `../../transaction-ml/data/paysim.csv`, not this folder.

Each JSONL row represents one example. Image paths are relative to the manifest
and must remain beneath its directory. Every row needs `split` (`train`,
`validation`, `test`) and `subjects`: all person identities and attack-source
identifiers represented by the example. Keep each identity/source in exactly
one split, including both people in negative face pairs. The loader also rejects
identical image bytes across splits. Different captures from the same person
still require the same subject identifier; automatic byte checking cannot
detect incorrectly labelled subjects.

Examples below illustrate row formats, not a usable dataset. Supply all three
splits and both binary labels per split. Use representative held-out examples;
the runtime gates require at least 100 positive and 100 negative examples in
each binary holdout, and at least 100 OCR examples per holdout.

Face: complete document image and selfie (matching runtime input), label 1 for
the same person, 0 otherwise:
```json
{"split":"train","subjects":["person-001"],"images":["person-001/id.png","person-001/selfie.jpg"],"label":1}
```

Liveness: three ordered captures, label 1 only for a live person following all
instructions; label 0 for spoof/replay or incorrect order. Include both issued
instruction orders and realistic negative attacks:
```json
{"split":"train","subjects":["person-001","attack-source-001"],"images":["capture/forward.jpg","capture/left.jpg","capture/right.jpg"],"instructions":["LOOK_FORWARD","TURN_LEFT","TURN_RIGHT"],"label":0}
```

Use the exact instruction strings shown by the API (see preprocessing module);
negative examples must carry the instructions that were actually issued.

Tampering: one document image, label 1 for tampered and 0 for authentic:
```json
{"split":"train","subjects":["person-001","document-source-001"],"images":["documents/edited.png"],"label":1}
```

OCR: one document image with canonical structured text, at most 96 characters:
```json
{"split":"train","subjects":["person-001"],"images":["documents/id.png"],"text":"ID=AB123\nDOB=1998-03-04"}
```

OCR supports uppercase A-Z, digits, space, newline, `=:/-.`. This is supervised
field transcription, not general document understanding or signature checking.
See the service README for training commands and model limitations.


Face and liveness training now use the bundled YuNet detector to crop one clear
face from each source image. Supply original document/face images in manifests;
images with missing, multiple, tiny or blurred faces fail preprocessing. Runtime
uses the same detector and crop version. Retrain schema-v1 artifacts: schema-v2
reports bind the preprocessing version and detector checksum. For liveness,
extract the settled forward/left/right frames from continuous challenge videos
in their issued order. Include physical and replay attacks and evaluate full
recordings separately; still-frame metrics alone do not validate capture safety.
