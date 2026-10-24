import pytest
from app.training.run_all import preflight

def test_reports_all_missing_identity_tasks(tmp_path):
    with pytest.raises(ValueError) as failure: preflight(tmp_path)
    for task in ['face','liveness','tampering','ocr']:
        assert task+'.jsonl' in str(failure.value)
