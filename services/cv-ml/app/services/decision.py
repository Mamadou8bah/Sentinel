"""Automatic decisions from validated evidence; no manual approval fallback."""
import math
import re
from datetime import date


UNAVAILABLE = {
    'PRETRAINED_FACE_MODELS_UNAVAILABLE', 'DOCUMENT_CHECKS_UNAVAILABLE', 'OCR_MODEL_UNAVAILABLE',
    'DOCUMENT_AUTHENTICITY_UNAVAILABLE', 'PRETRAINED_HOLDOUT_EVALUATION_REQUIRED',
    'OCR_HOLDOUT_EVALUATION_REQUIRED', 'TAMPERING_HOLDOUT_EVALUATION_REQUIRED',
}


def automatic_decision(result, ready, face_threshold, live_threshold):
    reasons = set(result.get('signals', []))
    if not ready or not result.get('modelRan'):
        state = 'UNAVAILABLE' if not ready or reasons & UNAVAILABLE else 'REJECTED'
        if not ready: reasons.add('REQUIRED_MODELS_OR_EVALUATION_UNAVAILABLE')
        elif not reasons: reasons.add('DOCUMENT_CHECKS_REJECTED')
        return {'verificationDecision': state, 'automaticApproval': False, 'decisionReasons': sorted(reasons)}
    for field, threshold, reason in [('faceMatchScore', face_threshold, 'FACE_MATCH_REJECTED'),
                                      ('livenessScore', live_threshold, 'LIVENESS_REJECTED')]:
        score = result.get(field)
        if type(score) not in (int, float) or not math.isfinite(score) or not 0 <= score <= 1 or score < threshold:
            reasons.add(reason)
    if result.get('spoofLikely') is not False:
        reasons.add('PRESENTATION_ATTACK_SUSPECTED')
    if result.get('documentChecksAccepted') is not True:
        reasons.add('DOCUMENT_CHECKS_REJECTED')
    if result.get('recordingChallengePassed') is not True or type(result.get('comparedFrames')) is not int or result['comparedFrames'] < 25:
        reasons.add('RECORDING_CHALLENGE_NOT_CONFIRMED')
    fields = result.get('extractedFields', {})
    if not isinstance(fields, dict): fields = {}
    if not isinstance(fields.get('idNumber'), str) or not re.fullmatch(r'[A-Z0-9][A-Z0-9-]{2,39}', fields['idNumber']) or not fields.get('dob'):
        reasons.add('REQUIRED_ID_FIELDS_UNREADABLE')
    try:
        birth, expiry = date.fromisoformat(fields['dob']), date.fromisoformat(fields['expiryDate'])
        if birth > date.today() or expiry < date.today() or expiry <= birth:
            reasons.add('INVALID_OR_EXPIRED_DOCUMENT_DATES')
    except (KeyError, TypeError, ValueError):
        reasons.add('VALID_DOCUMENT_DATES_REQUIRED')
    decision = 'REJECTED' if reasons else 'APPROVED'
    return {'verificationDecision': decision, 'automaticApproval': decision == 'APPROVED',
            'decisionReasons': sorted(reasons)}
