import { useEffect, useRef, useState } from 'react'
import { fileToBase64 } from '../../lib/files'

const labels: Record<string,string> = {LOOK_FORWARD:'Look straight at the camera',TURN_LEFT:'Turn your head slowly to your left and hold',TURN_RIGHT:'Turn your head slowly to your right and hold'}
export type RecordingCapture = {videoBase64:string;mimeType:string;preview:string|null}
export function LivenessCapture({hint,onCapture,preview:photoPreview}:{hint:string;onCapture:(capture:RecordingCapture|null)=>void;preview?:string|null}){
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),recorder=useRef<MediaRecorder|null>(null),timer=useRef<ReturnType<typeof setInterval>|null>(null)
 const generation=useRef(0)
 const mounted=useRef(true),cancelled=useRef(false),startingRef=useRef(false)
 const [recording,setRecording]=useState(false),[starting,setStarting]=useState(false),[seconds,setSeconds]=useState(0),[done,setDone]=useState(false),[error,setError]=useState<string|null>(null)
 const instructions=hint.split(',').map(v=>v.trim())
 const valid=instructions.length===3&&instructions[0]==='LOOK_FORWARD'&&new Set(instructions).size===3&&instructions.every(v=>v in labels)
 function stopTracks(){stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(timer.current)clearInterval(timer.current);timer.current=null}
 function cancel(){generation.current++;cancelled.current=true;if(recorder.current?.state==='recording')recorder.current.stop();stopTracks();if(mounted.current){setRecording(false);setDone(false);onCapture(null)}}
 useEffect(()=>{mounted.current=true;const hidden=()=>{if(document.visibilityState==='hidden')cancel()};document.addEventListener('visibilitychange',hidden);return()=>{mounted.current=false;cancel();document.removeEventListener('visibilitychange',hidden)}},[])
 async function start(){
  if(startingRef.current||recording||recorder.current?.state==='recording')return;startingRef.current=true;setStarting(true);setError(null);setDone(false);setSeconds(0);onCapture(null);cancelled.current=false
  const attempt=++generation.current
  try{
   if(!valid)throw new Error('This recording challenge is invalid. Request a new verification link.')
   if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw new Error('Video recording needs HTTPS or localhost and a browser with camera recording support.')
   const mime=['video/webm;codecs=vp8','video/webm;codecs=vp9','video/mp4'].find(value=>MediaRecorder.isTypeSupported(value));if(!mime)throw new Error('This browser cannot record supported MP4 or WebM video. Try another supported browser.')
   const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640,max:1280},height:{ideal:480,max:720},frameRate:{ideal:20,max:30}},audio:false})
   if(!mounted.current||attempt!==generation.current){media.getTracks().forEach(track=>track.stop());return}
   stream.current=media;if(!video.current)throw new Error('Camera preview is unavailable.');video.current.srcObject=media;await video.current.play();if(!mounted.current||attempt!==generation.current){media.getTracks().forEach(track=>track.stop());return}
   const capture=new MediaRecorder(media,{mimeType:mime,videoBitsPerSecond:800000});recorder.current=capture
   const chunks:BlobPart[]=[];let bytes=0,preview:string|null=null,started=0
   capture.ondataavailable=event=>{if(attempt!==generation.current)return;if(event.data.size){bytes+=event.data.size;if(bytes>8000000){cancel();if(mounted.current)setError('Recording exceeded 8 MB. Please try again.');return}chunks.push(event.data)}}
   capture.onerror=()=>{if(attempt!==generation.current)return;cancel();if(mounted.current)setError('Camera recording failed. Please try again.')}
   capture.onstop=async()=>{if(attempt!==generation.current)return;stopTracks();if(!mounted.current||cancelled.current)return;setRecording(false);setStarting(true)
    try{if(performance.now()-started<8800)throw new Error('The recording was interrupted. Complete all three prompts.')
     const blob=new Blob(chunks,{type:mime.split(';')[0]});if(!blob.size||blob.size>8000000)throw new Error('Recording is empty or too large.')
     const videoBase64=await fileToBase64(new File([blob],'challenge', {type:blob.type}));if(mounted.current&&!cancelled.current&&attempt===generation.current){onCapture({videoBase64,mimeType:blob.type,preview});setDone(true)}
    }catch(err){if(mounted.current)setError(err instanceof Error?err.message:'Could not save recording.')}finally{if(mounted.current)setStarting(false)}}
   capture.onstart=()=>{if(attempt!==generation.current){if(capture.state==='recording')capture.stop();return}started=performance.now();setRecording(true);timer.current=setInterval(()=>{const elapsed=performance.now()-started;setSeconds(Math.min(9,Math.floor(elapsed/1000)))
    if(!preview&&elapsed>=1000&&video.current?.videoWidth){const canvas=document.createElement('canvas');canvas.width=320;canvas.height=Math.round(320*video.current.videoHeight/video.current.videoWidth);canvas.getContext('2d')?.drawImage(video.current,0,0,canvas.width,canvas.height);preview=canvas.toDataURL('image/jpeg',.8)}
    if(elapsed>=9000){if(timer.current)clearInterval(timer.current);timer.current=null;if(capture.state==='recording')capture.stop()}
   },100)}
   capture.start(250)
  }catch(err){if(attempt!==generation.current)return;cancel();if(mounted.current)setError(err instanceof Error?err.message:'Could not open camera.')}
  finally{startingRef.current=false;if(mounted.current)setStarting(false)}
 }
 return <div className="space-y-5">
 <div className="relative overflow-hidden rounded-3xl bg-surface-raised">
   <video ref={video} playsInline muted className={recording?'aspect-[4/3] max-h-80 w-full bg-black object-cover':'hidden'}/>
   {!recording&&(photoPreview?<img src={photoPreview} alt="Your captured video preview" className="aspect-[4/3] max-h-80 w-full object-cover"/>:<div className="flex aspect-[4/3] max-h-80 flex-col items-center justify-center gap-4 text-content-subtle">
     <svg width="94" height="112" viewBox="0 0 94 112" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><ellipse cx="47" cy="43" rx="26" ry="34"/><path d="M9 108c0-23 17-34 38-34s38 11 38 34M2 19V9a7 7 0 0 1 7-7h12M73 2h12a7 7 0 0 1 7 7v10M2 93v10a7 7 0 0 0 7 7h12M73 110h12a7 7 0 0 0 7-7V93"/></svg>
     <span className="text-sm">Keep your face in the frame</span>
   </div>)}
 </div>
 <ol aria-label="Recording prompts" className="grid grid-cols-3 gap-2">
   {instructions.map((instruction,index)=><li key={instruction} className={`rounded-xl px-2 py-3 text-center text-xs leading-5 ${recording&&Math.min(2,Math.floor(seconds/3))===index?'bg-accent font-semibold text-accent-on':'bg-surface-raised text-content-muted'}`}>
     <span className="mb-1 block font-semibold">{index+1}</span>{instruction==='LOOK_FORWARD'?'Look ahead':instruction==='TURN_LEFT'?'Turn left':'Turn right'}
   </li>)}
 </ol>
 {recording&&<div aria-live="polite" className="space-y-2"><p className="text-base font-semibold">{labels[instructions[Math.min(2,Math.floor(seconds/3))]]}</p><p className="text-sm text-content-muted">{9-seconds} seconds remaining</p></div>}
 {recording?<button type="button" onClick={cancel} className="min-h-[52px] w-full rounded-full border border-line-strong bg-surface px-5 py-3 text-sm font-semibold text-content">Cancel recording</button>:<button type="button" disabled={starting} onClick={()=>void start()} className="min-h-[52px] w-full rounded-full border border-line-strong bg-surface px-5 py-3 text-sm font-semibold text-content disabled:opacity-50">{starting?'Preparing recording…':done?'Record again':'Start camera recording'}</button>}
 {done?<p role="status" className="text-sm text-content-muted">Continuous recording captured. Continue to review.</p>:!recording&&<p className="text-center text-xs leading-5 text-content-subtle">One nine-second video. No audio is recorded.</p>}
 {error&&<p role="alert" className="rounded-xl border border-risk-block/30 p-3 text-sm text-risk-block">{error}</p>}</div>
}
