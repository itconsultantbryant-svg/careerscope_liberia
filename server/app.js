import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pool } from './db/postgres.js';
import { optionalAuth } from './middleware/pg-auth.js';
import { serveUpload } from './services/uploads.js';
import realtime from './routes/realtime.js';
import { planner, appointments, schedules } from './features/planner.js';
import classrooms from './features/classrooms.js';
import archive from './features/archive.js';
import billing from './features/billing.js';
import management from './features/management.js';
import ai from './features/ai.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CLIENT_URL || false, credentials: true }));
app.use(express.json({ limit: '256kb' }), cookieParser());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  const origin = req.headers.origin;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin) {
    const sameOrigin = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers.host}`;
    if (origin !== sameOrigin && origin !== process.env.CLIENT_URL) return res.status(403).json({ error: 'Untrusted request origin' });
  }
  if (Number(req.headers['content-length'] || 0) > 4 * 1024 * 1024) return res.status(413).json({ error: 'Uploads must total less than 4 MB per request' });
  next();
});

app.get('/api/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'postgresql', realtime: 'authenticated-neon-event-stream' });
});
app.get('/uploads/:filename', optionalAuth, serveUpload);
app.use('/api/realtime', realtime);
app.use('/api/planner', planner);
app.use('/api/classrooms', classrooms);
app.use('/api/archive', archive);
app.use('/api/billing', billing);
app.use('/api/management', management);
app.use('/api/ai-counselors', ai);
app.use('/api/appointments', appointments);
app.use('/api/schedules', schedules);
for (const name of ['auth', 'users', 'careers', 'appointments', 'posts', 'messages', 'groups', 'admin', 'payments', 'quiz', 'learning', 'progress', 'sessions', 'notifications', 'reports', 'schedules', 'calls', 'billing']) {
  const routes = await import(`./generated/${name}.js`);
  app.use(`/api/${name}`, routes.default);
}
app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('API request failed:', error.code || error.name);
  const status = error.code === '23505' ? 409 : error.code === '23503' ? 400 : error.name === 'MulterError' ? 413 : error.status || 500;
  res.status(status).json({ error: status === 500 ? 'Unable to process request. Please try again.' : error.code === '23505' ? 'This record already exists' : error.message });
});
export default app;
