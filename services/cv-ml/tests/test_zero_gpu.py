import numpy as np
import pytest

from app.services.zero_gpu import checked_batches


def test_gpu_worker_authenticates_before_processing_payload(monkeypatch):
    monkeypatch.setenv('ML_SERVICE_API_KEY', 'test-only-key-' * 4)
    class ForbiddenConversion:
        def __array__(self, *_args, **_kwargs):
            raise AssertionError('Unauthorised payload must not be processed')
    with pytest.raises(PermissionError):
        checked_batches([ForbiddenConversion(), ForbiddenConversion()], 'invalid')


@pytest.mark.parametrize('shape,value', [((0, 3, 80, 80), 0), ((49, 3, 80, 80), 0),
                                         ((1, 3, 79, 80), 0), ((1, 3, 80, 80), float('nan')),
                                         ((1, 3, 80, 80), -1), ((1, 3, 80, 80), 256)])
def test_gpu_worker_bounds_tensor_shape_and_raw_pixel_range(monkeypatch, shape, value):
    key = 'test-only-key-' * 4
    monkeypatch.setenv('ML_SERVICE_API_KEY', key)
    with pytest.raises(ValueError):
        checked_batches([np.full(shape, value), np.full(shape, value)], key)


def test_two_valid_context_batches_preserve_raw_values(monkeypatch):
    key = 'test-only-key-' * 4
    monkeypatch.setenv('ML_SERVICE_API_KEY', key)
    outputs = checked_batches([np.full((30, 3, 80, 80), 128)] * 2, key)
    assert all(array.dtype == np.float32 and array[0, 0, 0, 0] == 128 for array in outputs)
