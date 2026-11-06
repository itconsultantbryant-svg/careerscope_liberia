// Optional real-browser check: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs
// node --env-file=.env.neon-test.local tests/browser-smoke.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { pathToFileURL } from 'node:url';
const preview=dotenv.parse(await readFile(new URL('../.env.neon-test.local',import.meta.url)));
assert.equal(process.env.DATABASE_URL,preview.DATABASE_URL,'Browser tests must use preview');
process.env.NODE_ENV='test';process.env.CLIENT_URL='http://localhost:5173';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const {createServer}=await import('../../client/node_modules/vite/dist/node/index.js');
const {default:app}=await import('../app.js');
const {query,pool}=await import('../db/postgres.js');
// Tailwind resolves its configuration relative to the application working directory.
process.chdir(new URL('../../client',import.meta.url).pathname);
const api=app.listen(5000);await new Promise(resolve=>api.once('listening',resolve));
const vite=await createServer({root:new URL('../../client',import.meta.url).pathname,server:{port:5173,strictPort:true}});await vite.listen();
const users={},cookies={},suffix=randomUUID().slice(0,8);let browser,checks=0;
try{
  for(const role of ['counselor','student','admin']){users[role]=(await query('INSERT INTO users(first_name,last_name,phone,password,role,is_approved) VALUES($1,$2,$3,\'!\',$4,1) RETURNING id',[`Browser ${role}`,suffix,`browser-${role}-${suffix}`,role])).rows[0].id;cookies[role]=jwt.sign({id:users[role],role,tokenVersion:0},process.env.JWT_SECRET);}
  const appointment=(await query("INSERT INTO appointments(student_id,counselor_id,appointment_date,appointment_time,status,created_by_id,starts_at,ends_at) VALUES($1,$2,$3,$4,'accepted',$2,$5,$6) RETURNING id",[users.student,users.counselor,new Date().toISOString().slice(0,10),new Date().toISOString().slice(11,16),new Date(Date.now()-30000),new Date(Date.now()+3600000)])).rows[0];
  const request=async(path,role,body)=>{const response=await fetch(`http://localhost:5000/api${path}`,{method:'POST',headers:{Cookie:`token=${cookies[role]}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data;};
  const {room}=await request('/classrooms','counselor',{type:'appointment',planId:appointment.id});
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
  const contexts={},pages={},errors=[];
  for(const role of ['counselor','student','admin']){contexts[role]=await browser.newContext({permissions:['camera','microphone'],viewport:role==='student'?{width:390,height:844}:{width:1440,height:1000}});await contexts[role].addCookies([{name:'token',value:cookies[role],url:'http://localhost:5173',httpOnly:true,sameSite:'Lax'}]);pages[role]=await contexts[role].newPage();pages[role].on('pageerror',e=>errors.push(e.message));}
  await pages.counselor.goto(`http://localhost:5173/classroom/${room.id}`);
  await pages.counselor.getByRole('button',{name:'Start class when due'}).click({timeout:60000});
  await pages.counselor.getByRole('button',{name:'Join voice / video'}).click({timeout:60000});
  await pages.counselor.getByRole('button',{name:'Leave & save notes'}).waitFor({timeout:60000});checks++;
  await pages.student.goto(`http://localhost:5173/classroom/${room.id}`);
  await pages.student.getByRole('button',{name:'Join voice / video'}).click({timeout:60000});
  await pages.student.getByRole('button',{name:'Leave & save notes'}).waitFor({timeout:60000});checks++;
  for(const role of ['counselor','student']){await pages[role].waitForFunction(()=>document.querySelectorAll('video').length===2&&[...document.querySelectorAll('video')].every(v=>v.readyState>=2),{},{timeout:90000});checks++;}
  await pages.student.getByRole('button',{name:'Mute microphone',exact:true}).click();await pages.student.getByRole('button',{name:'Unmute',exact:true}).waitFor();checks++;
  await pages.student.getByRole('button',{name:'Raise hand',exact:true}).click();await pages.student.getByRole('button',{name:'Lower hand',exact:true}).waitFor();checks++;
  await pages.student.getByRole('textbox',{name:'Private class notes'}).fill('Browser-verified private note');
  await pages.student.getByRole('button',{name:'Save to my archive'}).click();await pages.student.getByText('Saved privately to your archive',{exact:true}).waitFor({timeout:60000});checks++;
  await pages.student.getByRole('button',{name:'Leave & save notes'}).click();await pages.student.getByRole('button',{name:'Rejoin class',exact:true}).waitFor({timeout:60000});
  await pages.student.getByRole('button',{name:'Rejoin class',exact:true}).click();await pages.student.getByRole('button',{name:'Leave & save notes'}).waitFor({timeout:60000});checks++;
  pages.counselor.once('dialog',dialog=>dialog.accept());await pages.counselor.getByRole('button',{name:'End class for everyone'}).click();await pages.student.getByRole('button',{name:'Leave & save notes'}).waitFor({state:'hidden',timeout:60000});checks++;
  await pages.student.goto('http://localhost:5173/student/archive');await pages.student.getByRole('heading',{name:/My private documents/}).waitFor({timeout:60000});await pages.student.getByRole('button',{name:'View',exact:true}).first().click();await pages.student.getByText('Browser-verified private note',{exact:true}).waitFor({timeout:60000});checks++;
  await pages.student.getByRole('button',{name:'Toggle sidebar'}).click();const nav=pages.student.getByRole('navigation',{name:'student dashboard navigation'});await nav.getByRole('link',{name:'AI Counselors',exact:true}).click();await pages.student.getByRole('heading',{name:'AI counselor directory'}).waitFor({timeout:60000});checks++;
  await pages.admin.goto('http://localhost:5173/admin/users');await pages.admin.getByRole('heading',{name:'People, careers & assignments'}).waitFor({timeout:60000});checks++;
  for(const role of ['student','counselor','admin']){await pages[role].goto(`http://localhost:5173/${role}/dashboard`);await pages[role].getByRole('navigation',{name:`${role} dashboard navigation`}).waitFor({state:'attached',timeout:60000});assert.equal(await pages[role].locator('footer').count(),0);assert.ok(await pages[role].evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));checks+=2;}
  assert.deepEqual(errors,[]);checks++;
  console.log(`Real Chrome browser checks passed: ${checks}. Two-party WebRTC media, mute, hands, private notes, leave/rejoin/end, mobile sidebar, role pages and footer-free dashboards verified with fake camera/microphone devices.`);
}finally{
  await browser?.close();await vite.close();await new Promise(resolve=>api.close(resolve));
  if(Object.keys(users).length)await query('UPDATE users SET is_disabled=1 WHERE id=ANY($1::integer[])',[Object.values(users)]);
  await pool.end();
}
