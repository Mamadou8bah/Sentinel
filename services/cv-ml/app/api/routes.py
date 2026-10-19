from fastapi import APIRouter, HTTPException

from app.api.schemas import KycRequest, LivenessRequest, RecordingKycRequest
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
        from app.services.faces import detector, PREPROCESSING
        try:
            detector(); face_ready = True
        except Exception:
            face_ready = False
        return {"status": "UP", **models.health(), "recordingSupported": True,
                "faceDetectorLoaded": face_ready, "preprocessing": PREPROCESSING,
                "verificationReady": models.ready and face_ready}

    @api.post("/cv/liveness/challenge")
    def challenge():
        return {**store.create(), "recordingSeconds": 9, "promptSeconds": 3, "maxVideoBytes": 8_000_000}

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
        bound = live is not None and live.get("lastFrameHash") == selfie["sha256"]
        try:
            result = models.kyc(request.idImage, request.selfieImage)
        except Exception:
            raise HTTPException(503, "Identity inference unavailable") from None
        signals = result["signals"]
        if not bound:
            signals.append("NO_MATCHING_LIVENESS_EVIDENCE")
        quality = document["qualityOk"] and selfie["qualityOk"] and bool(live and live.get("qualityOk", False))
        trusted = result["modelRan"] and bool(live and live.get("modelRan", False)) and bound and quality
        return {**result, "livenessScore": live["livenessScore"] if bound else 0.,
                "spoofLikely": bool(live and live.get("spoofLikely", True)), "qualityOk": quality,
                "modelRan": False, "signals": [*signals, "CONTINUOUS_RECORDING_REQUIRED"],
                "explanation": "Evaluated identity models ran" if trusted else "Identity models unavailable or evidence invalid; evidence cannot grant VERIFIED status"}


    @api.post("/cv/kyc-verify-recording")
    def recording_kyc(request: RecordingKycRequest):
        import hashlib
        from app.services.recording import recording_bytes, analyze_recording
        from app.services.faces import rgb_image, locate_face
        document = inspect(request.idImage)
        try:
            instructions = store.instructions(request.challengeId)
            raw, extension = recording_bytes(request.videoBase64)
            input_hash = hashlib.sha256((document['sha256'] + ":" + hashlib.sha256(raw).hexdigest()).encode()).hexdigest()
            previous = store.result(request.challengeId)
            if previous is not None:
                if previous.get('inputHash') != input_hash:
                    raise HTTPException(409, "Challenge already bound to other document or recording")
                return previous['response']
            locate_face(rgb_image(request.idImage, encoded=True))
            track = analyze_recording(raw, extension, instructions)
            result = models.recording_kyc(request.idImage, track, instructions)
            response = {**result, "qualityOk": True, "pipeline": "recording-face-v2",
                        "challengeId": request.challengeId, "recordingFormat": extension[1:],
                        "recordingSha256": track['recordingSha256'], "sampledFrames": track['sampledFrames'],
                        "durationSeconds": track['durationSeconds'],
                        "explanation": "Document portrait compared against tracked video faces; liveness evaluated" if result['modelRan'] else "Evaluated identity models unavailable; recording cannot grant VERIFIED status"}
            store.consume(request.challengeId, {"inputHash": input_hash, "response": response})
            return response
        except ChallengeError as error:
            raise HTTPException(error.status, str(error)) from None
        except ValueError as error:
            raise HTTPException(422, str(error)) from None
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(503, "Recording verification unavailable") from None


    return api
