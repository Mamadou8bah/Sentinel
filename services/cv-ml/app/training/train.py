"""Train one identity task from an explicit subject-separated JSONL manifest."""
import argparse
import hashlib
import json
from pathlib import Path
import random
import sys
from time import perf_counter

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset

from app.models.evaluation import binary_metrics, passes_gate
from app.models.network import ALPHABET, TASKS, IdentityModel, decode_text
from app.models.preprocessing import image_tensor, challenge_order


def load_manifest(path, task):
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    owners, image_splits = {}, {}
    for row in rows:
        split = row.get("split")
        groups = row.get("subjects")
        if split not in {"train", "validation", "test"} or not isinstance(groups, list) or not groups:
            raise ValueError("Every row needs split=train/validation/test and a nonempty subjects list")
        for group in groups:
            if not isinstance(group, str) or not group:
                raise ValueError("Subject/source group identifiers must be nonempty strings")
            if group in owners and owners[group] != split:
                raise ValueError("Subject/source leakage across dataset splits")
            owners[group] = split
        paths = row.get("images")
        expected = 2 if task == "face" else 3 if task == "liveness" else 1
        if not isinstance(paths, list) or len(paths) != expected:
            raise ValueError(f"{task} requires {expected} image(s) per row")
        for value in paths:
            candidate = (path.parent / value).resolve()
            if not candidate.is_relative_to(path.parent.resolve()) or not candidate.is_file():
                raise ValueError("Image files must exist beneath the manifest directory")
            fingerprint = hashlib.sha256(candidate.read_bytes()).hexdigest()
            if fingerprint in image_splits and image_splits[fingerprint] != split:
                raise ValueError("Identical image content leaks across dataset splits")
            image_splits[fingerprint] = split
        if task == "ocr":
            text = row.get("text", "")
            if not text or len(text) > 96 or any(c not in ALPHABET for c in text):
                raise ValueError("OCR text must use the documented alphabet and contain 1–96 characters")
            if len(text) + sum(a == b for a, b in zip(text, text[1:])) > 128:
                raise ValueError("OCR target exceeds the CTC sequence capacity")
        elif type(row.get("label")) is not int or row["label"] not in (0, 1):
            raise ValueError("Binary task labels must be integers 0 or 1")
        if task == "liveness":
            challenge_order(row.get("instructions"))
    for split in ("train", "validation", "test"):
        subset = [row for row in rows if row["split"] == split]
        if not subset or (task != "ocr" and {r["label"] for r in subset} != {0, 1}):
            raise ValueError("Each split must be nonempty and binary tasks need both labels per split")
    return rows


class Samples(Dataset):
    def __init__(self, rows, root, task):
        self.rows, self.root, self.task = rows, root, task

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        images = [image_tensor(self.root / path, self.task) for path in row["images"]]
        images = torch.stack(images) if self.task in ("face", "liveness") else images[0]
        auxiliary = challenge_order(row["instructions"]) if self.task == "liveness" else torch.zeros(2)
        return images, auxiliary, row["text"] if self.task == "ocr" else float(row["label"])


def loss_for(task, output, targets):
    if task != "ocr":
        return torch.nn.functional.binary_cross_entropy_with_logits(output, targets.float())
    lengths = torch.tensor([len(text) for text in targets], dtype=torch.long)
    encoded = torch.tensor([ALPHABET.index(c) + 1 for text in targets for c in text], dtype=torch.long)
    return torch.nn.functional.ctc_loss(output, encoded, torch.full_like(lengths, output.shape[0]), lengths, zero_infinity=False)


def evaluate(model, loader, task, device):
    labels, probabilities, texts, predicted = [], [], [], []
    model.eval()
    with torch.inference_mode():
        for images, auxiliary, targets in loader:
            output = model(images.to(device), auxiliary.to(device))
            if task == "ocr":
                predicted.extend(decode_text(values) for values in output.argmax(-1).transpose(0, 1).tolist())
                texts.extend(targets)
            else:
                probabilities.extend(output.sigmoid().cpu().tolist())
                labels.extend(int(value) for value in targets)
    if task == "ocr":
        return {"total": len(texts), "exactMatches": sum(a == b for a, b in zip(texts, predicted, strict=True))}
    return labels, probabilities


def train(args):
    started = perf_counter()
    def progress(message):
        print(f"[{perf_counter() - started:7.1f}s] {message}", file=sys.stderr, flush=True)
    if args.epochs < 1 or args.batch_size < 1 or not 0 < args.learning_rate < 1:
        raise ValueError("Epochs and batch size must be positive")
    torch.manual_seed(args.seed); np.random.seed(args.seed); random.seed(args.seed)
    progress("Loading manifest and checking subject/source separation...")
    rows = load_manifest(args.manifest, args.task)
    # Hash actual image contents as well as the manifest, so replaced images change provenance.
    digest = hashlib.sha256(args.manifest.read_bytes())
    for path in sorted({p for row in rows for p in row["images"]}):
        digest.update(path.encode()); digest.update((args.manifest.parent / path).read_bytes())
    loaders = {}
    for split in ("train", "validation", "test"):
        subset = [row for row in rows if row["split"] == split]
        progress(f"{split}: {len(subset):,} samples")
        loaders[split] = DataLoader(Samples(subset, args.manifest.parent, args.task), batch_size=args.batch_size, shuffle=split == "train")
    device = torch.device(args.device)
    model = IdentityModel(args.task).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.learning_rate)
    best_loss = float("inf")
    best_state = None
    for epoch in range(args.epochs):
        model.train(); total = 0.0
        for batch, (images, auxiliary, targets) in enumerate(loaders["train"], 1):
            optimizer.zero_grad()
            output = model(images.to(device), auxiliary.to(device))
            if args.task != "ocr": targets = targets.to(device)
            loss = loss_for(args.task, output, targets)
            if not torch.isfinite(loss): raise ValueError("Non-finite training loss; check labels and image data")
            loss.backward(); optimizer.step(); total += loss.item()
            if batch == 1 or batch % 25 == 0 or batch == len(loaders["train"]):
                progress(f"Epoch {epoch + 1}/{args.epochs}, batch {batch}/{len(loaders['train'])}, loss={loss.item():.5f}")
        model.eval(); validation_loss = 0.0
        with torch.inference_mode():
            for images, auxiliary, targets in loaders["validation"]:
                output = model(images.to(device), auxiliary.to(device))
                if args.task != "ocr": targets = targets.to(device)
                validation_loss += loss_for(args.task, output, targets).item()
        if not np.isfinite(validation_loss): raise ValueError("Non-finite validation loss")
        if validation_loss < best_loss:
            best_loss = validation_loss
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}
        progress(f"Epoch complete: train loss={total / len(loaders['train']):.5f}, validation loss={validation_loss / len(loaders['validation']):.5f}")
    model.load_state_dict(best_state)
    validation = evaluate(model, loaders["validation"], args.task, device)
    threshold = .5
    if args.task != "ocr":
        labels, probabilities = validation
        # Select solely on validation; test labels never influence model or threshold.
        candidates = np.linspace(.01, .99, 99)
        def objective(t):
            m = binary_metrics(labels, probabilities, t)
            sensitivity = m['tp'] / (m['tp'] + m['fn']); specificity = m['tn'] / (m['tn'] + m['fp'])
            feasible = sensitivity >= .99 if args.task == 'tampering' else specificity >= .99
            return feasible, specificity if args.task == 'tampering' else sensitivity
        threshold = float(max(candidates, key=objective))
        validation = binary_metrics(labels, probabilities, threshold)
    test = evaluate(model, loaders["test"], args.task, device)
    if args.task != "ocr": test = binary_metrics(*test, threshold)
    report = {"validation": validation, "test": test}
    args.output.mkdir(parents=True, exist_ok=True)
    weights = args.output / 'weights.pt'
    torch.save(best_state, weights)
    metadata = {"schemaVersion": 1, "task": args.task, "threshold": threshold, "evaluation": report,
                "datasetSha256": digest.hexdigest(), "weightsSha256": hashlib.sha256(weights.read_bytes()).hexdigest(),
                "seed": args.seed, "epochs": args.epochs, "torchVersion": torch.__version__,
                "accepted": passes_gate(args.task, report),
                "limitations": "Small supervised baseline; empirical gates are not production certification. Evaluate representative unseen identities, document types and physical/replay attacks."}
    (args.output / 'evaluation.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    progress(f"Saved {args.output.resolve()}; evaluation gate: {'PASS' if metadata['accepted'] else 'FAIL (verification remains unavailable)'}")
    print(json.dumps(metadata, indent=2))
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--task', required=True, choices=TASKS)
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--epochs', type=int, default=20)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--learning-rate', type=float, default=.001)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--device', default='cpu')
    train(parser.parse_args())


if __name__ == '__main__': main()
