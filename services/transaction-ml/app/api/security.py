"""Service-to-service authentication for remotely hosted inference."""
import os
import secrets
from starlette.responses import JSONResponse

class InferenceAuth:
    def __init__(self, app):
        self.app = app
        self.key = os.getenv("ML_SERVICE_API_KEY", "")
        if os.getenv("SPACE_ID") and len(self.key) < 32:
            raise RuntimeError("Set a ML_SERVICE_API_KEY secret of at least 32 characters before hosting inference")

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("path") in {"/", "/health"}:
            return await self.app(scope, receive, send)
        provided = dict(scope.get("headers", [])).get(b"x-ml-api-key", b"")
        if self.key and not secrets.compare_digest(provided, self.key.encode("utf-8")):
            return await JSONResponse({"detail": "Inference authentication required"}, status_code=401)(scope, receive, send)
        return await self.app(scope, receive, send)
