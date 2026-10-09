from fastapi import APIRouter, HTTPException

from app.api.schemas import KycRequest, LivenessRequest
from app.services.evidence import inspect_image
from app.services.identity import IdentityModels
from app.storage.challenges import ChallengeError, ChallengeStore


def create_router(store: ChallengeStore, models: IdentityModels) -> APIRouter:
    api = APIRouter()

    def inspect(encoded: str) -> dict:
        try:
            return inspect_image(encoded)
        except ValueError as error:
            raise HTTPException(422, str(error)) from None

    @api.get("/health")
    def health():
        return {"status": "UP", **models.health()}

    @api.post("/cv/liveness/challenge")
    def challenge():
        return store.create()

    @api.post("/cv/liveness/verify")
    def verify(request: LivenessRequest):
        if len(request.frames) != 3:
            raise HTTPException(422, "Supply exactly three frames in the issued challenge order")
        evidence = [inspect(frame) for frame in request.frames]
        duplicates = len({item["sha256"] for item in evidence}) != len(evidence)
        quality = all(item["qualityOk"] for item in evidence)
        try:
            instructions = store.instructions(request.challengeId)
            inference = models.liveness(request.frames, instructions)
        except ChallengeError as error:
            raise HTTPException(error.status, str(error)) from None
        except Exception:
            raise HTTPException(503, "Liveness inference unavailable") from None
        signals = inference["signals"]
        if duplicates:
            signals.append("DUPLICATE_FRAMES")
        if not quality:
            signals.append("LOW_IMAGE_QUALITY")
        result = {"livenessScore": inference["livenessScore"] if quality and not duplicates else 0.,
                  "spoofLikely": duplicates or inference["spoofLikely"], "qualityOk": quality,
                  "signals": signals, "modelRan": inference["modelRan"], "lastFrameHash": evidence[-1]["sha256"],
                  "frameHashes": [item["sha256"] for item in evidence]}
        try:
            store.consume(request.challengeId, result)
        except ChallengeError as error:
            raise HTTPException(error.status, str(error)) from None
        return {key: value for key, value in result.items() if key not in {"lastFrameHash", "frameHashes"}}

    @api.post("/cv/kyc-verify")
    def kyc(request: KycRequest):
        document = inspect(request.idImage)
        selfie = inspect(request.selfieImage)
        if request.frames:
            if not request.challengeId:
                raise HTTPException(422, "Frames require the issued challenge ID")
            # Retry of the same already-scored evidence is safe; another body cannot replace it.
            previous = store.result(request.challengeId)
            if previous is None:
                verify(LivenessRequest(challengeId=request.challengeId, frames=request.frames))
            elif previous.get("frameHashes") != [inspect(frame)["sha256"] for frame in request.frames]:
                raise HTTPException(409, "Challenge already bound to other evidence")
        live = store.result(request.challengeId) if request.challengeId else None
        bound = live is not None and live["lastFrameHash"] == selfie["sha256"]
        try:
            result = models.kyc(request.idImage, request.selfieImage)
        except Exception:
            raise HTTPException(503, "Identity inference unavailable") from None
        signals = result["signals"]
        if not bound:
            signals.append("NO_MATCHING_LIVENESS_EVIDENCE")
        quality = document["qualityOk"] and selfie["qualityOk"] and bool(live and live["qualityOk"])
        trusted = result["modelRan"] and bool(live and live["modelRan"]) and bound and quality
        return {**result, "livenessScore": live["livenessScore"] if bound else 0.,
                "spoofLikely": bool(live and live["spoofLikely"]), "qualityOk": quality,
                "modelRan": trusted, "signals": signals,
                "explanation": "Evaluated identity models ran" if trusted else "Identity models unavailable or evidence invalid; evidence cannot grant VERIFIED status"}


    return api
