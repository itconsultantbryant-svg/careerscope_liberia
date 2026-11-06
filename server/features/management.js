import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db,query } from '../db/postgres.js';
import { authenticate,requireRole } from '../middleware/pg-auth.js';
import { fail,notify,numericId,planningChanged } from '../services/notifications.js';

const router=express.Router();
router.use(authenticate,requireRole('admin'));
const safe=(row)=>{ const {password,token_version,...user}=row;return user; };
async function audit(actor,action,target,details={}) { await query('INSERT INTO admin_audit_events(actor_id,action,target_id,details) VALUES($1,$2,$3,$4)',[actor,action,target,JSON.stringify(details)]); }
const text=z.string().trim().max(300).nullable();
const editable=z.object({first_name:z.string().trim().min(1).max(100),last_name:z.string().trim().min(1).max(100),email:z.string().email().nullable(),phone:z.string().min(5).max(50),username:z.string().regex(/^[a-zA-Z0-9_.-]{3,50}$/).nullable(),gender:text,date_of_birth:text,county:text,country:text,city:text,address:text,guardian_name:text,guardian_phone:text,student_number:text,learning_goals:z.string().max(5000).nullable(),school_name:text,grade_level:z.coerce.number().int().min(7).max(12).nullable(),qualification:text,years_of_experience:z.coerce.number().int().min(0).max(80).nullable(),industry_specialty:text,organization:text,bio:z.string().max(5000).nullable(),is_approved:z.coerce.number().int().min(0).max(1),is_disabled:z.coerce.number().int().min(0).max(1),counselor_level:z.coerce.number().int().min(1).max(10)}).partial().strict();
router.get('/users',async(req,res)=>{
  const users=(await query('SELECT * FROM users ORDER BY id')).rows.map(safe);
  const assignments=(await query('SELECT * FROM counselor_assignments WHERE is_active=1 ORDER BY id')).rows;
  const paths=(await query('SELECT * FROM counselor_career_paths ORDER BY id')).rows;
  const careers=(await query('SELECT id,title,category FROM careers ORDER BY category,title')).rows;
  res.json({users,assignments,paths,careers});
});
router.get('/users/:id',async(req,res)=>{
  const user=(await query('SELECT * FROM users WHERE id=$1',[numericId(req.params.id)])).rows[0];
  if(!user) throw fail(404,'User not found');
  res.json({user:safe(user)});
});
router.patch('/users/:id',async(req,res)=>{
  const parsed=editable.safeParse(req.body);
  if(!parsed.success) throw fail(400,parsed.error.issues[0].message);
  const entries=Object.entries(parsed.data);
  if(!entries.length) throw fail(400,'No profile changes supplied');
  const id=numericId(req.params.id);
  await db.transaction(async()=>{
    const user=(await query('SELECT role,counselor_type FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id])).rows[0];
    if(!user||user.role==='admin') throw fail(403,'Use this page to manage student and counselor accounts only');
    if(parsed.data.is_disabled===1 && (await query("SELECT id FROM call_rooms WHERE host_id=$1 AND status='active' AND ends_at>$2",[id,new Date()])).rowCount) throw fail(409,'End the counselor’s active classes before disabling the account');
    if(user.counselor_type==='ai'&&parsed.data.is_approved===1) throw fail(400,'AI profiles cannot be enabled as human login accounts');
    await query(`UPDATE users SET ${entries.map(([key],i)=>`${key}=$${i+1}`).join(',')},updated_at=now(),token_version=token_version+1 WHERE id=$${entries.length+1}`,[...entries.map(([,value])=>value),id]);
    await audit(req.user.id,'profile_updated',id,{fields:entries.map(([key])=>key)});
    await notify(id,'system','Account details updated','An administrator updated your profile. Sign in again to refresh your session.',`/${user.role}/profile`);
  })();
  res.json({updated:true});
});
router.post('/users/:id/password',async(req,res)=>{
  const password=req.body.password;
  if(typeof password!=='string'||password.length<12||Buffer.byteLength(password)>72) throw fail(400,'Use a password of at least 12 characters and at most 72 bytes');
  const hash=await bcrypt.hash(password,12),id=numericId(req.params.id);
  await db.transaction(async()=>{
    if(!(await query("UPDATE users SET password=$1,token_version=token_version+1,updated_at=now() WHERE id=$2 AND role IN ('student','counselor') AND counselor_type='human' AND deleted_at IS NULL",[hash,id])).rowCount) throw fail(404,'Active human account not found');
    await audit(req.user.id,'password_reset',id);
  })();
  res.json({message:'Password reset. Existing sessions have been revoked.'});
});
router.delete('/users/:id',async(req,res)=>{
  const id=numericId(req.params.id);
  await db.transaction(async()=>{
    if((await query("SELECT id FROM call_rooms WHERE host_id=$1 AND status='active'",[id])).rowCount) throw fail(409,'End this counselor’s active classes before deleting their account');
    if(!(await query("UPDATE users SET deleted_at=now(),is_disabled=1,token_version=token_version+1 WHERE id=$1 AND role IN ('student','counselor') AND counselor_type='human' AND deleted_at IS NULL",[id])).rowCount) throw fail(404,'Active human account not found');
    await query('UPDATE counselor_assignments SET is_active=0,updated_at=now() WHERE student_id=$1 OR counselor_id=$1',[id]);
    await audit(req.user.id,'account_soft_deleted',id);
  })();
  res.json({message:'Account access removed. Financial records and private materials are retained for audit.'});
});
router.post('/assignments',async(req,res)=>{
  const studentId=numericId(req.body.studentId),counselorId=numericId(req.body.counselorId),careerId=numericId(req.body.careerId),level=Number(req.body.level||1);
  if(!Number.isInteger(level)||level<1||level>10) throw fail(400,'Career level must be 1–10');
  await db.transaction(async()=>{
    if(!(await query("SELECT id FROM users WHERE id=$1 AND role='student' AND deleted_at IS NULL AND is_disabled=0 FOR UPDATE",[studentId])).rowCount) throw fail(404,'Student not found');
    if(!(await query("SELECT id FROM users WHERE id=$1 AND role='counselor' AND deleted_at IS NULL AND is_disabled=0 AND (counselor_type='ai' OR is_approved=1)",[counselorId])).rowCount) throw fail(404,'Counselor not found');
    if(!(await query('SELECT id FROM counselor_career_paths WHERE counselor_id=$1 AND career_id=$2',[counselorId,careerId])).rowCount) throw fail(400,'Map this counselor to the chosen career first');
    if(req.body.replace) await query('UPDATE counselor_assignments SET is_active=0,updated_at=now() WHERE student_id=$1 AND career_id=$2',[studentId,careerId]);
    await query('INSERT INTO counselor_assignments(student_id,counselor_id,career_id,career_level) VALUES($1,$2,$3,$4) ON CONFLICT(student_id,counselor_id) DO UPDATE SET is_active=1,career_id=EXCLUDED.career_id,career_level=EXCLUDED.career_level,updated_at=now()',[studentId,counselorId,careerId,level]);
    await audit(req.user.id,'counselor_assigned',studentId,{counselorId,careerId,level,replace:!!req.body.replace});
    await notify(studentId,'system','Counselor assignment updated','Your counselor, career or progression level was updated. Check your planning page.','/student/appointments');
    await notify(counselorId,'system','Student assigned','An administrator updated your student assignment.','/counselor/students');
    await planningChanged(studentId,counselorId);
  })();
  res.json({assigned:true});
});
router.put('/counselors/:id/careers',async(req,res)=>{
  const id=numericId(req.params.id),ids=req.body.careerIds;
  if(!Array.isArray(ids)||ids.length>200||ids.some(i=>!Number.isSafeInteger(i)||i<=0)) throw fail(400,'Valid career IDs required');
  await db.transaction(async()=>{
    if(!(await query("SELECT id FROM users WHERE id=$1 AND role='counselor' AND deleted_at IS NULL FOR UPDATE",[id])).rowCount) throw fail(404,'Counselor not found');
    await query('DELETE FROM counselor_career_paths WHERE counselor_id=$1',[id]);
    for(const careerId of new Set(ids)) await query('INSERT INTO counselor_career_paths(counselor_id,career_id) VALUES($1,$2)',[id,careerId]);
    await audit(req.user.id,'career_mapping_updated',id,{careerIds:ids});
  })();
  res.json({updated:true});
});
router.post('/students/:id/complete',async(req,res)=>{
  const id=numericId(req.params.id);
  await db.transaction(async()=>{
    if(!(await query("UPDATE users SET counseling_completed_at=now() WHERE id=$1 AND role='student' AND deleted_at IS NULL",[id])).rowCount) throw fail(404,'Student not found');
    await audit(req.user.id,'counseling_cycle_completed',id);
    await notify(id,'system','Counseling cycle completed','Your cycle is complete. At the end of your covered academic year you become alumni; your materials and counselor assignment remain available.','/student/archive');
  })();
  res.json({completed:true});
});
export default router;
