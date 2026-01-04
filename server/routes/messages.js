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
    cb(null, 'message-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  },
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Send message
router.post('/', authenticate, upload.single('attachment'), (req, res) => {
  try {
    const { receiverId, content, messageType, replyToMessageId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver ID required' });
    }

    // Convert receiverId to number
    const receiverIdNum = parseInt(receiverId, 10);
    if (isNaN(receiverIdNum)) {
      return res.status(400).json({ error: 'Invalid receiver ID' });
    }

    // Allow empty content if there's a file attachment
    if ((!content || content.trim() === '') && !req.file) {
      return res.status(400).json({ error: 'Content or attachment required' });
    }

    const messageTypeValue = messageType || (req.file ? (req.file.mimetype.startsWith('image/') ? 'image' : req.file.mimetype.startsWith('audio/') ? 'voice' : 'document') : 'text');
    const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const attachmentName = req.file ? req.file.originalname : null;

    const replyToId = replyToMessageId ? parseInt(replyToMessageId, 10) : null;
    
    // Use empty string instead of null for content if it's an attachment-only message
    // This handles cases where the content column might be NOT NULL
    const messageContent = content || (req.file ? '' : null);

    const result = db.prepare(`
      INSERT INTO messages (sender_id, receiver_id, content, message_type, attachment_url, attachment_name, reply_to_message_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id, 
      receiverIdNum, 
      messageContent, 
      messageTypeValue,
      attachmentUrl,
      attachmentName,
      replyToId
    );

    if (!result.lastInsertRowid) {
      return res.status(500).json({ error: 'Failed to create message' });
    }

    const message = db.prepare(`
      SELECT m.*, 
             u.first_name || ' ' || u.last_name as sender_name,
             u.profile_image as sender_image
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

    if (!message) {
      return res.status(500).json({ error: 'Failed to retrieve created message' });
    }

    res.status(201).json({ message: 'Message sent', messageData: message });
  } catch (error) {
    console.error('Send message error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

// Get conversations
router.get('/conversations', authenticate, (req, res) => {
  try {
    // Get all unique conversation partners
    const partners = db.prepare(`
      SELECT DISTINCT
        CASE 
          WHEN sender_id = ? THEN receiver_id
          ELSE sender_id
        END as other_user_id
      FROM messages
      WHERE sender_id = ? OR receiver_id = ?
    `).all(req.user.id, req.user.id, req.user.id);

    // Build conversations with details
    const conversations = partners.map(partner => {
      const otherUserId = partner.other_user_id;
      
      // Get user details
      const user = db.prepare(`
        SELECT id, first_name, last_name, profile_image
        FROM users
        WHERE id = ?
      `).get(otherUserId);

      // Get last message
      const lastMessage = db.prepare(`
        SELECT content, message_type, created_at
        FROM messages
        WHERE (sender_id = ? AND receiver_id = ?) 
           OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at DESC
        LIMIT 1
      `).get(req.user.id, otherUserId, otherUserId, req.user.id);

      // Get unread count
      const unreadCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM messages
        WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
      `).get(req.user.id, otherUserId);

      return {
        other_user_id: otherUserId,
        other_user_name: `${user.first_name} ${user.last_name}`,
        other_user_image: user.profile_image,
        last_message: lastMessage ? (lastMessage.message_type === 'image' ? '📷 Image' : 
                                     lastMessage.message_type === 'document' ? '📄 Document' :
                                     lastMessage.message_type === 'voice' ? '🎤 Voice message' :
                                     lastMessage.content) : null,
        last_message_time: lastMessage ? lastMessage.created_at : null,
        unread_count: unreadCount.count || 0,
      };
    });

    // Sort by last message time
    conversations.sort((a, b) => {
      if (!a.last_message_time) return 1;
      if (!b.last_message_time) return -1;
      return new Date(b.last_message_time) - new Date(a.last_message_time);
    });

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get messages with a specific user
router.get('/:userId', authenticate, (req, res) => {
  try {
    const messages = db.prepare(`
      SELECT m.*, 
             u.first_name || ' ' || u.last_name as sender_name,
             u.profile_image as sender_image,
             rm.content as reply_to_content,
             rm.message_type as reply_to_type,
             ru.first_name || ' ' || ru.last_name as reply_to_sender_name
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      LEFT JOIN messages rm ON m.reply_to_message_id = rm.id
      LEFT JOIN users ru ON rm.sender_id = ru.id
      WHERE (m.sender_id = ? AND m.receiver_id = ?) 
         OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.created_at ASC
    `).all(req.user.id, req.params.userId, req.params.userId, req.user.id);

    // Get reactions for messages
    const messageIds = messages.map(m => m.id);
    if (messageIds.length > 0) {
      try {
        const reactions = db.prepare(`
          SELECT mr.*, 
                 u.first_name || ' ' || u.last_name as user_name
          FROM message_reactions mr
          INNER JOIN users u ON mr.user_id = u.id
          WHERE mr.message_id IN (${messageIds.map(() => '?').join(',')})
        `).all(...messageIds);

        // Attach reactions to messages
        messages.forEach(msg => {
          msg.reactions = reactions.filter(r => r.message_id === msg.id);
        });
      } catch (reactionError) {
        console.error('Error fetching reactions:', reactionError);
        // Continue without reactions if there's an error
        messages.forEach(msg => {
          msg.reactions = [];
        });
      }
    } else {
      // Ensure all messages have reactions array
      messages.forEach(msg => {
        msg.reactions = [];
      });
    }

    // Mark as read
    try {
      db.prepare(`
        UPDATE messages 
        SET is_read = 1 
        WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
      `).run(req.user.id, req.params.userId);
    } catch (updateError) {
      console.error('Error marking messages as read:', updateError);
      // Continue even if marking as read fails
    }

    res.json({ messages: messages || [] });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Add reaction to message
router.post('/:messageId/reaction', authenticate, (req, res) => {
  try {
    const { reaction } = req.body;
    const validReactions = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'];
    
    if (!validReactions.includes(reaction)) {
      return res.status(400).json({ error: 'Invalid reaction' });
    }

    // Check if already reacted
    const existing = db.prepare('SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ?')
      .get(req.params.messageId, req.user.id);

    if (existing) {
      // Update reaction
      db.prepare('UPDATE message_reactions SET reaction = ? WHERE message_id = ? AND user_id = ?')
        .run(reaction, req.params.messageId, req.user.id);
    } else {
      // Add reaction
      db.prepare('INSERT INTO message_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)')
        .run(req.params.messageId, req.user.id, reaction);
    }

    res.json({ message: 'Reaction added' });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove reaction from message
router.delete('/:messageId/reaction', authenticate, (req, res) => {
  try {
    db.prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?')
      .run(req.params.messageId, req.user.id);
    res.json({ message: 'Reaction removed' });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

