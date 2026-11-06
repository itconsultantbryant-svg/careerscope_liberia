import { useCallback,useEffect,useRef,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { toast } from 'sonner';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';

const videoSender=pc=>pc.getTransceivers().find(t=>t.receiver.track.kind==='video')?.sender;

function MediaTile({stream,muted=false,name,volume,output}){
  const media=useRef(null);
  useEffect(()=>{if(media.current){media.current.srcObject=stream;media.current.play().catch(()=>{});}},[stream]);
  useEffect(()=>{if(media.current)media.current.volume=volume;},[volume]);
  useEffect(()=>{if(output&&media.current?.setSinkId)media.current.setSinkId(output).catch(()=>toast.error('Audio output selection is unavailable'));},[output]);
  return <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video"><video ref={media} autoPlay playsInline muted={muted} className="w-full h-full object-contain"/><span className="absolute bottom-2 left-2 bg-black/70 text-white rounded px-2 py-1 text-sm">{name}</span></div>;
}
export default function Classroom(){
  const {id}=useParams(),{user}=useAuth(),{socket}=useSocket();
  const [data,setData]=useState(null),[error,setError]=useState(''),[joined,setJoined]=useState(false),[busy,setBusy]=useState(false),[local,setLocal]=useState(null),[remote,setRemote]=useState({}),[muted,setMuted]=useState(false),[camera,setCamera]=useState(true),[hand,setHand]=useState(false),[sharing,setSharing]=useState(false),[volume,setVolume]=useState(1),[quality,setQuality]=useState('720'),[noise,setNoise]=useState(true),[outputs,setOutputs]=useState([]),[output,setOutput]=useState(''),[invite,setInvite]=useState(''),[notes,setNotes]=useState(''),[noteStatus,setNoteStatus]=useState(''),[captions,setCaptions]=useState(false),[transcript,setTranscript]=useState(''),[reaction,setReaction]=useState('');
  const peers=useRef(new Map()),stream=useRef(null),screen=useRef(null),recognition=useRef(null),joinedRef=useRef(false),dataRef=useRef(null),presence=useRef({}),noteRef=useRef(''),transcriptRef=useRef('');
  dataRef.current=data;presence.current={micMuted:muted,handRaised:hand,screenSharing:sharing};noteRef.current=notes;transcriptRef.current=transcript;
  const load=useCallback(async()=>{try{const result=(await api.get(`/classrooms/${id}`)).data;setData(result);setError('');return result;}catch(e){setError(e.response?.data?.error||'Classroom unavailable');if([401,403,404].includes(e.response?.status)){joinedRef.current=false;setJoined(false);stream.current?.getTracks().forEach(t=>t.stop());screen.current?.getTracks().forEach(t=>t.stop());recognition.current?.stop();for(const entry of peers.current.values())entry.pc.close();peers.current.clear();setLocal(null);setRemote({});}}},[id]);
  const signal=useCallback((to,kind,payload)=>api.post(`/classrooms/${id}/signal`,{to,kind,data:payload}),[id]);
  const closePeer=useCallback((peerId)=>{const entry=peers.current.get(peerId);entry?.pc.close();peers.current.delete(peerId);setRemote(old=>{const next={...old};delete next[peerId];return next;});},[]);
  const createPeer=useCallback((peerId)=>{
    if(peers.current.has(peerId))return peers.current.get(peerId);
    const pc=new RTCPeerConnection({iceServers:dataRef.current.iceServers});
    const entry={pc,pending:[],offered:false,media:new MediaStream()};peers.current.set(peerId,entry);
    for(const track of stream.current?.getTracks()||[])pc.addTrack(track,stream.current);
    if(!stream.current?.getVideoTracks().length)pc.addTransceiver('video',{direction:'sendrecv'});
    if(screen.current)videoSender(pc)?.replaceTrack(screen.current.getVideoTracks()[0]);
    pc.onicecandidate=e=>{if(e.candidate)signal(peerId,'candidate',e.candidate.toJSON()).catch(()=>{});};
    pc.ontrack=e=>{entry.media.addTrack(e.track);setRemote(old=>({...old,[peerId]:entry.media}));};
    pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'){toast.error('A peer connection failed. Leave and rejoin; restrictive networks may require TURN.');closePeer(peerId);}};
    return entry;
  },[signal,closePeer]);
  const syncPeers=useCallback(async(state)=>{
    if(!joinedRef.current)return;
    const active=state.members.filter(m=>m.user_id!==user.id&&m.is_present);
    for(const peerId of peers.current.keys())if(!active.some(m=>m.user_id===peerId))closePeer(peerId);
    for(const member of active){const entry=createPeer(member.user_id);if(user.id<member.user_id&&!entry.offered){entry.offered=true;try{await entry.pc.setLocalDescription(await entry.pc.createOffer());await signal(member.user_id,'offer',entry.pc.localDescription.toJSON());}catch{entry.offered=false;}}}
  },[user.id,createPeer,signal,closePeer]);
  const stop=useCallback(()=>{
    joinedRef.current=false;setJoined(false);for(const entry of peers.current.values())entry.pc.close();peers.current.clear();
    stream.current?.getTracks().forEach(t=>t.stop());screen.current?.getTracks().forEach(t=>t.stop());stream.current=null;screen.current=null;recognition.current?.stop();setCaptions(false);setSharing(false);setLocal(null);setRemote({});
  },[]);
  const saveNotes=useCallback(async()=>{
    const text=[noteRef.current,transcriptRef.current?`\n\nMy microphone transcript (browser-generated; may contain errors):\n${transcriptRef.current}`:''].join('');
    if(!text.trim())return;
    setNoteStatus('Saving…');try{await api.post('/archive',{title:`Class notes · ${dataRef.current?.room.title||'Counseling'}`,content:text.slice(0,100000),roomId:id});setNoteStatus('Saved privately to your archive');}catch{setNoteStatus('Not saved — retry before leaving');}
  },[id]);
  useEffect(()=>{
    load();let cancelled=false;
    api.get('/archive').then(async r=>{const doc=r.data.documents.find(d=>d.room_id===id&&d.kind==='call_note');if(doc){const result=await api.get(`/archive/${doc.id}`);if(!cancelled)setNotes(result.data.document.content);}}).catch(()=>{});
    const onSignal=async event=>{if(event.roomId!==id||!joinedRef.current)return;try{const entry=createPeer(event.from);if(event.kind==='candidate'){if(entry.pc.remoteDescription)await entry.pc.addIceCandidate(event.data);else entry.pending.push(event.data);}else{await entry.pc.setRemoteDescription(event.data);for(const candidate of entry.pending.splice(0))await entry.pc.addIceCandidate(candidate);if(event.kind==='offer'){await entry.pc.setLocalDescription(await entry.pc.createAnswer());await signal(event.from,'answer',entry.pc.localDescription.toJSON());}}}catch{toast.error('Media negotiation failed. Please leave and rejoin.');}};
    const refresh=event=>{if(event.roomId===id)load().then(state=>state&&syncPeers(state));};
    const ended=event=>{if(event.roomId===id){saveNotes();stop();load();toast.info('The counselor ended the class. Your saved notes are in your archive.');}};
    const left=event=>{if(event.roomId===id)closePeer(event.userId);};
    const react=event=>{if(event.roomId===id){setReaction(event.reaction);setTimeout(()=>setReaction(''),3000);}};
    socket?.on('room_signal',onSignal);socket?.on('room_joined',refresh);socket?.on('room_changed',refresh);socket?.on('room_ended',ended);socket?.on('room_left',left);socket?.on('room_reaction',react);
    const timer=setInterval(async()=>{if(joinedRef.current)await api.post(`/classrooms/${id}/presence`,presence.current).catch(()=>{});const state=await load();if(state){if(joinedRef.current&&(state.room.status==='ended'||new Date(state.room.ends_at)<=new Date())){await saveNotes();stop();}else await syncPeers(state);}},5000);
    return()=>{cancelled=true;clearInterval(timer);socket?.off('room_signal',onSignal);socket?.off('room_joined',refresh);socket?.off('room_changed',refresh);socket?.off('room_ended',ended);socket?.off('room_left',left);socket?.off('room_reaction',react);if(joinedRef.current)api.post(`/classrooms/${id}/leave`).catch(()=>{});stop();};
  },[id,socket,load,createPeer,signal,syncPeers,closePeer,stop,saveNotes]);
  useEffect(()=>{if(!joined)return;const timer=setTimeout(saveNotes,1500);return()=>clearTimeout(timer);},[notes,transcript,joined,saveNotes]);
  const run=async(fn)=>{setBusy(true);try{await fn();await load();}catch(e){toast.error(e.response?.data?.error||e.message);}finally{setBusy(false);}};
  const join=()=>run(async()=>{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera/microphone require HTTPS and a supported browser');
    let media;try{media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:noise,autoGainControl:true},video:data.room.call_type==='video'?{height:{ideal:Number(quality)},width:{ideal:Math.round(Number(quality)*16/9)},frameRate:{ideal:24,max:30}}:false});await api.post(`/classrooms/${id}/join`);}catch(e){media?.getTracks().forEach(t=>t.stop());throw e;}
    stream.current=media;setLocal(media);setCamera(data.room.call_type==='video');setMuted(false);joinedRef.current=true;setJoined(true);
    const devices=await navigator.mediaDevices.enumerateDevices();setOutputs(devices.filter(d=>d.kind==='audiooutput'));
    const state=await load();if(state)await syncPeers(state);
  });
  const leave=()=>run(async()=>{await saveNotes();await api.post(`/classrooms/${id}/leave`);stop();});
  const share=()=>run(async()=>{
    if(sharing){screen.current?.getTracks().forEach(t=>t.stop());return;}
    const capture=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});screen.current=capture;const track=capture.getVideoTracks()[0];
    for(const {pc} of peers.current.values())await videoSender(pc)?.replaceTrack(track);
    setSharing(true);track.onended=async()=>{for(const {pc} of peers.current.values())await videoSender(pc)?.replaceTrack(stream.current?.getVideoTracks()[0]||null);screen.current=null;setSharing(false);};
  });
  const caption=()=>{
    if(captions){recognition.current?.stop();setCaptions(false);return;}
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SpeechRecognition){toast.error('Speech recognition is not supported in this browser');return;}
    if(!window.confirm('Enable browser speech recognition for your microphone? Your browser may send audio to its speech service. Only your own microphone is transcribed; text is saved in your private class notes.'))return;
    const recognizer=new SpeechRecognition();recognizer.continuous=true;recognizer.interimResults=false;recognizer.lang='en-US';
    recognizer.onresult=e=>{let text='';for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)text+=e.results[i][0].transcript+'\n';setTranscript(old=>(old+text).slice(-50000));};
    recognizer.onerror=()=>{setCaptions(false);toast.error('Speech recognition stopped or permission was denied');};recognizer.onend=()=>setCaptions(false);recognition.current=recognizer;recognizer.start();setCaptions(true);
  };
  if(!data)return <DashboardLayout><h1 className="text-2xl font-bold">Secure classroom</h1><p role="status">{error||'Loading invitation…'}</p></DashboardLayout>;
  const host=data.room.host_id===user.id,due=Date.now()>=new Date(data.room.starts_at).getTime()&&Date.now()<new Date(data.room.ends_at).getTime();
  return <DashboardLayout><div className="flex flex-wrap justify-between gap-3 mb-4"><div><h1 className="text-2xl font-bold">{data.room.title}</h1><p>{new Date(data.room.starts_at).toLocaleString()} · {data.room.status} · {data.members.length}/6 invited</p></div><Link className="btn-secondary" to={`/${user.role}/appointments`}>Back to plans</Link></div>
    {error&&<p role="alert" className="text-red-700">{error}</p>}{!data.turnConfigured&&<p className="bg-amber-50 text-amber-900 p-3 rounded mb-4">TURN is not configured. Calls may fail on restrictive networks. Media travels directly between browsers; connection quality depends on each participant’s network.</p>}
    <div className="flex flex-wrap gap-3 mb-5">{host&&data.room.status==='planned'&&<button disabled={busy||!due} className="btn-primary" onClick={()=>run(()=>api.post(`/classrooms/${id}/start`))}>Start class when due</button>}{!joined&&data.room.status==='active'&&due&&<button disabled={busy} className="btn-primary" onClick={join}>{data.members.find(m=>m.user_id===user.id)?.first_joined_at?'Rejoin class':'Join voice / video'}</button>}{joined&&<><button className="btn-secondary" onClick={()=>{const value=!muted;stream.current?.getAudioTracks().forEach(t=>t.enabled=!value);setMuted(value);}}>{muted?'Unmute':'Mute microphone'}</button><button className="btn-secondary" disabled={!stream.current?.getVideoTracks().length} onClick={()=>{stream.current?.getVideoTracks().forEach(t=>t.enabled=!camera);setCamera(!camera);}}>{camera?'Camera off':'Camera on'}</button><button className="btn-secondary" onClick={share}>{sharing?'Stop sharing':'Share screen'}</button><button className="btn-secondary" onClick={()=>setHand(!hand)}>{hand?'Lower hand':'Raise hand'}</button><button className="btn-secondary" onClick={caption}>{captions?'Stop captions':'My microphone captions'}</button><button className="btn-secondary" disabled={busy} onClick={leave}>Leave & save notes</button></>}
      <button className="btn-secondary" onClick={()=>navigator.clipboard.writeText(window.location.href).then(()=>toast.success('Invitation link copied. Only invited accounts can join.')).catch(()=>toast.error('Copy the address from your browser.'))}>Copy secure link</button>{navigator.share&&<button className="btn-secondary" onClick={()=>navigator.share({title:data.room.title,url:window.location.href}).catch(()=>{})}>Share link</button>}{host&&data.room.status!=='ended'&&<button disabled={busy} className="btn-secondary" onClick={()=>{if(window.confirm('End the class for everyone?'))run(async()=>{await saveNotes();await api.post(`/classrooms/${id}/end`);stop();});}}>End class for everyone</button>}</div>
    {!joined&&data.room.status==='planned'&&<p className="card mb-5">The counselor must start this classroom during the confirmed class time. A shared link never grants membership by itself.</p>}
    {reaction&&<div role="status" className="text-5xl text-center my-3">{reaction}</div>}
    {joined&&<><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-4"><MediaTile stream={local} muted name="You" volume={0}/>{Object.entries(remote).map(([peerId,media])=><MediaTile key={peerId} stream={media} name={data.members.find(m=>m.user_id===Number(peerId))?.name||'Participant'} volume={volume} output={output}/>)}</div><div className="flex flex-wrap gap-3 mb-5">{['👍','👏','❤️','🎉','❓'].map(emoji=><button className="btn-secondary" aria-label={`React ${emoji}`} key={emoji} onClick={()=>run(()=>api.post(`/classrooms/${id}/signal`,{kind:'reaction',reaction:emoji}))}>{emoji}</button>)}</div></>}
    <section className="card mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4"><label>Playback volume<input className="block w-full" type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label><label>Video quality<select className="input-field" value={quality} onChange={e=>{setQuality(e.target.value);stream.current?.getVideoTracks()[0]?.applyConstraints({height:{ideal:Number(e.target.value)},width:{ideal:Math.round(Number(e.target.value)*16/9)}}).catch(()=>toast.error('Device cannot apply this resolution'));}}><option value="360">360p · low bandwidth</option><option value="720">720p · standard</option><option value="1080">1080p · high</option></select></label><label className="flex items-center gap-2"><input type="checkbox" checked={noise} onChange={e=>{setNoise(e.target.checked);stream.current?.getAudioTracks()[0]?.applyConstraints({noiseSuppression:e.target.checked,echoCancellation:true}).catch(()=>toast.error('Device cannot adjust noise suppression'));}}/>Noise suppression</label><label>Audio output<select className="input-field" value={output} onChange={e=>setOutput(e.target.value)} disabled={!HTMLMediaElement.prototype.setSinkId}><option value="">System default / speaker</option>{outputs.map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||'Audio device'}</option>)}</select><small>Device selection depends on browser support.</small></label></section>
    <div className="grid lg:grid-cols-2 gap-5"><section className="card"><h2 className="text-xl font-semibold mb-3">Participants</h2><ul className="space-y-2">{data.members.map(m=><li key={m.user_id}>{m.name} · {m.role}{m.hand_raised?' ✋':''}{m.mic_muted?' · muted':''}{m.screen_sharing?' · sharing':''}{m.left_at?' · left':m.last_seen_at&&Date.now()-new Date(m.last_seen_at).getTime()<45000?' · present':' · invited'}</li>)}</ul>{host&&data.room.status!=='ended'&&<form className="mt-4 space-y-2" onSubmit={e=>{e.preventDefault();run(async()=>{await api.post(`/classrooms/${id}/invite`,{userId:Number(invite)});setInvite('');toast.success('Invitation sent');});}}><label>Invite account ID<input required type="number" min="1" className="input-field" value={invite} onChange={e=>setInvite(e.target.value)}/></label><p className="text-xs text-gray-500">Students need an accepted plan covering the same time; counselors/admins must have active accounts. Maximum six members.</p><button disabled={busy} className="btn-secondary">Invite & notify</button></form>}</section>
      <section className="card"><h2 className="text-xl font-semibold mb-3">My private class notes</h2><textarea className="input-field min-h-52" aria-label="Private class notes" maxLength={50000} value={notes} onChange={e=>setNotes(e.target.value)}/><p className="text-sm my-2" role="status">{noteStatus}</p><button disabled={busy||!data.members.find(m=>m.user_id===user.id)?.first_joined_at} className="btn-secondary" onClick={saveNotes}>Save to my archive</button><Link className="ml-3 underline" to={`/${user.role}/archive`}>Open archive</Link>{transcript&&<pre className="font-sans whitespace-pre-wrap mt-4 max-h-48 overflow-auto">{transcript}</pre>}</section>
    </div>
  </DashboardLayout>;
}
