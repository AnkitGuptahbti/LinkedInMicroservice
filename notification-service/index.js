require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Kafka } = require('kafkajs');
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

// Notification Schema
const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  fromUserId: String,
  postId: String,
  message: String,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);

// Store active socket connections
const userSockets = new Map();

// Socket.IO connection
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on('register', (userId) => {
    userSockets.set(userId, socket.id);
    logger.info(`User ${userId} registered with socket ${socket.id}`);
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        break;
      }
    }
  });
});

// Kafka Consumer
const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092']
});

const consumer = kafka.consumer({ groupId: 'notification-group' });

const initKafka = async () => {
  await consumer.connect();
  await consumer.subscribe({ 
    topics: ['post_liked', 'post_commented', 'user_followed', 'message_sent'],
    fromBeginning: false 
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const data = JSON.parse(message.value.toString());
      await handleNotificationEvent(topic, data);
    }
  });

  logger.info('Kafka consumer started');
};

// Handle notification events
const handleNotificationEvent = async (topic, data) => {
  try {
    let notification;

    switch (topic) {
      case 'post_liked':
        notification = new Notification({
          userId: data.postOwnerId,
          type: 'like',
          fromUserId: data.userId,
          postId: data.postId,
          message: 'liked your post'
        });
        break;

      case 'post_commented':
        notification = new Notification({
          userId: data.postOwnerId,
          type: 'comment',
          fromUserId: data.userId,
          postId: data.postId,
          message: 'commented on your post'
        });
        break;

      case 'user_followed':
        notification = new Notification({
          userId: data.targetUserId,
          type: 'follow',
          fromUserId: data.userId,
          message: 'started following you'
        });
        break;

      case 'message_sent':
        notification = new Notification({
          userId: data.receiverId,
          type: 'message',
          fromUserId: data.senderId,
          message: 'sent you a message'
        });
        break;
    }

    if (notification) {
      await notification.save();

      // Send real-time notification via Socket.IO
      const socketId = userSockets.get(notification.userId);
      if (socketId) {
        io.to(socketId).emit('notification', notification);
        logger.info(`Real-time notification sent to user: ${notification.userId}`);
      }
    }
  } catch (error) {
    logger.error(`Error handling notification: ${error.message}`);
  }
};

//health check
app.get('/health', (req, res) => res.json({ status: 'healthy' }));

// Get user notifications
app.get('/:userId', async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark as read
app.put('/:notificationId/read', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.notificationId, { read: true });
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

initKafka();

const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  logger.info(`Notification Service running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  await consumer.disconnect();
  process.exit(0);
});