import express from 'express';
import { db } from '../db/init.js';
import { authenticate } from '../middleware/auth.js';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'group-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  },
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Create group
router.post('/', authenticate, upload.single('image'), (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Group name required' });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const result = db.prepare(`
      INSERT INTO groups (name, description, creator_id, image_url)
      VALUES (?, ?, ?, ?)
    `).run(name.trim(), description || null, req.user.id, imageUrl);

    // Add creator as admin
    db.prepare(`
      INSERT INTO group_members (group_id, user_id, role)
      VALUES (?, ?, 'admin')
    `).run(result.lastInsertRowid, req.user.id);

    res.status(201).json({ message: 'Group created', groupId: result.lastInsertRowid });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all groups
router.get('/', authenticate, (req, res) => {
  const groups = db.prepare(`
    SELECT g.*, 
           u.first_name || ' ' || u.last_name as creator_name,
           (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
           EXISTS(SELECT 1 FROM group_members WHERE group_id = g.id AND user_id = ?) as is_member
    FROM groups g
    INNER JOIN users u ON g.creator_id = u.id
    ORDER BY g.created_at DESC
  `).all(req.user.id);

  res.json({ groups });
});

// Join group
router.post('/:id/join', authenticate, (req, res) => {
  try {
    db.prepare(`
      INSERT OR IGNORE INTO group_members (group_id, user_id)
      VALUES (?, ?)
    `).run(req.params.id, req.user.id);

    res.json({ message: 'Joined group' });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leave group
router.post('/:id/leave', authenticate, (req, res) => {
  db.prepare(`
    DELETE FROM group_members 
    WHERE group_id = ? AND user_id = ?
  `).run(req.params.id, req.user.id);

  res.json({ message: 'Left group' });
});

// Send group message
router.post('/:id/messages', authenticate, (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content required' });
    }

    // Check if user is member
    const isMember = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!isMember) {
      return res.status(403).json({ error: 'You must be a member to send messages' });
    }

    const result = db.prepare(`
      INSERT INTO group_messages (group_id, user_id, content)
      VALUES (?, ?, ?)
    `).run(req.params.id, req.user.id, content.trim());

    res.status(201).json({ message: 'Message sent', messageId: result.lastInsertRowid });
  } catch (error) {
    console.error('Send group message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get group messages
router.get('/:id/messages', authenticate, (req, res) => {
  // Check if user is member
  const isMember = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!isMember) {
    return res.status(403).json({ error: 'You must be a member to view messages' });
  }

  const messages = db.prepare(`
    SELECT gm.*, 
           u.first_name || ' ' || u.last_name as author_name,
           u.profile_image as author_image
    FROM group_messages gm
    INNER JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ?
    ORDER BY gm.created_at ASC
  `).all(req.params.id);

  res.json({ messages });
});

export default router;

