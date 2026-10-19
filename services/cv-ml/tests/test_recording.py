import base64
import hashlib
from io import BytesIO
import numpy as np
from PIL import Image
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.routes import create_router
from app.api.limits import BodyLimit
from app.storage.challenges import ChallengeStore
from app.services import recording, faces


def document():
    output=BytesIO();Image.fromarray(np.random.default_rng(4).integers(0,255,(160,160,3),dtype=np.uint8)).save(output,format="PNG")
    return base64.b64encode(output.getvalue()).decode()


def test_video_decoder_reads_bounded_continuous_mp4_and_rejects_short_capture(tmp_path):
    import cv2
    for count in [90,20]:
        path=tmp_path/f"recording-{count}.mp4"
        writer=cv2.VideoWriter(str(path),cv2.VideoWriter_fourcc(*'mp4v'),10.,(160,128))
        assert writer.isOpened()
        for index in range(count):
            frame=np.random.default_rng(index).integers(0,255,(128,160,3),dtype=np.uint8)
            writer.write(frame)
        writer.release()
        raw=path.read_bytes()
        if count==90:
            samples,duration=recording.decode_samples(raw,'.mp4')
            assert duration==9 and 25<=len(samples)<=46
        else:
            with pytest.raises(ValueError,match='nine seconds'):recording.decode_samples(raw,'.mp4')
    assert not list(tmp_path.glob('sentinel-capture-*'))


def test_track_checks_issued_order_and_rejects_discontinuous_face(monkeypatch):
    samples=[(index/4,np.full((128,160,3),index//12,dtype=np.uint8)) for index in range(36)]
    monkeypatch.setattr(recording,'decode_samples',lambda *_:(samples,9.))
    def locate(image,minimum=64):
        phase=int(image[0,0,0]);return {'crop':image,'box':(.2,.2,.4,.5),'yaw':[0.,.3,-.3][phase]}
    monkeypatch.setattr(recording,'locate_face',locate)
    result=recording.analyze_recording(b'video','.mp4',['LOOK_FORWARD','TURN_LEFT','TURN_RIGHT'])
    assert result['sampledFrames']==36 and len(result['challengeCrops'])==3
    with pytest.raises(ValueError,match='prompt order'):
        recording.analyze_recording(b'video','.mp4',['LOOK_FORWARD','TURN_RIGHT','TURN_LEFT'])
    monkeypatch.setattr(recording,'locate_face',lambda image,minimum=64:{**locate(image), 'box':(.8,.8,.1,.1) if image[0,0,0] else (.1,.1,.3,.3)})
    with pytest.raises(ValueError,match='abruptly'):
        recording.analyze_recording(b'video','.mp4',['LOOK_FORWARD','TURN_LEFT','TURN_RIGHT'])


def test_missing_or_multiple_faces_are_not_silently_skipped(monkeypatch):
    monkeypatch.setattr(recording,'decode_samples',lambda *_:([(0,np.zeros((128,160,3),dtype=np.uint8))],9.))
    def missing(*args,**kwargs):raise ValueError('Exactly one visible face is required')
    monkeypatch.setattr(recording,'locate_face',missing)
    with pytest.raises(ValueError,match='exactly one face'):
        recording.analyze_recording(b'video','.mp4',['LOOK_FORWARD','TURN_LEFT','TURN_RIGHT'])


def test_recording_encoding_and_container_are_strict():
    for encoded in ['not-base64','data:text/plain;base64,YWJj',base64.b64encode(b'not-a-video').decode()]:
        with pytest.raises(ValueError):recording.recording_bytes(encoded)
    with pytest.raises(ValueError,match='8 MB'):recording.recording_bytes('A'*10_666_769)


class MeasuredFixtureModels:
    # Deliberate inference fixture for API binding tests; not real accuracy evidence.
    ready=True
    def __init__(self):self.calls=0
    def recording_kyc(self,*args):
        self.calls+=1
        return {'faceMatchScore':.99,'livenessScore':.99,'tamperingScore':.01,'modelRan':True,'spoofLikely':False,'extractedFields':{'idNumber':'TEST123','dob':'1990-01-01'},'signals':[]}


def test_recording_challenge_binds_document_video_and_cached_result(tmp_path,monkeypatch):
    store=ChallengeStore(str(tmp_path/'challenges.db'));models=MeasuredFixtureModels();app=FastAPI();app.include_router(create_router(store,models));client=TestClient(app)
    monkeypatch.setattr(faces,'locate_face',lambda *_: {})
    def analyzed(raw,*args):return {'recordingSha256':hashlib.sha256(raw).hexdigest(),'sampledFrames':36,'durationSeconds':9.,'faceCrops':[],'challengeCrops':[]}
    monkeypatch.setattr(recording,'analyze_recording',analyzed)
    challenge=store.create()['challengeId'];video=base64.b64encode(b'\x00\x00\x00\x18ftypisom'+b'fixture').decode()
    body={'idImage':document(),'videoBase64':video,'challengeId':challenge}
    first=client.post('/cv/kyc-verify-recording',json=body);assert first.status_code==200
    assert first.json()['pipeline']=='recording-face-v2'
    assert client.post('/cv/kyc-verify-recording',json=body).json()==first.json()
    assert models.calls==1
    changed={**body,'videoBase64':base64.b64encode(b'\x00\x00\x00\x18ftypisomchanged').decode()}
    assert client.post('/cv/kyc-verify-recording',json=changed).status_code==409
    image=np.zeros((160,160,3),dtype=np.uint8);image[::2]=255;output=BytesIO();Image.fromarray(image).save(output,format='PNG')
    assert client.post('/cv/kyc-verify-recording',json={**body,'idImage':base64.b64encode(output.getvalue()).decode()}).status_code==409


def test_request_limit_rejects_before_json_parse():
    app=FastAPI();app.add_middleware(BodyLimit,maximum=1024);client=TestClient(app)
    assert client.post('/cv/kyc-verify-recording',content=b'x'*1025).status_code==413


def test_old_preprocessing_artifacts_cannot_load(tmp_path):
    import json
    from app.services.identity import IdentityModels
    folder=tmp_path/'face';folder.mkdir();(folder/'evaluation.json').write_text(json.dumps({'schemaVersion':1,'task':'face'}))
    assert not IdentityModels(tmp_path).ready


def test_all_tracked_faces_must_match_and_tamper_keeps_full_document(monkeypatch):
    import torch
    from app.models.network import ALPHABET
    from app.services.identity import IdentityModels
    models=IdentityModels()
    portrait=np.full((80,80,3),60,dtype=np.uint8)
    monkeypatch.setattr(faces,'face_image',lambda *args,**kwargs:Image.fromarray(portrait))
    observed={}
    def comparison(pairs):
        observed['pairs']=pairs
        return torch.tensor([5.,-5.])
    def tampering(image):observed['document']=image;return torch.tensor([-5.])
    text='ID=TEST123\nDOB=1990-01-01'
    indices=[]
    for letter in text:indices.extend([ALPHABET.index(letter)+1,0])
    logits=torch.full((len(indices),1,len(ALPHABET)+1),-10.)
    for row,index in enumerate(indices):logits[row,0,index]=10.
    models.models={'face':comparison,'liveness':lambda *args:torch.tensor([5.]),'tampering':tampering,'ocr':lambda *args:logits}
    models.metadata={task:{'threshold':.5,'weightsSha256':'a'*64} for task in models.models}
    crop=faces.encode_image(portrait)
    result=models.recording_kyc(document(),{'faceCrops':[crop,crop],'challengeCrops':[crop]*3},['LOOK_FORWARD','TURN_LEFT','TURN_RIGHT'])
    assert result['faceMatchScore']==0 and 'RECORDING_FACE_MISMATCH' in result['signals']
    assert result['comparedFrames']==2 and result['extractedFields']['idNumber']=='TEST123'
    assert observed['pairs'].shape==(2,2,3,96,96)
    assert observed['document'].mean()>observed['pairs'][:,0].mean()


def test_browser_nominal_fps_uses_presentation_timestamps(tmp_path, monkeypatch):
    import cv2
    path = tmp_path / 'browser-timing.mp4'
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*'mp4v'), 20., (160, 128))
    assert writer.isOpened()
    for index in range(180):
        writer.write(np.random.default_rng(index).integers(0, 255, (128, 160, 3), dtype=np.uint8))
    writer.release()
    original = cv2.VideoCapture
    class BrowserMetadata:
        def __init__(self, *args): self.capture = original(*args)
        def get(self, key): return 1000. if key == cv2.CAP_PROP_FPS else self.capture.get(key)
        def __getattr__(self, key): return getattr(self.capture, key)
    monkeypatch.setattr(cv2, 'VideoCapture', BrowserMetadata)
    samples, duration = recording.decode_samples(path.read_bytes(), '.mp4')
    assert abs(duration - 9.) < .01 and len(samples) >= 25


def test_bundled_detector_loads_and_rejects_non_face_pixels():
    assert faces.detector() is not None
    with pytest.raises(ValueError, match='Exactly one'):
        faces.locate_face(np.zeros((320, 320, 3), dtype=np.uint8))
