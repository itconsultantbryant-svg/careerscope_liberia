import express from 'express';
import { z } from 'zod';
import { db, query } from '../db/postgres.js';
import { authenticate, requireRole } from '../middleware/pg-auth.js';
import { admins, fail, notify, numericId, planningChanged } from '../services/notifications.js';
import { DEFAULT_TIMEZONE, DAYS, localDate, scheduleOccurrence } from '../../shared/scheduling.js';

export const planner = express.Router();
export const appointments = express.Router();
export const schedules = express.Router();
for (const router of [planner, appointments, schedules]) router.use(authenticate);
const fields = z.object({ notes: z.string().max(3000).optional().default(''), timezone: z.string().max(80).default(DEFAULT_TIMEZONE) });
const appointmentInput = fields.extend({ appointmentDate: z.string(), appointmentTime: z.string(), durationMinutes: z.coerce.number().int().min(15).max(180).default(60), counselorId: z.coerce.number().int().positive().optional(), studentId: z.coerce.number().int().positive().optional() });
const scheduleInput = fields.extend({ dayOfWeek: z.enum(DAYS), startTime: z.string(), endTime: z.string(), validFrom: z.string(), validUntil: z.string(), counselorId: z.coerce.number().int().positive().optional(), studentId: z.coerce.number().int().positive().optional() });
const parse = (schema, value) => { const parsed = schema.safeParse(value); if (!parsed.success) throw fail(400, parsed.error.issues[0].message); return parsed.data; };
const dateString = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
function quarterlyWindow(from,until) {
  const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(new Date(`${value}T12:00:00Z`).getTime())&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
  if(!valid(from)||!valid(until)||until<from||new Date(until)-new Date(from)>93*86400000) throw fail(400,'Choose valid quarterly dates spanning at most 93 days');
}

async function pair(req, body, requireAssignment) {
  const studentId = req.user.role === 'student' ? req.user.id : numericId(body.studentId);
  const counselorId = req.user.role === 'counselor' ? req.user.id : numericId(body.counselorId);
  const student = (await query("SELECT id FROM users WHERE id=$1 AND role='student' AND is_disabled=0 AND deleted_at IS NULL", [studentId])).rows[0];
  const counselor = (await query("SELECT id FROM users WHERE id=$1 AND role='counselor' AND counselor_type='human' AND is_approved=1 AND is_disabled=0 AND deleted_at IS NULL", [counselorId])).rows[0];
  if (!student || !counselor) throw fail(404, 'Active student and human counselor required');
  if (requireAssignment && !(await query('SELECT id FROM counselor_assignments WHERE student_id=$1 AND counselor_id=$2 AND is_active=1', [studentId, counselorId])).rowCount) throw fail(403, 'An administrator must assign this counselor to the student first');
  return { studentId, counselorId };
}
export async function planRecord(type, id, user, lock = false) {
  const table = type === 'appointment' ? 'appointments' : 'schedules';
  const row = (await query(`SELECT * FROM ${table} WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`, [numericId(id)])).rows[0];
  if (!row) throw fail(404, 'Planning record not found');
  if (user.role !== 'admin' && ![row.student_id, row.counselor_id].includes(user.id)) throw fail(403, 'This plan does not belong to you');
  return row;
}
function version(row, body) {
  if (Number(body.revision) !== row.revision) throw fail(409, 'This plan has changed. Refresh and review the latest version before responding.');
}
async function announce(row, type, actor, title, message) {
  const studentPath = `/student/appointments?tab=${type === 'schedule' ? 'schedules' : 'appointments'}&focus=${type}-${row.id}`;
  const counselorPath = studentPath.replace('/student/', '/counselor/');
  if (actor.id !== row.student_id) await notify(row.student_id, type, title, message, studentPath, row.id);
  if (actor.id !== row.counselor_id) await notify(row.counselor_id, type, title, message, counselorPath, row.id);
  for (const adminId of await admins()) if (adminId !== actor.id) await notify(adminId,type,title,'A counseling plan changed. Open the planning page to review.',studentPath.replace('/student/','/admin/'),row.id);
  await planningChanged(row.student_id, row.counselor_id);
}
async function history(type, row, actor, action) {
  await query('INSERT INTO planning_changes(entity_type, entity_id, actor_id, revision, details) VALUES ($1,$2,$3,$4,$5)', [type, row.id, actor.id, row.revision, JSON.stringify({ action, status: row.status, startsAt: row.starts_at, endsAt: row.ends_at, day: row.day_of_week, from: row.valid_from, until: row.valid_until, timezone: row.timezone, startTime: row.start_time, endTime: row.end_time })]);
}
async function assign(row) {
  await query('INSERT INTO counselor_assignments(student_id, counselor_id) VALUES ($1,$2) ON CONFLICT(student_id,counselor_id) DO UPDATE SET is_active=1, updated_at=now()', [row.student_id, row.counselor_id]);
}
async function noActiveRoom(type, row) {
  await query(`UPDATE call_rooms SET status='ended',ended_at=now() WHERE ${type === 'appointment' ? 'appointment_id' : 'schedule_id'}=$1 AND status='active' AND ends_at <= $2`, [row.id,new Date()]);
  if ((await query(`SELECT id FROM call_rooms WHERE ${type === 'appointment' ? 'appointment_id' : 'schedule_id'}=$1 AND status='active'`, [row.id])).rowCount) throw fail(409, 'End the active class before changing its plan. Participants may leave the class at any time.');
}

appointments.post('/', requireRole('student', 'counselor'), async (req, res) => {
  const input = parse(appointmentInput, req.body);
  const { studentId, counselorId } = await pair(req, input, req.user.role === 'counselor');
  const { wallTimeToDate } = await import('../../shared/scheduling.js');
  let start;
  try { start = wallTimeToDate(input.appointmentDate, input.appointmentTime, input.timezone); } catch (error) { throw fail(400, error.message); }
  if (start.getTime() < Date.now() - 120000) throw fail(400, 'Choose a future appointment time');
  const end = new Date(start.getTime() + input.durationMinutes * 60000);
  const row = await db.transaction(async () => {
    const record = (await query("INSERT INTO appointments(student_id,counselor_id,appointment_date,appointment_time,notes,status,created_by_id,starts_at,ends_at,timezone) VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9) RETURNING *", [studentId, counselorId, input.appointmentDate, input.appointmentTime, input.notes, req.user.id, start, end, input.timezone])).rows[0];
    await history('appointment', record, req.user, 'proposed');
    await announce(record, 'appointment', req.user, 'Appointment proposed', 'Review the proposed date and time, then accept or decline.');
    return record;
  })();
  res.status(201).json({ appointmentId: row.id, appointment: row });
});

async function createSchedule(req, res) {
  // Older clients may omit the quarter dates; the default is a 90-day plan.
  const timezone = req.body.timezone || DEFAULT_TIMEZONE;
  let from,until;
  try {
    from = req.body.validFrom || localDate(new Date(), timezone);
    until = req.body.validUntil || new Date(new Date(`${from}T12:00:00Z`).getTime() + 90 * 86400000).toISOString().slice(0, 10);
  } catch { throw fail(400,'Enter valid quarterly dates and timezone'); }
  const input = parse(scheduleInput, { ...req.body, validFrom: from, validUntil: until });
  quarterlyWindow(from,until);
  const { studentId, counselorId } = await pair(req, input, true);
  const sample = { day_of_week: DAYS[new Date(`${from}T12:00:00Z`).getUTCDay()], start_time: input.startTime, end_time: input.endTime, valid_from: from, valid_until: until, timezone: input.timezone };
  try { scheduleOccurrence(sample, from); } catch (error) { throw fail(400, error.message); }
  const row = await db.transaction(async () => {
    const record = (await query("INSERT INTO schedules(student_id,counselor_id,day_of_week,start_time,end_time,notes,schedule_type,status,created_by,valid_from,valid_until,timezone) VALUES($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,$11) RETURNING *", [studentId,counselorId,input.dayOfWeek,input.startTime,input.endTime,input.notes,req.user.role === 'counselor' ? 'counselor_created' : 'student_proposed',req.user.role,from,until,input.timezone])).rows[0];
    await history('schedule', record, req.user, 'proposed');
    await announce(record, 'schedule', req.user, 'Quarterly schedule proposed', 'Review your availability and accept or decline the proposed schedule.');
    return record;
  })();
  res.status(201).json({ scheduleId: row.id, schedule: row });
}
schedules.post('/counselor/create', requireRole('counselor'), createSchedule);
schedules.post('/student/propose', requireRole('student'), createSchedule);

async function respond(req, res, type, status) {
  if (!['accepted','rejected','cancelled','completed'].includes(status)) throw fail(400, 'Invalid planning status');
  const result = await db.transaction(async () => {
    const row = await planRecord(type, req.params.id, req.user, true);
    version(row, req.body);
    const proposer = type === 'appointment' ? row.created_by_id : row.created_by === 'student' ? row.student_id : row.counselor_id;
    if (['accepted','rejected'].includes(status)) {
      if (row.status !== 'pending' || proposer === req.user.id || ![row.student_id,row.counselor_id].includes(req.user.id)) throw fail(409, 'Only the other participant can respond to a pending proposal');
    } else {
      if (status === 'completed' && (req.user.id !== row.counselor_id || !['accepted','active'].includes(row.status))) throw fail(403, 'Only the counselor may complete a confirmed plan');
      await noActiveRoom(type, row);
    }
    const table = type === 'appointment' ? 'appointments' : 'schedules';
    const updated = (await query(`UPDATE ${table} SET status=$1, rejection_reason=$2, revision=revision+1 WHERE id=$3 RETURNING *`, [status, String(req.body.rejectionReason || '').slice(0,1000) || null, row.id])).rows[0];
    if (['cancelled', 'completed', 'rejected'].includes(status)) await query(`UPDATE call_rooms SET status='ended',ended_at=now() WHERE ${type === 'appointment' ? 'appointment_id' : 'schedule_id'}=$1 AND status='planned'`, [row.id]);
    if (status === 'accepted') await assign(updated);
    await history(type, updated, req.user, status);
    await announce(updated, type, req.user, `${type === 'schedule' ? 'Schedule' : 'Appointment'} ${status}`, status === 'accepted' ? 'Confirmed. This plan is visible on the student, counselor and admin calendars.' : `Your counseling plan was ${status}. Open the planning page for details.`);
    return updated;
  })();
  res.json({ message: `Plan ${status}`, record: result });
}
appointments.patch('/:id/status', requireRole('student','counselor','admin'), (req,res) => respond(req,res,'appointment',req.body.status));
schedules.patch('/:id/accept', requireRole('student','counselor'), (req,res) => respond(req,res,'schedule','accepted'));
schedules.patch('/:id/reject', requireRole('student','counselor'), (req,res) => respond(req,res,'schedule','rejected'));
schedules.patch('/:id/status', requireRole('student','counselor','admin'), (req,res) => respond(req,res,'schedule',req.body.status));
schedules.delete('/:id', requireRole('student','counselor','admin'), (req,res) => respond(req,res,'schedule','cancelled'));

async function edit(req, res, type) {
  await db.transaction(async () => {
    const row = await planRecord(type, req.params.id, req.user, true);
    if (!['pending','accepted','active'].includes(row.status)) throw fail(409, 'This plan is closed');
    version(row, req.body); await noActiveRoom(type,row);
    if (type === 'appointment') {
      const input = parse(appointmentInput, req.body);
      const { wallTimeToDate } = await import('../../shared/scheduling.js');
      let start; try { start = wallTimeToDate(input.appointmentDate,input.appointmentTime,input.timezone); } catch(error) { throw fail(400,error.message); }
      if (start.getTime() < Date.now() - 120000) throw fail(400,'Choose a future time');
      await query("UPDATE appointments SET appointment_date=$1,appointment_time=$2,starts_at=$3,ends_at=$4,timezone=$5,notes=$6,status='pending',created_by_id=$7,revision=revision+1 WHERE id=$8", [input.appointmentDate,input.appointmentTime,start,new Date(start.getTime()+input.durationMinutes*60000),input.timezone,input.notes,req.user.id,row.id]);
    } else {
      const input = parse(scheduleInput,req.body);
      quarterlyWindow(input.validFrom,input.validUntil);
      try { scheduleOccurrence({ day_of_week: DAYS[new Date(`${input.validFrom}T12:00:00Z`).getUTCDay()],start_time:input.startTime,end_time:input.endTime,valid_from:input.validFrom,valid_until:input.validUntil,timezone:input.timezone },input.validFrom); } catch(error) { throw fail(400,error.message); }
      await query("UPDATE schedules SET day_of_week=$1,start_time=$2,end_time=$3,valid_from=$4,valid_until=$5,timezone=$6,notes=$7,status='pending',created_by=$8,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=$9",[input.dayOfWeek,input.startTime,input.endTime,input.validFrom,input.validUntil,input.timezone,input.notes,req.user.role,row.id]);
    }
    await query(`UPDATE call_rooms SET status='ended',ended_at=now() WHERE ${type === 'appointment' ? 'appointment_id' : 'schedule_id'}=$1 AND status='planned'`,[row.id]);
    const updated = await planRecord(type,row.id,req.user);
    await history(type,updated,req.user,'revised');
    await announce(updated,type,req.user,'Counseling plan updated','The date or availability has changed. Review and accept the new revision before it is confirmed again.');
  })();
  res.json({ message:'Changes saved; the other participant must accept the new revision.' });
}
appointments.patch('/:id',requireRole('student','counselor'),(req,res)=>edit(req,res,'appointment'));
schedules.patch('/:id',requireRole('student','counselor'),(req,res)=>edit(req,res,'schedule'));

planner.get('/overview',async(req,res)=>{
  const admin=req.user.role==='admin';
  const column=req.user.role==='student'?'student_id':'counselor_id';
  const params=admin?[]:[req.user.id];
  const appointmentsRows=(await query(`SELECT a.*, s.first_name || ' ' || s.last_name AS student_name,c.first_name || ' ' || c.last_name AS counselor_name FROM appointments a JOIN users s ON s.id=a.student_id JOIN users c ON c.id=a.counselor_id ${admin?'':`WHERE a.${column}=$1`} ORDER BY a.starts_at DESC NULLS LAST LIMIT 1000`,params)).rows;
  const schedulesRows=(await query(`SELECT a.*, s.first_name || ' ' || s.last_name AS student_name,c.first_name || ' ' || c.last_name AS counselor_name FROM schedules a JOIN users s ON s.id=a.student_id JOIN users c ON c.id=a.counselor_id ${admin?'':`WHERE a.${column}=$1`} ORDER BY a.created_at DESC LIMIT 1000`,params)).rows.map(row=>({...row,valid_from:dateString(row.valid_from),valid_until:dateString(row.valid_until)}));
  const students=admin?(await query("SELECT id,first_name,last_name FROM users WHERE role='student' AND is_disabled=0 AND deleted_at IS NULL ORDER BY first_name")).rows:req.user.role==='counselor'?(await query("SELECT u.id,u.first_name,u.last_name FROM users u JOIN counselor_assignments a ON a.student_id=u.id WHERE a.counselor_id=$1 AND a.is_active=1 AND u.is_disabled=0 AND u.deleted_at IS NULL ORDER BY u.first_name",[req.user.id])).rows:[];
  const counselors=(await query("SELECT u.id,u.first_name,u.last_name,u.industry_specialty,EXISTS(SELECT 1 FROM counselor_assignments a WHERE a.student_id=$1 AND a.counselor_id=u.id AND a.is_active=1) AS is_assigned FROM users u WHERE u.role='counselor' AND u.counselor_type='human' AND u.is_approved=1 AND u.is_disabled=0 AND u.deleted_at IS NULL ORDER BY u.first_name",[req.user.id])).rows;
  const rooms=(await query("SELECT r.*, EXISTS(SELECT 1 FROM call_room_members m WHERE m.room_id=r.id AND m.user_id=$1) AS is_invited FROM call_rooms r WHERE ($2='admin' OR EXISTS(SELECT 1 FROM call_room_members m WHERE m.room_id=r.id AND m.user_id=$1)) ORDER BY r.created_at DESC LIMIT 100",[req.user.id,req.user.role])).rows;
  res.json({appointments:appointmentsRows,schedules:schedulesRows,students,counselors,rooms,serverNow:new Date().toISOString()});
});
planner.get('/history/:type/:id',async(req,res)=>{
  if (!['appointment','schedule'].includes(req.params.type)) throw fail(400,'Invalid record type');
  await planRecord(req.params.type,req.params.id,req.user);
  const changes=(await query('SELECT p.*, u.first_name || \' \' || u.last_name AS actor_name FROM planning_changes p JOIN users u ON u.id=p.actor_id WHERE entity_type=$1 AND entity_id=$2 ORDER BY p.id DESC',[req.params.type,req.params.id])).rows;
  res.json({changes});
});
