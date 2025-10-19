require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Kafka } = require('kafkajs');
const winston = require('winston');

const app = express();
app.use(express.json());

const logger = winston.createLogger({
  transports: [new winston.transports.Console()]
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Analytics Schema
const analyticsSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  postId: String,
  eventType: { type: String, required: true },
  metadata: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now }
});

const Analytics = mongoose.model('Analytics', analyticsSchema);

// User Stats Schema
const userStatsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  profileViews: { type: Number, default: 0 },
  postImpressions: { type: Number, default: 0 },
  postLikes: { type: Number, default: 0 },
  postComments: { type: Number, default: 0 },
  postShares: { type: Number, default: 0 },
  followers: { type: Number, default: 0 },
  engagement: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

const UserStats = mongoose.model('UserStats', userStatsSchema);

// Kafka Consumer
const kafka = new Kafka({
  clientId: 'analytics-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092']
});

const consumer = kafka.consumer({ groupId: 'analytics-group' });

const initKafka = async () => {
  await consumer.connect();
  await consumer.subscribe({ 
    topics: ['post_created', 'post_liked', 'post_commented', 'post_viewed'],
    fromBeginning: false 
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const data = JSON.parse(message.value.toString());
      await processAnalyticsEvent(topic, data);
    }
  });

  logger.info('Analytics service Kafka consumer started');
};

// Process analytics events
const processAnalyticsEvent = async (topic, data) => {
  try {
    // Store raw event
    const event = new Analytics({
      userId: data.userId,
      postId: data.postId,
      eventType: topic,
      metadata: data
    });
    await event.save();

    // Update user stats
    const userId = data.postOwnerId || data.userId;
    const stats = await UserStats.findOne({ userId }) || new UserStats({ userId });

    switch (topic) {
      case 'post_created':
        // Post created, no immediate stat change
        break;

      case 'post_liked':
        stats.postLikes += 1;
        stats.engagement += 1;
        break;

      case 'post_commented':
        stats.postComments += 1;
        stats.engagement += 2; // Comments weigh more
        break;

      case 'post_viewed':
        stats.postImpressions += 1;
        break;
    }

    stats.lastUpdated = new Date();
    await stats.save();

    logger.info(`Analytics processed for user: ${userId}`);
  } catch (error) {
    logger.error(`Error processing analytics: ${error.message}`);
  }
};

// Get user stats
app.get('/stats/:userId', async (req, res) => {
  try {
    const stats = await UserStats.findOne({ userId: req.params.userId });
    if (!stats) {
      return res.json({ userId: req.params.userId, message: 'No stats available' });
    }
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get engagement trends
app.get('/trends/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const events = await Analytics.aggregate([
      {
        $match: {
          userId,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            eventType: '$eventType'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);

    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get top performing posts
app.get('/top-posts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const topPosts = await Analytics.aggregate([
      {
        $match: {
          userId,
          eventType: { $in: ['post_liked', 'post_commented', 'post_viewed'] }
        }
      },
      {
        $group: {
          _id: '$postId',
          likes: {
            $sum: { $cond: [{ $eq: ['$eventType', 'post_liked'] }, 1, 0] }
          },
          comments: {
            $sum: { $cond: [{ $eq: ['$eventType', 'post_commented'] }, 1, 0] }
          },
          views: {
            $sum: { $cond: [{ $eq: ['$eventType', 'post_viewed'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          engagement: { $add: ['$likes', { $multiply: ['$comments', 2] }] }
        }
      },
      {
        $sort: { engagement: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json(topPosts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'healthy' }));

initKafka();

const PORT = process.env.PORT || 3009;
app.listen(PORT, () => {
  logger.info(`Analytics Service running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  await consumer.disconnect();
  process.exit(0);
});