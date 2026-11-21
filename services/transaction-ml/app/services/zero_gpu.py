"""Real CUDA prediction inside a Hugging Face ZeroGPU allocation."""
import numpy as np
import spaces
import torch

from app.services.torch_trees import TorchGradientBoosting


def create_predictor(model):
    # ZeroGPU emulates CUDA during startup and restores tensors when allocated.
    module = TorchGradientBoosting(model).eval().to("cuda")

    @spaces.GPU(duration=10)
    def predict(rows):
        with torch.inference_mode():
            inputs = torch.as_tensor(np.asarray(rows, dtype=np.float32), device="cuda")
            return module(inputs).cpu().numpy().tolist()

    return predict
