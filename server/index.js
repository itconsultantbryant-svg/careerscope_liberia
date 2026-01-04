import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { initDatabase } from './db/init.js';
import jwt from 'jsonwebtoken';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import careerRoutes from './routes/careers.js';
import appointmentRoutes from './routes/appointments.js';
import postRoutes from './routes/posts.js';
import messageRoutes from './routes/messages.js';
import groupRoutes from './routes/groups.js';
import adminRoutes from './routes/admin.js';
import paymentRoutes from './routes/payments.js';
import quizRoutes from './routes/quiz.js';
import learningRoutes from './routes/learning.js';
import progressRoutes from './routes/progress.js';
import sessionRoutes from './routes/sessions.js';
import notificationRoutes from './routes/notifications.js';
import reportRoutes from './routes/reports.js';
import scheduleRoutes from './routes/schedules.js';
import callRoutes from './routes/calls.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

// CORS configuration
// In production, if CLIENT_URL is not set, we serve from same origin so no CORS needed
// Otherwise, use the specified CLIENT_URL
const getCorsOrigin = () => {
  if (process.env.NODE_ENV === 'production') {
    // In production, if serving from same origin, we can be more permissive
    // But it's better to set CLIENT_URL explicitly
    return process.env.CLIENT_URL || true; // true allows same origin
  }
  return process.env.CLIENT_URL || 'http://localhost:5173';
};

const corsOptions = {
  origin: getCorsOrigin(),
  credentials: true,
};

const io = new Server(httpServer, {
  cors: corsOptions,
});
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// Initialize database
initDatabase();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/careers', careerRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/calls', callRoutes);

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = join(__dirname, '../../client/dist');
  
  // Only serve static files if dist directory exists
  if (existsSync(clientPath)) {
    app.use(express.static(clientPath));
    
    // Handle React routing, return all requests to React app (except API routes)
    app.get('*', (req, res, next) => {
      // Don't serve React app for API routes
      if (req.path.startsWith('/api')) {
        return next();
      }
      const indexPath = join(clientPath, 'index.html');
      if (existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).json({ error: 'Client build not found. Please ensure the build completed successfully.' });
      }
    });
  } else {
    console.warn(`⚠️  Client build directory not found at ${clientPath}. Static files will not be served.`);
    // Fallback: return a helpful message for non-API routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.status(503).json({ 
        error: 'Client build not available',
        message: 'The frontend build was not found. Please check the build process.',
        apiHealth: '/api/health'
      });
    });
  }
}

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.cookie?.split('token=')[1]?.split(';')[0];
  
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    socket.userId = decoded.id;
    socket.userRole = decoded.role;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);

  // Join user's personal room
  socket.join(`user_${socket.userId}`);

  // Handle joining conversation room
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
  });

  // Handle leaving conversation room
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
  });

  // Handle new message
  socket.on('send_message', (data) => {
    const conversationId = [data.senderId, data.receiverId].sort().join('_');
    io.to(`conversation_${conversationId}`).emit('new_message', data);
    io.to(`user_${data.receiverId}`).emit('message_notification', data);
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    const conversationId = [data.senderId, data.receiverId].sort().join('_');
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      userId: socket.userId,
      isTyping: data.isTyping,
    });
  });

  // Handle post updates (community feed)
  socket.on('new_post', (post) => {
    io.emit('post_created', post);
  });

  socket.on('post_liked', (data) => {
    io.emit('post_like_update', data);
  });

  socket.on('new_comment', (data) => {
    io.emit('comment_added', data);
  });

  // Handle call signaling (WebRTC)
  socket.on('call_signal', (data) => {
    io.to(`user_${data.to}`).emit('incoming_call', {
      from: socket.userId,
      signal: data.signal,
      type: data.type, // 'voice' or 'video'
    });
  });

  socket.on('call_answer', (data) => {
    io.to(`user_${data.to}`).emit('call_answered', {
      from: socket.userId,
      signal: data.signal,
    });
  });

  socket.on('call_end', (data) => {
    io.to(`user_${data.to}`).emit('call_ended', {
      from: socket.userId,
    });
  });

  // Handle ICE candidates for WebRTC
  socket.on('ice_candidate', (data) => {
    io.to(`user_${data.to}`).emit('ice_candidate', {
      from: socket.userId,
      candidate: data.candidate,
    });
  });

  // Handle group call invitations
  socket.on('group_call_invite', (data) => {
    data.participants.forEach(participantId => {
      if (participantId !== socket.userId) {
        io.to(`user_${participantId}`).emit('group_call_invite', {
          from: socket.userId,
          participants: data.participants,
          type: data.type,
        });
      }
    });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CareerScope API is running' });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO server ready`);
});

