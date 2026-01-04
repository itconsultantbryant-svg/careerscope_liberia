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
    cb(null, 'post-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// Create post with multiple images support
router.post('/', authenticate, upload.array('images', 10), (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content required' });
    }

    // Handle single image (backward compatibility) or multiple images
    let imageUrl = null;
    const imageUrls = [];
    
    if (req.files && req.files.length > 0) {
      req.files.forEach((file, index) => {
        const url = `/uploads/${file.filename}`;
        imageUrls.push(url);
        if (index === 0) {
          imageUrl = url; // Keep first image for backward compatibility
        }
      });
    } else if (req.file) {
      // Single file upload (backward compatibility)
      imageUrl = `/uploads/${req.file.filename}`;
      imageUrls.push(imageUrl);
    }

    // Store images as JSON array for easy retrieval
    const imagesJson = imageUrls.length > 0 ? JSON.stringify(imageUrls) : null;

    const result = db.prepare(`
      INSERT INTO posts (user_id, content, image_url, images)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, content.trim(), imageUrl, imagesJson);

    const postId = result.lastInsertRowid;

    // Insert into post_images table for better querying
    if (imageUrls.length > 0) {
      const insertImage = db.prepare(`
        INSERT INTO post_images (post_id, image_url, image_order)
        VALUES (?, ?, ?)
      `);
      imageUrls.forEach((url, index) => {
        insertImage.run(postId, url, index);
      });
    }

    const post = db.prepare(`
      SELECT p.*, 
             u.first_name || ' ' || u.last_name as author_name,
             u.profile_image as author_image,
             u.school_name, u.grade_level
      FROM posts p
      INNER JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `).get(postId);

    // Get all images for this post
    const postImages = db.prepare(`
      SELECT image_url, image_order
      FROM post_images
      WHERE post_id = ?
      ORDER BY image_order ASC
    `).all(postId);

    const postWithImages = {
      ...post,
      images: postImages.map(img => img.image_url),
      image_url: post.image_url || (postImages.length > 0 ? postImages[0].image_url : null)
    };

    res.status(201).json({ message: 'Post created', post: postWithImages });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all posts (feed)
router.get('/', authenticate, (req, res) => {
  const posts = db.prepare(`
    SELECT p.*, 
           u.first_name || ' ' || u.last_name as author_name,
           u.profile_image as author_image,
           u.school_name, u.grade_level,
           (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
           (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
           EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
    FROM posts p
    INNER JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC
    LIMIT 50
  `).all(req.user.id);

  // Get images for each post
  const postsWithImages = posts.map(post => {
    // Try to get images from post_images table first
    const postImages = db.prepare(`
      SELECT image_url, image_order
      FROM post_images
      WHERE post_id = ?
      ORDER BY image_order ASC
    `).all(post.id);

    let images = [];
    if (postImages.length > 0) {
      images = postImages.map(img => img.image_url);
    } else if (post.images) {
      // Fallback to JSON column if post_images table is empty
      try {
        images = JSON.parse(post.images);
      } catch (e) {
        images = [];
      }
    } else if (post.image_url) {
      // Single image (backward compatibility)
      images = [post.image_url];
    }

    return {
      ...post,
      images: images,
      image_url: images.length > 0 ? images[0] : post.image_url
    };
  });

  res.json({ posts: postsWithImages });
});

// Like/Unlike post
router.post('/:id/like', authenticate, (req, res) => {
  try {
    const postId = req.params.id;

    // Check if already liked
    const existing = db.prepare('SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?').get(postId, req.user.id);

    if (existing) {
      // Unlike
      db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(postId, req.user.id);
      res.json({ message: 'Post unliked', liked: false });
    } else {
      // Like
      db.prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)').run(postId, req.user.id);
      res.json({ message: 'Post liked', liked: true });
    }
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Comment on post
router.post('/:id/comments', authenticate, (req, res) => {
  try {
    const { content, parentCommentId } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content required' });
    }

    // Check if parent_comment_id column exists, if not use null
    let parentId = null;
    if (parentCommentId) {
      try {
        parentId = parseInt(parentCommentId, 10);
        if (isNaN(parentId)) parentId = null;
      } catch (e) {
        parentId = null;
      }
    }

    const result = db.prepare(`
      INSERT INTO comments (post_id, user_id, content, parent_comment_id)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, req.user.id, content.trim(), parentId);

    if (!result.lastInsertRowid) {
      return res.status(500).json({ error: 'Failed to create comment' });
    }

    const comment = db.prepare(`
      SELECT c.*, 
             u.first_name || ' ' || u.last_name as author_name,
             u.profile_image as author_image,
             (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as likes_count,
             EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as is_liked
      FROM comments c
      INNER JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(req.user.id, result.lastInsertRowid);

    if (!comment) {
      return res.status(500).json({ error: 'Failed to retrieve created comment' });
    }

    res.status(201).json({ message: 'Comment added', comment });
  } catch (error) {
    console.error('Comment error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Get comments for post
router.get('/:id/comments', authenticate, (req, res) => {
  const comments = db.prepare(`
    SELECT c.*, 
           u.first_name || ' ' || u.last_name as author_name,
           u.profile_image as author_image,
           (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as likes_count,
           EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as is_liked
    FROM comments c
    INNER JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).all(req.user.id, req.params.id);

  // Organize comments into threads (parent comments with replies)
  const parentComments = comments.filter(c => !c.parent_comment_id);
  const replies = comments.filter(c => c.parent_comment_id);
  
  const organizedComments = parentComments.map(parent => ({
    ...parent,
    replies: replies.filter(r => r.parent_comment_id === parent.id),
  }));

  res.json({ comments: organizedComments });
});

// Like/Unlike comment
router.post('/comments/:commentId/like', authenticate, (req, res) => {
  try {
    const commentId = req.params.commentId;
    const existing = db.prepare('SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?')
      .get(commentId, req.user.id);

    if (existing) {
      db.prepare('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?')
        .run(commentId, req.user.id);
      res.json({ message: 'Comment unliked', liked: false });
    } else {
      db.prepare('INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)')
        .run(commentId, req.user.id);
      res.json({ message: 'Comment liked', liked: true });
    }
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

