import 'dotenv/config';
import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

// Preserve the existing API's numeric counters and integer flags.
pg.types.setTypeParser(20, (value) => Number(value));
// Calendar dates are not instants; keep them stable across server timezones.
pg.types.setTypeParser(1082, (value) => value);
const context = new AsyncLocalStorage();
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL?.replace(/sslmode=require\b/, 'sslmode=verify-full'), max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 15000, statement_timeout: 15000, query_timeout: 20000, allowExitOnIdle: true });

export function postgresSql(source, returning = false) {
  let sql = source.trim().replace(/;$/, '');
  const ignore = /INSERT\s+OR\s+IGNORE/i.test(sql);
  sql = sql.replace(/INSERT\s+OR\s+IGNORE/gi, 'INSERT');
  sql = sql.replace(/GROUP_CONCAT\(([^)]+)\)/gi, "STRING_AGG(($1)::text, ',')");
  // Replace only placeholders outside SQL string literals.
  let parameter = 0;
  sql = sql.replace(/'(?:''|[^'])*'|\?/g, (token) => token === '?' ? `$${++parameter}` : token);
  if (ignore) sql += ' ON CONFLICT DO NOTHING';
  if (returning && /^INSERT\b/i.test(sql) && !/\bRETURNING\b/i.test(sql)) sql += ' RETURNING id';
  return sql;
}

export const query = (sql, values = []) => (context.getStore() || pool).query(sql, values);
async function event(name, payload, recipients = [null]) {
  for (const id of [...new Set(recipients)]) await query('INSERT INTO realtime_events(user_id, event, payload) VALUES ($1,$2,$3)', [id, name, JSON.stringify(payload)]);
}

async function mutationEvents(source, result, values) {
  const id = result.rows[0]?.id;
  if (/^\s*INSERT\s+INTO\s+messages\b/i.test(source) && id) {
    const message = (await query("SELECT m.*, u.first_name || ' ' || u.last_name AS sender_name, u.profile_image AS sender_image FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = $1", [id])).rows[0];
    await event('new_message', { ...message, senderId: message.sender_id, receiverId: message.receiver_id }, [message.sender_id, message.receiver_id]);
    await event('message_notification', { senderId: message.sender_id }, [message.receiver_id]);
    const notification = (await query("INSERT INTO notifications(user_id,type,title,message,related_id,target_path) VALUES($1,'message','New message','You have a new private message. Open the conversation to read it.',$2,$3) RETURNING *", [message.receiver_id,message.id,`/chat?userId=${message.sender_id}`])).rows[0];
    await event('notification_created',notification,[message.receiver_id]);
  } else if (/^\s*INSERT\s+INTO\s+posts\b/i.test(source) && id) {
    const post = (await query("SELECT p.*, u.first_name || ' ' || u.last_name AS author_name, u.profile_image AS author_image FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = $1", [id])).rows[0];
    post.images = post.images ? JSON.parse(post.images) : [];
    await event('post_created', post);
  } else if (/^\s*(INSERT\s+INTO|DELETE\s+FROM)\s+post_likes\b/i.test(source)) {
    const postId = values[0];
    const count = (await query('SELECT COUNT(*) AS count FROM post_likes WHERE post_id = $1', [postId])).rows[0].count;
    await event('post_like_update', { postId: Number(postId), likesCount: count });
  } else if (/^\s*INSERT\s+INTO\s+comments\b/i.test(source)) {
    const postId = values[0];
    const count = (await query('SELECT COUNT(*) AS count FROM comments WHERE post_id = $1', [postId])).rows[0].count;
    await event('comment_added', { postId: Number(postId), commentsCount: count });
  } else if (/^\s*INSERT\s+INTO\s+billing_receipts\b/i.test(source) && id) {
    const allocation = (await query('SELECT a.student_id, p.submitted_by FROM billing_receipts r JOIN billing_allocations a ON a.id = r.allocation_id JOIN billing_payments p ON p.id = a.payment_id WHERE r.id = $1', [id])).rows[0];
    const admins = (await query("SELECT id FROM users WHERE role = 'admin' AND is_disabled = 0")).rows.map((user) => user.id);
    await event('billing_changed', {}, [allocation.student_id, allocation.submitted_by, ...admins]);
  } else if (/^\s*INSERT\s+INTO\s+notifications\b/i.test(source) && id) {
    const notification = (await query('SELECT n.*, u.role FROM notifications n JOIN users u ON u.id = n.user_id WHERE n.id = $1', [id])).rows[0];
    const section = { assignment: 'learning', quiz: 'learning', grade: 'grades', appointment: 'appointments', schedule: 'appointments', session: 'sessions', report: 'reports', payment: 'payments', archive: 'archive' }[notification.type] || 'dashboard';
    if (!notification.target_path) {
      notification.target_path = notification.type === 'message' ? '/chat' : `/${notification.role}/${section}`;
      await query('UPDATE notifications SET target_path = $1 WHERE id = $2', [notification.target_path, id]);
    }
    delete notification.role;
    await event('notification_created', notification, [notification.user_id]);
  } else if (/^\s*UPDATE\s+notifications\b/i.test(source)) {
    await event('notifications_changed', {}, [Number(values.at(-1))]);
  }
}
export const db = {
  dialect: 'postgres',
  prepare(source) {
    return {
      async get(...values) { return (await query(postgresSql(source), values)).rows[0]; },
      async all(...values) { return (await query(postgresSql(source), values)).rows; },
      async run(...values) {
        const publishes = /^\s*(INSERT\s+(?:OR\s+IGNORE\s+)?INTO|DELETE\s+FROM)\s+(messages|posts|post_likes|comments|billing_receipts|notifications)\b/i.test(source) || /^\s*UPDATE\s+notifications\b/i.test(source);
        if (publishes && !context.getStore()) return db.transaction(() => db.prepare(source).run(...values))();
        const result = await query(postgresSql(source, true), values);
        if (publishes && result.rowCount) await mutationEvents(source.replace(/OR\s+IGNORE\s+/i, ''), result, values);
        return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
      },
    };
  },
  transaction(callback) {
    return async (...args) => {
      if (context.getStore()) return callback(...args);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const value = await context.run(client, () => callback(...args));
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    };
  },
};
