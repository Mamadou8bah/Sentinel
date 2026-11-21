import numpy as np
import pytest

torch = pytest.importorskip("torch")
from sklearn.ensemble import GradientBoostingClassifier
from app.services.torch_trees import TorchGradientBoosting


@pytest.mark.parametrize("init", [None, "zero"])
def test_tensor_predictions_match_sklearn_at_split_boundaries(init):
    rng = np.random.default_rng(42)
    x = rng.normal(size=(180, 4)).astype(np.float32)
    y = (x[:, 0] + x[:, 1] * 2 > .3).astype(int)
    model = GradientBoostingClassifier(n_estimators=12, max_depth=3, init=init, random_state=42).fit(x, y)
    rows = [x]
    for tree in model.estimators_[:, 0]:
        for feature, threshold in zip(tree.tree_.feature, tree.tree_.threshold):
            if feature < 0:
                continue
            boundary = np.zeros((3, 4), dtype=np.float32)
            value = np.float32(threshold)
            boundary[:, feature] = [np.nextafter(value, np.float32(-np.inf)), value,
                                     np.nextafter(value, np.float32(np.inf))]
            rows.append(boundary)
    rows = np.concatenate(rows)
    with torch.inference_mode():
        actual = TorchGradientBoosting(model)(torch.from_numpy(rows)).numpy()
    expected = model.predict_proba(rows)
    np.testing.assert_allclose(actual, expected, rtol=1e-12, atol=1e-12)


def test_histogram_model_cannot_be_silently_converted():
    from sklearn.ensemble import HistGradientBoostingClassifier
    with pytest.raises(ValueError, match="binary GradientBoostingClassifier"):
        TorchGradientBoosting(HistGradientBoostingClassifier())
