import os

from fastapi import FastAPI

from app.api.routes import create_router
from app.storage.challenges import ChallengeStore
from app.services.identity import IdentityModels


def create_app(database: str | None = None, model_directory: str | None = None) -> FastAPI:
    api = FastAPI(title="Sentinel Identity Evidence", version="1.0.0")
    from app.api.limits import BodyLimit
    api.add_middleware(BodyLimit)
    store = ChallengeStore(database or os.getenv("CV_CHALLENGE_DB", "runtime/challenges.sqlite3"))
    models = IdentityModels(model_directory or os.getenv("CV_ML_ARTIFACT_DIR"))
    from app.api.security import InferenceAuth
    api.add_middleware(InferenceAuth)
    @api.get("/")
    def service_info():
        return {"service": api.title, "health": "/health"}

    api.include_router(create_router(store, models))
    return api


app = create_app()
