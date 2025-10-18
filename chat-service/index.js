




require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const winston = require('winston');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json());

const logger = winston.createLogger({
  transports: [new winston.transports.Console()]
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Message Schema
const messageSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  content: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ senderId: 1, receiverId: 1 });

const Message = mongoose.model('Message', messageSchema);

// Conversation Schema
const conversationSchema = new mongoose.Schema({
  participants: [String],
  lastMessage: String,
  lastMessageAt: Date,
  createdAt: { type: Date, default: Date.now }
});

const Conversation = mongoose.model('Conversation', conversationSchema);

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

// REST API
app.get('/messages/:userId/:otherUserId', async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;
    
    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId }
      ]
    }).sort({ createdAt: 1 }).limit(100);

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/conversations/:userId', async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.params.userId
    }).sort({ lastMessageAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'healthy' }));

const PORT = process.env.PORT || 3006;
server.listen(PORT, () => {
  logger.info(`Chat Service running on port ${PORT}`);
});