import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { query } from '../db/postgres.js';

// Neon-backed storage avoids the ephemeral Vercel filesystem. Small bounded
// attachments only; large media should use an object-storage provider.
export function createUpload(purpose) {
  const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: purpose === 'post' ? 4 : 1 }, fileFilter(req, file, cb) {
    const allowed = purpose === 'message'
      ? /^(image\/(jpeg|png|gif|webp)|audio\/(webm|mp4|mpeg|ogg)|application\/pdf|application\/octet-stream)$/.test(file.mimetype)
      : /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    if (!allowed) return cb(Object.assign(new Error('Unsupported file type'), { status: 400 }));
    cb(null, true);
  } });
  const wrap = (middleware) => (req, res, next) => middleware(req, res, async (error) => {
    if (error) return next(error);
    try {
      for (const file of req.files || (req.file ? [req.file] : [])) {
        file.filename = randomUUID();
        await query('INSERT INTO uploaded_files(filename, owner_id, purpose, mime_type, original_name, content) VALUES ($1,$2,$3,$4,$5,$6)', [file.filename, req.user.id, purpose, file.mimetype, file.originalname, file.buffer]);
      }
      next();
    } catch (err) { next(err); }
  });
  return { single: (field) => wrap(parser.single(field)), array: (field, count) => wrap(parser.array(field, Math.min(count, 4))) };
}

export async function serveUpload(req, res) {
  const file = (await query('SELECT * FROM uploaded_files WHERE filename = $1', [req.params.filename])).rows[0];
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (file.purpose === 'message') {
    if (!req.user) return res.status(401).json({ error: 'Sign in to view this attachment' });
    const member = req.user.id === file.owner_id || (await query('SELECT id FROM messages WHERE attachment_url = $1 AND (sender_id = $2 OR receiver_id = $2)', [`/uploads/${file.filename}`, req.user.id])).rowCount;
    if (!member) return res.status(403).json({ error: 'Forbidden' });
  }
  res.set({ 'Content-Type': file.mime_type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': file.purpose === 'message' ? 'private, no-store' : 'public, max-age=3600' });
  res.send(file.content);
}
