



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

// Kafka Setup
const kafka = new Kafka({
  clientId: 'post-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092']
});

const producer = kafka.producer();

const initKafka = async () => {
  await producer.connect();
  logger.info('Kafka producer connected');
};

initKafka();

// Post Schema
const postSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  content: { type: String, required: true },
  imageUrl: String,
  likes: [String],
  comments: [{
    userId: String,
    content: String,
    createdAt: { type: Date, default: Date.now }
  }],
  shares: Number,
  impressions: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', postSchema);

// Create Post
app.post('/', async (req, res) => {
  try {
    const { userId, content, imageUrl } = req.body;

    const post = new Post({ userId, content, imageUrl, shares: 0 });
    await post.save();

    // Publish to Kafka
    await producer.send({
      topic: 'post_created',
      messages: [{
        value: JSON.stringify({
          postId: post._id,
          userId: post.userId,
          content: post.content,
          createdAt: post.createdAt
        })
      }]
    });

    logger.info(`Post created: ${post._id}`);
    res.status(201).json(post);
  } catch (error) {
    logger.error(`Create post error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});


// Health route first
app.get('/health', (req, res) => res.json({ status: 'healthy' }));


// Get Post
app.get('/:postId', async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Increment impressions
    post.impressions += 1;
    await post.save();

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Like Post
app.post('/:postId/like', async (req, res) => {
  try {
    const { userId } = req.body;
    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const alreadyLiked = post.likes.includes(userId);
    
    if (alreadyLiked) {
      post.likes = post.likes.filter(id => id !== userId);
    } else {
      post.likes.push(userId);
      
      // Publish like event
      await producer.send({
        topic: 'post_liked',
        messages: [{
          value: JSON.stringify({
            postId: post._id,
            userId,
            postOwnerId: post.userId,
            timestamp: new Date()
          })
        }]
      });
    }

    await post.save();
    res.json({ likes: post.likes.length, liked: !alreadyLiked });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Comment on Post
app.post('/:postId/comment', async (req, res) => {
  try {
    const { userId, content } = req.body;
    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    post.comments.push({ userId, content });
    await post.save();

    // Publish comment event
    await producer.send({
      topic: 'post_commented',
      messages: [{
        value: JSON.stringify({
          postId: post._id,
          userId,
          postOwnerId: post.userId,
          content,
          timestamp: new Date()
        })
      }]
    });

    logger.info(`Comment added to post: ${post._id}`);
    res.json(post.comments[post.comments.length - 1]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get User Posts
app.get('/user/:userId', async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'healthy' }));

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  logger.info(`Post Service running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  await producer.disconnect();
  process.exit(0);
});