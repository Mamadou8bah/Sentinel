"""Exact tree traversal for the supported binary sklearn gradient boosting model."""
import numpy as np
import torch
from sklearn.ensemble import GradientBoostingClassifier


class TorchGradientBoosting(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        if not isinstance(model, GradientBoostingClassifier) or len(model.classes_) != 2:
            raise ValueError("GPU serving supports binary GradientBoostingClassifier only")
        trees = [estimator[0].tree_ for estimator in model.estimators_]
        width = max(tree.node_count for tree in trees)
        self.depth = max(tree.max_depth for tree in trees)
        for name, dtype in (("feature", np.int64), ("children_left", np.int64),
                            ("children_right", np.int64), ("threshold", np.float64),
                            ("value", np.float64)):
            values = np.zeros((len(trees), width), dtype=dtype)
            for i, tree in enumerate(trees):
                source = getattr(tree, name).reshape(-1)
                values[i, :tree.node_count] = source
            self.register_buffer(name, torch.from_numpy(values))
        # sklearn converts tree inputs to float32; thresholds/outputs remain doubles.
        self.register_buffer("initial", torch.tensor(
            float(model._raw_predict_init(np.zeros((1, model.n_features_in_), dtype=np.float32))[0, 0]),
            dtype=torch.float64))
        if model.init != "zero" and not hasattr(model.init_, "class_prior_"):
            raise ValueError("GPU serving requires a constant sklearn initial estimator")
        self.rate = float(model.learning_rate)

    def forward(self, rows):
        rows = rows.to(dtype=torch.float32)
        tree_ids = torch.arange(self.feature.shape[0], device=rows.device)[None, :]
        nodes = torch.zeros((rows.shape[0], self.feature.shape[0]), dtype=torch.long, device=rows.device)
        for _ in range(self.depth):
            features = self.feature[tree_ids, nodes]
            left = self.children_left[tree_ids, nodes]
            right = self.children_right[tree_ids, nodes]
            inputs = rows.gather(1, features.clamp(min=0)).to(torch.float64)
            next_nodes = torch.where(inputs <= self.threshold[tree_ids, nodes], left, right)
            nodes = torch.where(left < 0, nodes, next_nodes)
        raw = self.initial + self.rate * self.value[tree_ids, nodes].sum(dim=1)
        probability = torch.sigmoid(raw)
        return torch.stack((1 - probability, probability), dim=1)
