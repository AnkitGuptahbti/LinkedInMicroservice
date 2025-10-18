const express = require('express');
const { Client } = require('@elastic/elasticsearch');
const { Kafka } = require('kafkajs');
const winston = require('winston');

const app = express();
app.use(express.json());

const logger = winston.createLogger({
  transports: [new winston.transports.Console()]
});

// Elasticsearch Client
const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200'
});

// Kafka Consumer
const kafka = new Kafka({
  clientId: 'search-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092']
});

const consumer = kafka.consumer({ groupId: 'search-group' });

const initKafka = async () => {
  await consumer.connect();
  await consumer.subscribe({ topics: ['post_created', 'job_posted', 'user_registered'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const data = JSON.parse(message.value.toString());
      await indexDocument(topic, data);
    }
  });

  logger.info('Search service Kafka consumer started');
};

// Index document in Elasticsearch
const indexDocument = async (topic, data) => {
  try {
    let index, document;

    switch (topic) {
      case 'post_created':
        index = 'posts';
        document = {
          postId: data.postId,
          userId: data.userId,
          content: data.content,
          createdAt: data.createdAt
        };
        break;

      case 'job_posted':
        index = 'jobs';
        document = data;
        break;

      case 'user_registered':
        index = 'users';
        document = data;
        break;
    }

    if (index && document) {
      await esClient.index({
        index,
        id: document.postId || document.jobId || document.userId,
        document
      });

      logger.info(`Indexed document in ${index}`);
    }
  } catch (error) {
    logger.error(`Error indexing document: ${error.message}`);
  }
};

// Create indices if they don't exist
const initIndices = async () => {
  const indices = ['posts', 'jobs', 'users'];

  for (const index of indices) {
    const exists = await esClient.indices.exists({ index });
    if (!exists) {
      await esClient.indices.create({ index });
      logger.info(`Created index: ${index}`);
    }
  }
};

// Search API
app.get('/search', async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    let indices;
    if (type === 'all') {
      indices = ['posts', 'jobs', 'users'];
    } else {
      indices = [type];
    }

    const result = await esClient.search({
      index: indices,
      body: {
        query: {
          multi_match: {
            query: q,
            fields: ['content', 'title', 'company', 'firstName', 'lastName', 'headline'],
            fuzziness: 'AUTO'
          }
        },
        size: 20
      }
    });

    const hits = result.hits.hits.map(hit => ({
      ...hit._source,
      score: hit._score,
      type: hit._index
    }));

    res.json({ results: hits, total: result.hits.total.value });
  } catch (error) {
    logger.error(`Search error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Search specific type
app.get('/search/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { q } = req.query;

    const result = await esClient.search({
      index: type,
      body: {
        query: {
          match: {
            _all: q
          }
        }
      }
    });

    res.json(result.hits.hits.map(hit => hit._source));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'healthy' }));

// Initialize
initIndices().then(() => {
  initKafka();
});

const PORT = process.env.PORT || 3008;
app.listen(PORT, () => {
  logger.info(`Search Service running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  await consumer.disconnect();
  process.exit(0);
});