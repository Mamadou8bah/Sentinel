"""Stable capture diagnostics; never include submitted evidence or model internals."""

def rejection(stage, error):
    face = getattr(error, 'code', None)
    prefix = 'DOCUMENT' if stage == 'document' else 'VIDEO'
    suffix = {'FACE_NOT_FOUND': 'NO_FACE', 'MULTIPLE_FACES': 'MULTIPLE_FACES',
              'FACE_POSITION': 'POSITION', 'FACE_BLURRED': 'BLURRED',
              'FACE_LOW_DETAIL': 'BLURRED'}.get(face)
    text = str(error)
    if suffix is None:
        if stage == 'document':
            suffix = 'INVALID'
        elif 'track changed' in text.lower():
            suffix = 'TRACK_CHANGED'
        elif any(word in text.lower() for word in ('timing', 'fps', 'seconds', 'interrupted', 'duration', 'decode', 'too long')):
            suffix = 'TIMING'
        elif 'prompt' in text.lower() or 'pose' in text.lower() or 'looking straight' in text.lower():
            suffix = 'POSE'
        elif 'blurred' in text.lower() or 'clear face frames' in text.lower():
            suffix = 'BLURRED'
        else:
            suffix = 'INVALID'
    return {'code': f'{prefix}_{suffix}', 'retryFrom': stage}
