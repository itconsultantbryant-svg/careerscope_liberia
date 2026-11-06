import express from 'express';
import rateLimit from 'express-rate-limit';
import { db, query } from '../db/postgres.js';
import { authenticate } from '../middleware/pg-auth.js';
import { fail, notify, numericId, planningChanged } from '../services/notifications.js';
import { publish } from '../routes/realtime.js';
import { planRecord } from './planner.js';
import { scheduleOccurrence } from '../../shared/scheduling.js';

const router = express.Router();
router.use(authenticate);
const uuid = (value) => { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '')) throw fail(400, 'Invalid room identifier'); return value; };
async function roomFor(id, userId, lock = false) {
  const room = (await query(`SELECT r.* FROM call_rooms r WHERE r.id=$1 ${lock ? 'FOR UPDATE' : ''}`, [uuid(id)])).rows[0];
  if (!room || !(await query('SELECT user_id FROM call_room_members WHERE room_id=$1 AND user_id=$2', [id,userId])).rowCount) throw fail(404, 'Room not found or you have not been invited');
  return room;
}
async function broadcast(roomId, event, data) {
  const members = (await query('SELECT user_id FROM call_room_members WHERE room_id=$1', [roomId])).rows;
  await publish(event, { roomId, ...data }, members.map(m => m.user_id));
}
router.post('/', async (req,res) => {
  if (req.user.role !== 'counselor') throw fail(403, 'Only the assigned counselor can create a classroom');
  const type = req.body.type;
  if (!['appointment','schedule'].includes(type)) throw fail(400, 'A confirmed appointment or schedule is required');
  const room = await db.transaction(async () => {
    const plan = await planRecord(type,req.body.planId,req.user,true);
    if (plan.counselor_id !== req.user.id || !['accepted','active'].includes(plan.status)) throw fail(409, 'The plan must be accepted by the student first');
    let start, end;
    if (type === 'appointment') { start = new Date(plan.starts_at); end = new Date(plan.ends_at); }
    else { try { ({start,end} = scheduleOccurrence(plan,req.body.date)); } catch(error) { throw fail(400,error.message); } }
    if (!Number.isFinite(start.getTime()) || end <= new Date()) throw fail(400, 'This class time has passed');
    const existing = (await query(`SELECT * FROM call_rooms WHERE ${type === 'appointment' ? 'appointment_id=$1' : 'schedule_id=$1 AND occurrence_date=$2'}`,type === 'appointment' ? [plan.id] : [plan.id,req.body.date])).rows[0];
    if (existing && existing.status !== 'ended') return existing;
    if (existing && !existing.started_at) {
      const updated=(await query("UPDATE call_rooms SET status='planned',ended_at=NULL,starts_at=$2,ends_at=$3,call_type=$4 WHERE id=$1 RETURNING *",[existing.id,start,end,req.body.callType==='voice'?'voice':'video'])).rows[0];
      await query('DELETE FROM call_room_members WHERE room_id=$1 AND user_id<>ALL($2::integer[])',[existing.id,[req.user.id,plan.student_id]]);
      await notify(plan.student_id,'session','Classroom time updated','Your accepted revision has a classroom ready for its new time.',`/classroom/${existing.id}`);
      await planningChanged(plan.student_id,plan.counselor_id);
      return updated;
    }
    if (existing) throw fail(409,'This classroom has ended; propose a new session to meet again');
    const record = (await query('INSERT INTO call_rooms(host_id,title,call_type,appointment_id,schedule_id,occurrence_date,starts_at,ends_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[req.user.id,String(req.body.title || 'Career counseling class').slice(0,160),req.body.callType === 'voice' ? 'voice' : 'video',type === 'appointment' ? plan.id : null,type === 'schedule' ? plan.id : null,type === 'schedule' ? req.body.date : null,start,end])).rows[0];
    for (const id of [req.user.id,plan.student_id]) await query('INSERT INTO call_room_members(room_id,user_id) VALUES($1,$2)',[record.id,id]);
    await notify(plan.student_id,'session','Classroom invitation','Your counselor has prepared a secure classroom. Join after the counselor starts the class.',`/classroom/${record.id}`);
    await planningChanged(plan.student_id,plan.counselor_id);
    return record;
  })();
  res.status(201).json({room});
});
router.get('/:id',async(req,res)=>{
  const room = await roomFor(req.params.id,req.user.id);
  const members = (await query("SELECT m.*,u.first_name || ' ' || u.last_name AS name,u.role,(m.first_joined_at IS NOT NULL AND m.left_at IS NULL AND m.last_seen_at>now()-interval '45 seconds') AS is_present FROM call_room_members m JOIN users u ON u.id=m.user_id WHERE room_id=$1 ORDER BY user_id",[room.id])).rows;
  // TURN credentials are supplied by the operator, never fabricated. Use short-lived credentials in production.
  const iceServers = [{urls:'stun:stun.l.google.com:19302'}];
  if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) iceServers.push({urls:process.env.TURN_URL.split(','),username:process.env.TURN_USERNAME,credential:process.env.TURN_CREDENTIAL});
  res.json({room,members,iceServers,turnConfigured:iceServers.length>1,serverNow:new Date().toISOString()});
});
router.post('/:id/invite',async(req,res)=>{
  await db.transaction(async()=>{
    const room = await roomFor(req.params.id,req.user.id,true);
    if (room.host_id !== req.user.id || room.status === 'ended') throw fail(403,'Only the host can invite members to an open classroom');
    const userId = numericId(req.body.userId);
    const user = (await query("SELECT id,role FROM users WHERE id=$1 AND is_disabled=0 AND deleted_at IS NULL AND counselor_type='human' AND (role<>'counselor' OR is_approved=1)",[userId])).rows[0];
    if (!user) throw fail(404,'Active user not found');
    if ((await query('SELECT user_id FROM call_room_members WHERE room_id=$1 AND user_id=$2',[room.id,userId])).rowCount) return;
    if ((await query('SELECT COUNT(*) AS count FROM call_room_members WHERE room_id=$1',[room.id])).rows[0].count >= 6) throw fail(409,'A classroom supports at most six invited members');
    if (user.role === 'student') {
      const appointments = (await query("SELECT * FROM appointments WHERE student_id=$1 AND counselor_id=$2 AND status='accepted' AND starts_at <= $3 AND ends_at >= $4",[userId,room.host_id,room.starts_at,room.ends_at])).rows;
      const schedules = (await query("SELECT * FROM schedules WHERE student_id=$1 AND counselor_id=$2 AND status IN ('accepted','active')",[userId,room.host_id])).rows;
      const date = (await import('../../shared/scheduling.js')).localDate(new Date(room.starts_at));
      const overlaps = schedules.some(s=>{ try { const occurrence=scheduleOccurrence(s,date); return occurrence.start<=new Date(room.starts_at)&&occurrence.end>=new Date(room.ends_at); } catch { return false; } });
      if (!appointments.length && !overlaps) throw fail(409,'This student needs an accepted counseling plan covering the same class time');
    }
    await query('INSERT INTO call_room_members(room_id,user_id) VALUES($1,$2)',[room.id,userId]);
    await notify(userId,'session','Group classroom invitation','You have been invited to an authorized counseling class.',`/classroom/${room.id}`);
    await broadcast(room.id,'room_changed',{});
  })();
  res.json({invited:true});
});
router.post('/:id/start',async(req,res)=>{
  await db.transaction(async()=>{
    const room=await roomFor(req.params.id,req.user.id,true);
    if (room.host_id!==req.user.id) throw fail(403,'Only the counselor host can start the class');
    if (room.status==='ended' || Date.now()<new Date(room.starts_at).getTime() || Date.now()>=new Date(room.ends_at).getTime()) throw fail(409,'The class can only start during its confirmed time window');
    const type=room.appointment_id?'appointment':'schedule';
    const plan=await planRecord(type,room.appointment_id||room.schedule_id,req.user,true);
    if (!['accepted','active'].includes(plan.status)) throw fail(409,'The counseling plan is no longer confirmed');
    await query("UPDATE call_rooms SET status='active',started_at=COALESCE(started_at,now()) WHERE id=$1",[room.id]);
    const members=(await query('SELECT m.user_id,u.role FROM call_room_members m JOIN users u ON u.id=m.user_id WHERE room_id=$1 AND user_id<>$2',[room.id,req.user.id])).rows;
    for(const member of members) await notify(member.user_id,'session','Your counselor started the class','Join your secure classroom now.',`/classroom/${room.id}`);
    await broadcast(room.id,'room_changed',{});
  })();
  res.json({started:true});
});
router.post('/:id/join',async(req,res)=>{
  await db.transaction(async()=>{
    const room=await roomFor(req.params.id,req.user.id,true);
    if(room.status!=='active' || Date.now()>=new Date(room.ends_at).getTime()) throw fail(409,'The counselor must start the class first, and the class must still be in progress');
    await query('UPDATE call_room_members SET first_joined_at=COALESCE(first_joined_at,now()),last_seen_at=now(),left_at=NULL WHERE room_id=$1 AND user_id=$2',[room.id,req.user.id]);
    await broadcast(room.id,'room_joined',{userId:req.user.id});
  })();
  res.json({joined:true});
});
router.post('/:id/presence',async(req,res)=>{
  const room=await roomFor(req.params.id,req.user.id);
  if(room.status!=='active') throw fail(409,'Class is not active');
  await query('UPDATE call_room_members SET last_seen_at=now(),hand_raised=$3,mic_muted=$4,screen_sharing=$5 WHERE room_id=$1 AND user_id=$2 AND first_joined_at IS NOT NULL AND left_at IS NULL',[room.id,req.user.id,!!req.body.handRaised,!!req.body.micMuted,!!req.body.screenSharing]);
  res.json({ok:true});
});
router.post('/:id/leave',async(req,res)=>{
  const room=await roomFor(req.params.id,req.user.id);
  await query('UPDATE call_room_members SET left_at=now(),hand_raised=false,screen_sharing=false WHERE room_id=$1 AND user_id=$2',[room.id,req.user.id]);
  await broadcast(room.id,'room_left',{userId:req.user.id});
  res.json({left:true});
});
router.post('/:id/end',async(req,res)=>{
  await db.transaction(async()=>{
    const room=await roomFor(req.params.id,req.user.id,true);
    if(room.host_id!==req.user.id) throw fail(403,'Only the counselor host can end the class');
    await query("UPDATE call_rooms SET status='ended',ended_at=now() WHERE id=$1",[room.id]);
    await query('UPDATE call_room_members SET left_at=now() WHERE room_id=$1',[room.id]);
    await broadcast(room.id,'room_ended',{});
  })();
  res.json({ended:true});
});
router.post('/:id/signal',rateLimit({windowMs:60000,max:600,standardHeaders:true,legacyHeaders:false}),async(req,res)=>{
  const room=await roomFor(req.params.id,req.user.id);
  if(room.status!=='active' || new Date(room.ends_at)<=new Date()) throw fail(409,'Class is not active');
  const sender=(await query("SELECT user_id FROM call_room_members WHERE room_id=$1 AND user_id=$2 AND first_joined_at IS NOT NULL AND left_at IS NULL AND last_seen_at>now()-interval '45 seconds'",[room.id,req.user.id])).rows[0];
  if(!sender) throw fail(403,'Join the class before sending signals');
  if(req.body.kind==='reaction') {
    if(!['👍','👏','❤️','🎉','❓'].includes(req.body.reaction)) throw fail(400,'Unsupported reaction');
    await broadcast(room.id,'room_reaction',{from:req.user.id,reaction:req.body.reaction});
  } else {
    const to=numericId(req.body.to);
    const target=(await query('SELECT * FROM call_room_members WHERE room_id=$1 AND user_id=$2 AND first_joined_at IS NOT NULL AND left_at IS NULL AND last_seen_at>now()-interval \'45 seconds\'',[room.id,to])).rows[0];
    if(!target || to===req.user.id) throw fail(403,'The recipient must be present in this classroom');
    if(!['offer','answer','candidate'].includes(req.body.kind)) throw fail(400,'Unsupported signaling message');
    if(JSON.stringify(req.body.data || {}).length>40000) throw fail(400,'Signal too large');
    await publish('room_signal',{roomId:room.id,from:req.user.id,kind:req.body.kind,data:req.body.data},[to]);
  }
  res.json({sent:true});
});
export default router;
