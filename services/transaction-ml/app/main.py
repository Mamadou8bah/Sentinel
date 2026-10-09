import logging
import os

from fastapi import FastAPI

from app.api.routes import create_router
from app.services.scoring import Scorer

log = logging.getLogger(__name__)


def create_app(mode: str | None = None, model_path: str | None = None) -> FastAPI:
    api = FastAPI(title="Sentinel Transaction ML", version="1.0.0")
    configured_mode = mode or os.getenv("TRANSACTION_ML_MODE", "rules")
    try:
        scorer = Scorer(configured_mode, model_path or os.getenv("TRANSACTION_ML_MODEL_PATH"))
    except Exception:
        log.exception("Transaction scorer configuration failed")
        scorer = None

    api.include_router(create_router(scorer, configured_mode))
    return api


app = create_app()
