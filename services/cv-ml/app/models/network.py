"""Small trainable baselines; readiness depends on independent evaluation."""
import torch
from torch import nn

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=:/-. \n"
TASKS = ("face", "liveness", "tampering", "ocr")


class Encoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.Sequential(nn.Conv2d(3, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                                    nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                                    nn.Conv2d(32, 64, 3, padding=1), nn.ReLU())

    def forward(self, images):
        return self.layers(images)


class IdentityModel(nn.Module):
    def __init__(self, task):
        super().__init__()
        if task not in TASKS:
            raise ValueError("Unknown identity task")
        self.task = task
        self.encoder = Encoder()
        if task == "face":
            self.head = nn.Sequential(nn.Linear(128, 64), nn.ReLU(), nn.Linear(64, 1))
        elif task == "liveness":
            self.sequence = nn.GRU(64, 64, batch_first=True)
            self.head = nn.Linear(66, 1)
        elif task == "tampering":
            self.head = nn.Linear(64, 1)
        else:
            self.sequence = nn.GRU(64, 64, batch_first=True, bidirectional=True)
            self.head = nn.Linear(128, len(ALPHABET) + 1)

    def embedding(self, images):
        return self.encoder(images).mean(dim=(2, 3))

    def forward(self, images, auxiliary=None):
        if self.task == "face":
            left, right = self.embedding(images[:, 0]), self.embedding(images[:, 1])
            return self.head(torch.cat(((left - right).abs(), left * right), dim=1)).squeeze(-1)
        if self.task == "liveness":
            batch, frames = images.shape[:2]
            embedded = self.embedding(images.flatten(0, 1)).reshape(batch, frames, 64)
            sequence, _ = self.sequence(embedded)
            return self.head(torch.cat((sequence[:, -1], auxiliary), dim=1)).squeeze(-1)
        if self.task == "tampering":
            return self.head(self.embedding(images)).squeeze(-1)
        # Preserve vertical order for multiline fields instead of averaging ID and DOB rows together.
        features = nn.functional.adaptive_avg_pool2d(self.encoder(images), (8, 64)).flatten(2).transpose(1, 2)
        sequence, _ = self.sequence(features)
        return self.head(sequence).transpose(0, 1).log_softmax(dim=-1)


def decode_text(indices):
    result, previous = [], None
    for index in indices:
        if index and index != previous:
            result.append(ALPHABET[index - 1])
        previous = index
    return "".join(result)
