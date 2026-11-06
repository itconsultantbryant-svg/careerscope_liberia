import { useEffect,useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import api from '../utils/api';
export default function AICounselors(){
  const [data,setData]=useState(null),[error,setError]=useState(''),[search,setSearch]=useState('');
  useEffect(()=>{api.get('/ai-counselors').then(r=>setData(r.data)).catch(()=>setError('AI directory could not be loaded.'));},[]);
  return <DashboardLayout><h1 className="text-3xl font-bold mb-3">AI counselor directory</h1><p className="card mb-5">{data?.message||'Clearly labeled AI profiles — not human counselors. Live conversations are inactive.'}</p>{error&&<p role="alert">{error}</p>}<label className="block mb-5">Search careers or specialties<input className="input-field" value={search} onChange={e=>setSearch(e.target.value)}/></label><p className="mb-4">{data?.counselors.length||0} AI profiles configured. Human counselor assignments remain available.</p><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{data?.counselors.filter(c=>`${c.name} ${c.specialty}`.toLowerCase().includes(search.toLowerCase())).map(c=><article className="card" key={c.user_id}><span className="text-xs font-bold text-amber-800">AI · INACTIVE</span><h2 className="font-semibold mt-2">{c.name}</h2><p className="text-sm mt-2">{c.specialty}</p><p className="text-sm text-gray-500 mt-3">Level {c.counselor_level} · Provider activation required</p></article>)}</div></DashboardLayout>;
}
