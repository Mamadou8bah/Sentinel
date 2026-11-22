from fastapi import APIRouter, HTTPException

from app.api.schemas import KycRequest, LivenessRequest, RecordingKycRequest, DocumentRequest
from app.services.evidence import inspect_image
from app.services.identity import IdentityModels
from app.storage.challenges import ChallengeError, ChallengeStore
import logging

log = logging.getLogger(__name__)


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

    @api.get('/cv/liveness/challenge/{identifier}')
    def challenge_status(identifier: str):
        try:
            return {'challengeId': identifier, 'instructions': store.instructions(identifier)}
        except ChallengeError as error:
            raise HTTPException(error.status, str(error)) from None

    @api.post('/cv/document-verify')
    def document_verify(request: DocumentRequest):
        evidence = inspect(request.documentImage)
        if request.referenceSignature is not None:
            inspect(request.referenceSignature)
        try:
            result = models.document_verify(request.documentImage, request.docType, request.referenceSignature)
            if not evidence['qualityOk']:
                result.update(modelRan=False, documentChecksAccepted=False, manualReviewRequired=True)
                result['signals'].append('LOW_IMAGE_QUALITY')
            return {**result, 'qualityOk': evidence['qualityOk'], 'pipeline': 'document-checks-v1'}
        except ValueError as error:
            raise HTTPException(422, str(error)) from None
        except Exception:
            raise HTTPException(503, 'Document inference unavailable') from None

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
        from app.services.faces import rgb_image, locate_face, locate_document_face
        stage = 'document'
        try:
            document = inspect_image(request.idImage)
            instructions = store.instructions(request.challengeId)
            stage = 'recording'
            raw, extension = recording_bytes(request.videoBase64)
            input_hash = hashlib.sha256((document['sha256'] + ":" + hashlib.sha256(raw).hexdigest()).encode()).hexdigest()
            previous = store.result(request.challengeId)
            if previous is not None:
                if previous.get('inputHash') != input_hash:
                    raise HTTPException(409, "Challenge already bound to other document or recording")
                return previous['response']
            stage = 'document'
            pretrained = getattr(models, 'pretrained', None)
            document_rgb = rgb_image(request.idImage, encoded=True)
            if pretrained is not None and pretrained.loaded:
                locate_document_face(document_rgb, pretrained.embedding, pretrained.face_threshold)
            else:
                locate_face(document_rgb)
            stage = 'recording'
            track = analyze_recording(raw, extension, instructions)
            stage = 'inference'
            result = models.recording_kyc(request.idImage, track, instructions)
            if result.get('verificationDecision') == 'UNAVAILABLE':
                # Do not consume/cache an infrastructure failure or permanently
                # reject a customer because a required model is not ready.
                raise HTTPException(503, {'code': 'KYC_AUTOMATION_UNAVAILABLE',
                                          'reasons': result.get('decisionReasons', [])})
            reasons = set(result.get('decisionReasons', []))
            capture_problems = {'REQUIRED_ID_FIELDS_UNREADABLE', 'EXPIRY_NOT_ESTABLISHED',
                'VALID_DOCUMENT_DATES_REQUIRED', 'UNREADABLE_DOB', 'UNREADABLE_EXPIRYDATE',
                'MRZ_UNREADABLE', 'MRZ_CHECK_DIGIT_MISMATCH'}
            if (models.ready and result.get('verificationDecision') == 'REJECTED'
                    and reasons & capture_problems
                    and reasons <= capture_problems | {'DOCUMENT_CHECKS_REJECTED'}):
                log.info('KYC capture rejected; stage=document code=DOCUMENT_FIELDS_UNREADABLE')
                raise HTTPException(422, {'code': 'DOCUMENT_FIELDS_UNREADABLE', 'retryFrom': 'document'})
            if reasons:
                log.info('KYC decision=%s reasons=%s', result.get('verificationDecision'), ','.join(sorted(reasons)))
            explanation = 'Required automatic identity checks ran' if result['modelRan'] else 'Required automatic checks did not all pass'
            if result.get('approvalPolicy') == 'pretrained-thresholds' and not result.get('localAccuracyValidated'):
                explanation += ' using pretrained thresholds; local accuracy is unvalidated'
            if reasons:
                explanation += '; failed checks: ' + ', '.join(sorted(reasons))
            response = {**result, "qualityOk": True, "pipeline": "recording-face-v2",
                        "challengeId": request.challengeId, "recordingFormat": extension[1:],
                        "recordingSha256": track['recordingSha256'], "sampledFrames": track['sampledFrames'],
                        "durationSeconds": track['durationSeconds'],
                        "explanation": explanation}
            store.consume(request.challengeId, {"inputHash": input_hash, "response": response})
            return response
        except ChallengeError as error:
            raise HTTPException(error.status, str(error)) from None
        except ValueError as error:
            from app.services.capture_errors import rejection
            if stage == 'inference':
                log.warning('Recording inference failed; code=KYC_PROCESSING_UNAVAILABLE')
                raise HTTPException(503, {'code': 'KYC_PROCESSING_UNAVAILABLE'}) from None
            detail = rejection(stage, error)
            log.info('KYC capture rejected; stage=%s code=%s', stage, detail['code'])
            raise HTTPException(422, detail) from None
        except HTTPException:
            raise
        except Exception:
            log.warning('Recording verification unavailable; stage=%s', stage)
            raise HTTPException(503, "Recording verification unavailable") from None


    return api
