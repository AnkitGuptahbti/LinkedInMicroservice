import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import http from 'http';
import winston from 'winston';
import routes from './routes/route.js';
import Message from './models/Message.model.js';
import Conversation from './models/Conversation.model.js';
import { setUserInfo } from './middleware/auth.middleware.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json());

const logger = winston.createLogger({
  transports: [new winston.transports.Console()]
});

mongoose.connect(process.env.MONGO_URI);

// Store online users
const onlineUsers = new Map();

// Socket.IO
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on('register', (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.join(`user:${userId}`);
    
    // Broadcast online status
    socket.broadcast.emit('user_online', userId);
    logger.info(`User ${userId} is online`);
  });

  socket.on('send_message', async (data) => {
    try {
      const { senderId, receiverId, content } = data;

      // Save message
      const message = new Message({ senderId, receiverId, content });
      await message.save();

      // Update conversation
      const participants = [senderId, receiverId].sort();
      await Conversation.findOneAndUpdate(
        { participants },
        {
          participants,
          lastMessage: content,
          lastMessageAt: new Date()
        },
        { upsert: true }
      );

      // Send to receiver if online
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receive_message', message);
      }

      // Confirm to sender
      socket.emit('message_sent', message);

      logger.info(`Message sent from ${senderId} to ${receiverId}`);
    } catch (error) {
      logger.error(`Error sending message: ${error.message}`);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('typing', (data) => {
    const { senderId, receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_typing', senderId);
    }
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        socket.broadcast.emit('user_offline', userId);
        break;
      }
    }
  });
});

app.use(setUserInfo);
app.use('/', routes);

app.get('/health', (req, res) => res.json({ status: 200, message: "Chat Service is healthy" }));

const PORT = process.env.PORT || 3006;
server.listen(PORT, () => {
  logger.info(`Chat Service running on port ${PORT}`);
});