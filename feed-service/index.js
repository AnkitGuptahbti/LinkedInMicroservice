const express = require('express');
const { Kafka } = require('kafkajs');
const redis = require('redis');
const axios = require('axios');
const winston = require('winston');

const app = express();
app.use(express.json());

const logger = winston.createLogger({
  transports: [new winston.transports.Console()]
});

// Redis Client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

redisClient.connect();

redisClient.on('error', (err) => logger.error('Redis error:', err));

// Kafka Consumer
const kafka = new Kafka({
  clientId: 'feed-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092']
});

const consumer = kafka.consumer({ groupId: 'feed-group' });

const initKafka = async () => {
  await consumer.connect();
  await consumer.subscribe({ topics: ['post_created', 'user_followed'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const data = JSON.parse(message.value.toString());
      
      if (topic === 'post_created') {
        await handlePostCreated(data);
      } else if (topic === 'user_followed') {
        await handleUserFollowed(data);
      }
    }
  });

  logger.info('Kafka consumer started');
};

// Handle post created event
const handlePostCreated = async (data) => {
  try {
    const { postId, userId } = data;
    
    // Get followers from user-service
    const response = await axios.get(`${process.env.USER_SERVICE_URL}/profile/${userId}`);
    const followers = response.data.followers || [];

    // Add post to each follower's feed cache
    for (const followerId of followers) {
      const feedKey = `feed:${followerId}`;
      await redisClient.lPush(feedKey, JSON.stringify(data));
      await redisClient.lTrim(feedKey, 0, 99); // Keep last 100 posts
    }

    logger.info(`Post ${postId} added to ${followers.length} feeds`);
  } catch (error) {
    logger.error(`Error handling post created: ${error.message}`);
  }
};

// Handle user followed event
const handleUserFollowed = async (data) => {
  const { userId, targetUserId } = data;
  
  // Invalidate feed cache
  await redisClient.del(`feed:${userId}`);
  logger.info(`Feed cache invalidated for user: ${userId}`);
};

app.get('/health', (req, res) => res.json({ status: 200, message: 'healthy' }));

// Get User Feed
app.get('/:userId', async (req, res) => {
  try {
    const feedKey = `feed:${req.params.userId}`;
    
    // Check cache
    const cachedFeed = await redisClient.lRange(feedKey, 0, 19);
    
    if (cachedFeed && cachedFeed.length > 0) {
      logger.info(`Feed served from cache for user: ${req.params.userId}`);
      const feed = cachedFeed.map(item => JSON.parse(item));
      return res.json({ source: 'cache', feed });
    }

    // Build feed from database
    const response = await axios.get(`${process.env.USER_SERVICE_URL}/following/${req.params.userId}`);
    const following = response.data || [];

    const posts = [];
    for (const userId of following.slice(0, 10)) {
      const postsResponse = await axios.get(`${process.env.POST_SERVICE_URL}/user/${userId}`);
      posts.push(...postsResponse.data);
    }

    // Sort by date
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Cache the feed
    const topPosts = posts.slice(0, 20);
    for (const post of topPosts) {
      await redisClient.lPush(feedKey, JSON.stringify(post));
    }
    await redisClient.expire(feedKey, 3600); // 1 hour TTL

    res.json({ source: 'database', feed: topPosts });
  } catch (error) {
    // logger.error(`Feed error: ${error.message}`);
    logger.error('Feed error', {
      message: error.message,
      url: error.config?.url,
      method: error.config?.method,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
      stack: error.stack
    });
    res.status(500).json({ error: error.message });
  }
});

initKafka();

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  logger.info(`Feed Service running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  await consumer.disconnect();
  await redisClient.quit();
  process.exit(0);
});