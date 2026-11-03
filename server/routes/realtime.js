import express from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db/postgres.js';
import { authenticate } from '../middleware/pg-auth.js';

const router = express.Router();
let lastCleanup = 0;
router.use(authenticate);
const sendLimit = rateLimit({ windowMs: 60000, max: 120, standardHeaders: true, legacyHeaders: false });
export async function publish(event, payload, users = [null]) {
  for (const userId of [...new Set(users)]) await query('INSERT INTO realtime_events(user_id, event, payload) VALUES ($1,$2,$3)', [userId, event, JSON.stringify(payload)]);
}

// A durable, authenticated event cursor works on Vercel without a persistent
// WebSocket process or a third-party service key. Clients reconnect from cursor.
router.get('/events', async (req, res) => {
  if (Date.now() - lastCleanup > 60000) {
    lastCleanup = Date.now();
    await query("DELETE FROM realtime_events WHERE id IN (SELECT id FROM realtime_events WHERE created_at < now() - interval '1 day' LIMIT 1000)");
  }
  const after = Number(req.query.after);
  if (req.query.after === undefined) {
    const cursor = (await query('SELECT COALESCE(MAX(id),0) AS id FROM realtime_events')).rows[0].id;
    return res.json({ cursor, events: [] });
  }
  if (!Number.isSafeInteger(after) || after < 0) return res.status(400).json({ error: 'Invalid event cursor' });
  const events = (await query('SELECT id, event, payload FROM realtime_events WHERE id > $1 AND (user_id IS NULL OR user_id = $2) ORDER BY id LIMIT 100', [after, req.user.id])).rows;
  res.json({ cursor: events.at(-1)?.id ?? after, events });
});

router.post('/publish', sendLimit, async (req, res) => {
  const { event, data = {} } = req.body;
  const userId = req.user.id;
  if (event === 'send_message') {
    const message = (await query('SELECT m.*, u.first_name || \' \' || u.last_name AS sender_name, u.profile_image AS sender_image FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = $1 AND m.sender_id = $2', [data.id, userId])).rows[0];
    if (!message) return res.status(403).json({ error: 'Message must be saved by its sender first' });
    await publish('new_message', { ...message, senderId: userId, receiverId: message.receiver_id }, [message.sender_id, message.receiver_id]);
    await publish('message_notification', { senderId: userId, receiverId: message.receiver_id }, [message.receiver_id]);
  } else if (event === 'typing') {
    const receiver = Number(data.receiverId);
    if (!Number.isInteger(receiver) || receiver === userId) return res.status(400).json({ error: 'Invalid recipient' });
    if (!(await query('SELECT id FROM users WHERE id = $1 AND is_disabled = 0', [receiver])).rowCount) return res.status(404).json({ error: 'Recipient not found' });
    await publish('user_typing', { userId, isTyping: Boolean(data.isTyping) }, [receiver]);
  } else if (event === 'new_post') {
    const post = (await query("SELECT p.*, u.first_name || ' ' || u.last_name AS author_name, u.profile_image AS author_image FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = $1 AND p.user_id = $2", [data.id, userId])).rows[0];
    if (!post) return res.status(403).json({ error: 'Post not found' });
    post.images = post.images ? JSON.parse(post.images) : [];
    await publish('post_created', post);
  } else if (event === 'post_liked' || event === 'new_comment') {
    const post = (await query('SELECT id, (SELECT COUNT(*) FROM post_likes WHERE post_id = posts.id) AS likes_count, (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) AS comments_count FROM posts WHERE id = $1', [data.postId])).rows[0];
    if (!post) return res.status(404).json({ error: 'Post not found' });
    await publish(event === 'post_liked' ? 'post_like_update' : 'comment_added', { postId: post.id, likesCount: post.likes_count, commentsCount: post.comments_count });
  } else if (['call_signal', 'call_answer', 'call_end', 'ice_candidate'].includes(event)) {
    const to = Number(data.to);
    const callId = Number(data.callId);
    const call = (await query('SELECT * FROM call_history WHERE id = $1 AND ((caller_id = $2 AND receiver_id = $3) OR (receiver_id = $2 AND caller_id = $3))', [callId, userId, to])).rows[0];
    if (!call) return res.status(403).json({ error: 'Call participation required' });
    const name = { call_signal: 'incoming_call', call_answer: 'call_answered', call_end: 'call_ended', ice_candidate: 'ice_candidate' }[event];
    await publish(name, { from: userId, signal: data.signal, type: call.call_type, candidate: data.candidate, callId }, [to]);
  } else {
    return res.status(400).json({ error: 'Unsupported event' });
  }
  // Retention bounded on every publish; no external scheduled worker required.
  await query("DELETE FROM realtime_events WHERE created_at < now() - interval '1 day'");
  res.json({ accepted: true });
});
export default router;
