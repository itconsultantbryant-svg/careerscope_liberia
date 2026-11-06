import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import DashboardLayout from '../components/DashboardLayout';
import CalendarView from '../components/CalendarView';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import { DAYS, localDate, nextOccurrence } from '../../../shared/scheduling';

const initial=()=>({appointmentDate:localDate(),appointmentTime:'15:00',durationMinutes:60,dayOfWeek:'Monday',startTime:'15:00',endTime:'16:00',validFrom:localDate(),validUntil:localDate(new Date(Date.now()+90*86400000)),timezone:'Africa/Monrovia',notes:'',studentId:'',counselorId:''});
export default function ScheduleCenter() {
  const {user}=useAuth(),{socket}=useSocket(),location=useLocation();
  const [search]=useSearchParams();
  const [data,setData]=useState({appointments:[],schedules:[],students:[],counselors:[],rooms:[]});
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[form,setForm]=useState(initial),[kind,setKind]=useState('appointment'),[editing,setEditing]=useState(null),[showForm,setShowForm]=useState(search.has('counselorId')),[now,setNow]=useState(Date.now());
  const calendar=location.pathname.endsWith('/calendar');
  const load=useCallback(async()=>{try{setData((await api.get('/planner/overview')).data);setError('');}catch(e){setError(e.response?.data?.error||'Unable to load plans');}},[]);
  useEffect(()=>{load();const timer=setInterval(()=>{setNow(Date.now());if(!document.hidden)load();},10000);socket?.on('planning_changed',load);socket?.on('room_changed',load);return()=>{clearInterval(timer);socket?.off('planning_changed',load);socket?.off('room_changed',load);};},[load,socket]);
  useEffect(()=>{if(search.get('counselorId'))setForm(f=>({...f,counselorId:search.get('counselorId')}));},[search]);
  const action=async(fn)=>{setBusy(true);try{await fn();await load();}catch(e){toast.error(e.response?.data?.error||e.message);}finally{setBusy(false);}};
  const submit=(event)=>{event.preventDefault();action(async()=>{
    const path=kind==='appointment'?'/appointments':`/schedules/${user.role==='student'?'student/propose':'counselor/create'}`;
    if(editing)await api.patch(`/${kind==='appointment'?'appointments':'schedules'}/${editing.id}`,{...form,revision:editing.revision});else await api.post(path,form);
    setShowForm(false);setEditing(null);setForm(initial());toast.success('Proposal saved. The other participant must accept it.');
  });};
  const change=(e)=>setForm({...form,[e.target.name]:e.target.value});
  const edit=(record,type)=>{setKind(type);setEditing(record);setForm({...initial(),appointmentDate:String(record.appointment_date||'').slice(0,10),appointmentTime:record.appointment_time?.slice(0,5)||'15:00',durationMinutes:record.starts_at?Math.round((new Date(record.ends_at)-new Date(record.starts_at))/60000):60,dayOfWeek:record.day_of_week||'Monday',startTime:record.start_time?.slice(0,5)||'15:00',endTime:record.end_time?.slice(0,5)||'16:00',validFrom:record.valid_from||localDate(),validUntil:record.valid_until||localDate(),timezone:record.timezone,notes:record.notes||'',studentId:record.student_id,counselorId:record.counselor_id});setShowForm(true);};
  const respond=(record,type,status)=>action(()=>api.patch(`/${type==='appointment'?'appointments':'schedules'}/${record.id}/${type==='schedule'&&['accepted','rejected'].includes(status)?status==='accepted'?'accept':'reject':'status'}`,{status,revision:record.revision}));
  const prepare=(record,type,callType='video')=>action(async()=>{const occurrence=type==='schedule'?nextOccurrence(record):null;const result=await api.post('/classrooms',{type,planId:record.id,date:occurrence?.date,callType});window.location.assign(`/classroom/${result.data.room.id}`);});
  const renderPlan=(record,type)=>{
    const proposer=type==='appointment'?record.created_by_id:record.created_by==='student'?record.student_id:record.counselor_id;
    const confirmed=['accepted','active'].includes(record.status);
    const occurrence=type==='schedule'?nextOccurrence(record,new Date(now)):null;
    const start=type==='appointment'?new Date(record.starts_at):occurrence?.start,end=type==='appointment'?new Date(record.ends_at):occurrence?.end;
    const room=data.rooms.find(r=>type==='appointment'?r.appointment_id===record.id:r.schedule_id===record.id&&String(r.occurrence_date).slice(0,10)===occurrence?.date);
    return <article id={`${type}-${record.id}`} key={`${type}-${record.id}`} className={`card scroll-mt-20 ${search.get('focus')===`${type}-${record.id}`?'ring-2 ring-primary-500':''}`}>
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{record.student_name} ↔ {record.counselor_name}</h3><span className="capitalize">{record.status} · revision {record.revision}</span></div>
      <p className="mt-2">{type==='appointment'?`${new Date(record.starts_at).toLocaleString()} – ${new Date(record.ends_at).toLocaleTimeString()}`:`${record.day_of_week}, ${record.start_time}–${record.end_time} · ${record.valid_from} to ${record.valid_until}`}</p>
      <p className="text-sm text-gray-500">Plan timezone: {record.timezone}. Calendar uses your device timezone.</p>
      {occurrence&&<p className="text-sm">Next class: {occurrence.start.toLocaleString()}</p>}
      {record.notes&&<p className="whitespace-pre-wrap my-3">{record.notes}</p>}
      <div className="flex flex-wrap gap-3 mt-4">
        {user.role!=='admin'&&record.status==='pending'&&proposer!==user.id&&<><button disabled={busy} className="btn-primary" onClick={()=>respond(record,type,'accepted')}>Accept proposal</button><button disabled={busy} className="btn-secondary" onClick={()=>respond(record,type,'rejected')}>Decline</button></>}
        {user.role!=='admin'&&['pending','accepted','active'].includes(record.status)&&<button disabled={busy} className="btn-secondary" onClick={()=>edit(record,type)}>Revise plan</button>}
        {['pending','accepted','active'].includes(record.status)&&<button disabled={busy} className="btn-secondary" onClick={()=>respond(record,type,'cancelled')}>Cancel plan</button>}
        {confirmed&&user.role==='counselor'&&end&&end.getTime()>now&&(!room||room.status==='ended'&&!room.started_at)&&<><button disabled={busy} className="btn-secondary" onClick={()=>prepare(record,type,'video')}>Prepare video class</button><button disabled={busy} className="btn-secondary" onClick={()=>prepare(record,type,'voice')}>Prepare voice class</button></>}
        {room&&room.is_invited&&room.status!=='ended'&&<Link className={start&&start.getTime()<=now?'btn-primary':'btn-secondary'} to={`/classroom/${room.id}`}>{room.status==='active'?'Join live class':start&&start.getTime()<=now&&user.role==='counselor'?'Start voice / video class':'Classroom & invitation link'}</Link>}
        {confirmed&&user.role==='student'&&!room&&<p className="text-sm text-gray-600">Your counselor will prepare and start the classroom when due.</p>}
      </div>
    </article>;
  };
  return <DashboardLayout><h1 className="text-3xl font-bold mb-2">Counseling plans & calendar</h1><p className="text-gray-600 mb-5">Agree on appointments and quarterly availability at your own pace. Revisions require a fresh acceptance.</p>
    {error&&<p role="alert" className="card text-red-700">{error} <button onClick={load}>Retry</button></p>}
    <div className="flex flex-wrap gap-3 mb-5"><Link className="btn-secondary" to={`/${user.role}/appointments`}>Plans</Link><Link className="btn-secondary" to={`/${user.role}/calendar`}>Calendar</Link>{user.role!=='admin'&&<button className="btn-primary" onClick={()=>{setEditing(null);setForm(initial());setShowForm(!showForm);}}>Propose a plan</button>}</div>
    {showForm&&user.role!=='admin'&&<form onSubmit={submit} className="card mb-6 space-y-4"><h2 className="text-xl font-semibold">{editing?'Revise':'Propose'} counseling plan</h2><div className="grid sm:grid-cols-2 gap-4">
      <label>Plan type<select disabled={!!editing} value={kind} onChange={e=>setKind(e.target.value)} className="input-field"><option value="appointment">One appointment</option><option value="schedule">Quarterly weekly schedule</option></select></label>
      <label>{user.role==='student'?'Counselor':'Assigned student'}<select required disabled={!!editing} className="input-field" name={user.role==='student'?'counselorId':'studentId'} value={user.role==='student'?form.counselorId:form.studentId} onChange={change}><option value="">Choose…</option>{(user.role==='student'?data.counselors.filter(c=>kind==='appointment'||c.is_assigned):data.students).map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></label>
      {kind==='appointment'?<><label>Date<input required type="date" name="appointmentDate" value={form.appointmentDate} onChange={change} className="input-field"/></label><label>Time<input required type="time" name="appointmentTime" value={form.appointmentTime} onChange={change} className="input-field"/></label><label>Duration (minutes)<input required type="number" min="15" max="180" name="durationMinutes" value={form.durationMinutes} onChange={change} className="input-field"/></label></>:<><label>Day<select name="dayOfWeek" value={form.dayOfWeek} onChange={change} className="input-field">{DAYS.map(d=><option key={d}>{d}</option>)}</select></label>{[['startTime','Start time','time'],['endTime','End time','time'],['validFrom','Quarter begins','date'],['validUntil','Quarter ends (maximum 93 days)','date']].map(([name,label,type])=><label key={name}>{label}<input required type={type} name={name} value={form[name]} onChange={change} className="input-field"/></label>)}</>}
      <label>IANA timezone<input required name="timezone" value={form.timezone} onChange={change} className="input-field" placeholder="Africa/Monrovia"/></label>
    </div><label className="block">Availability / notes<textarea name="notes" maxLength={3000} value={form.notes} onChange={change} className="input-field"/></label><div className="flex gap-3"><button disabled={busy} className="btn-primary">Send for acceptance</button><button type="button" className="btn-secondary" onClick={()=>setShowForm(false)}>Close</button></div></form>}
    {calendar&&<div className="card mb-6"><CalendarView appointments={data.appointments} schedules={data.schedules} role={user.role} onSelectEvent={event=>document.getElementById(`${event.resource.type}-${event.resource.data.id}`)?.scrollIntoView({behavior:'smooth'})}/></div>}
    <section className="space-y-4 mb-8"><h2 className="text-xl font-semibold">Appointments</h2>{data.appointments.map(r=>renderPlan(r,'appointment'))}{!data.appointments.length&&<p>No appointments yet.</p>}</section>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Quarterly schedules</h2>{data.schedules.map(r=>renderPlan(r,'schedule'))}{!data.schedules.length&&<p>No quarterly plans yet. An administrator can assign a counselor to begin planning.</p>}</section>
  </DashboardLayout>;
}
