"""Actual CUDA MiniFASNet inference inside Hugging Face's free ZeroGPU allocation."""
import os
import secrets

import numpy as np


def checked_batches(batches, service_key):
    expected = os.getenv('ML_SERVICE_API_KEY', '')
    if len(expected) < 32 or not isinstance(service_key, str) or not secrets.compare_digest(service_key, expected):
        raise PermissionError('Inference authentication required')
    if not isinstance(batches, (list, tuple)) or len(batches) != 2:
        raise ValueError('Exactly two context scales are required')
    arrays = [np.asarray(batch, dtype=np.float32) for batch in batches]
    count = len(arrays[0])
    if not 1 <= count <= 48 or any(array.shape != (count, 3, 80, 80) or not np.isfinite(array).all()
                                     or array.min() < 0 or array.max() > 255 for array in arrays):
        raise ValueError('Invalid anti-spoof model batch')
    return arrays


def create_predictor(models):
    import spaces
    import torch
    # ZeroGPU virtual CUDA must see the model tensors during module startup.
    module = torch.nn.ModuleList([model for model, _scale in models]).eval().to('cuda')

    @spaces.GPU(duration=10)
    def predict(batches, service_key):
        arrays = checked_batches(batches, service_key)
        probabilities = []
        with torch.inference_mode():
            for model, array in zip(module, arrays, strict=True):
                tensor = torch.as_tensor(array, device='cuda')
                logits = model(tensor)
                if not logits.is_cuda or logits.shape != (len(array), 3) or not torch.isfinite(logits).all():
                    raise RuntimeError('CUDA anti-spoof inference unavailable')
                probabilities.append(logits.softmax(dim=1).cpu().numpy().tolist())
        return {'device': logits.device.type, 'probabilities': probabilities}

    return predict
