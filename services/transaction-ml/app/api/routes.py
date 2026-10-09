import logging

from fastapi import APIRouter, HTTPException

from app.api.schemas import ScoreRequest
from app.services.scoring import Scorer

log = logging.getLogger(__name__)


def create_router(scorer: Scorer | None, configured_mode: str) -> APIRouter:
    api = APIRouter()

    @api.get("/health")
    def health():
        if scorer is None:
            raise HTTPException(503, "Configured model is unavailable; no rule fallback")
        return {"status": "UP", "mode": configured_mode, "modelLoaded": scorer.bundle is not None}

    @api.post("/ml/transaction-score")
    def score(request: ScoreRequest):
        if scorer is None:
            raise HTTPException(503, "Configured model is unavailable; no rule fallback")
        try:
            return {"scores": [scorer.score(tx) for tx in request.transactions]}
        except Exception:
            log.exception("Transaction inference failed")
            raise HTTPException(503, "Inference unavailable; no fallback") from None

    return api
