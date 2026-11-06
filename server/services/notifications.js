import { query } from '../db/postgres.js';
import { publish } from '../routes/realtime.js';

export const fail = (status, message) => Object.assign(new Error(message), { status });
export function numericId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw fail(400, 'Invalid identifier');
  return id;
}
export async function admins() {
  return (await query("SELECT id FROM users WHERE role = 'admin' AND is_disabled = 0 AND deleted_at IS NULL")).rows.map((user) => user.id);
}
export async function notify(userId, type, title, message, targetPath, relatedId = null, metadata = {}) {
  if (!targetPath.startsWith('/') || targetPath.startsWith('//') || targetPath.includes('\\')) throw fail(400, 'Invalid notification destination');
  const row = (await query('INSERT INTO notifications(user_id, type, title, message, target_path, related_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [userId, type, title, message, targetPath, relatedId, JSON.stringify(metadata)])).rows[0];
  await publish('notification_created', row, [userId]);
  return row;
}
export async function planningChanged(studentId, counselorId) {
  await publish('planning_changed', {}, [studentId, counselorId, ...await admins()]);
}
