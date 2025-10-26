import 'dotenv/config';
import express from 'express';
import { Kafka } from 'kafkajs';
import { Server } from 'socket.io';
import http from 'http';
import winston from 'winston';
import Notification from './models/Notification.js';
import { handleNotificationEvent } from './helpers/notificationEventHelper.js';

const app = express();
const server = http.createServer(app);
export const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json());

const logger = winston.createLogger({
  transports: [new winston.transports.Console()]
});

// Store active socket connections
export const userSockets = new Map();

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

//health check
app.get('/health', (req, res) => res.status(200).json({ status: 200, message: 'healthy' }));

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