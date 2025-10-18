require('dotenv').config();
const express = require('express');
const axios = require('axios');
const CircuitBreaker = require('opossum');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const winston = require('winston');

const app = express();
app.use(express.json());

// Logger setup
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'gateway.log' })
  ]
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Service endpoints
const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  user: process.env.USER_SERVICE_URL || 'http://localhost:3002',
  post: process.env.POST_SERVICE_URL || 'http://localhost:3003',
  feed: process.env.FEED_SERVICE_URL || 'http://localhost:3004',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
  chat: process.env.CHAT_SERVICE_URL || 'http://localhost:3006',
  job: process.env.JOB_SERVICE_URL || 'http://localhost:3007',
  search: process.env.SEARCH_SERVICE_URL || 'http://localhost:3008',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3009',
  admin: process.env.ADMIN_SERVICE_URL || 'http://localhost:3010'
};

// Circuit breaker function
const createCircuitBreaker = (serviceName) => {
  const options = {
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000
  };

  return new CircuitBreaker(async (url, method, data, headers) => {
    // Remove unsafe headers here inside the breaker
    const { host, connection, ...safeHeaders } = headers;

    const response = await axios({
      url,
      method,
      // headers: { ...safeHeaders, 'Content-Type': 'application/json' },
      data: data
    });

    return response.data;
  }, options);
};


const breakers = {};
Object.keys(services).forEach(service => {
  breakers[service] = createCircuitBreaker(service);
  
  breakers[service].fallback(() => ({
    error: `${service} service is currently unavailable`,
    fallback: true
  }));

  breakers[service].on('open', () => {
    logger.error(`Circuit breaker opened for ${service}`);
  });
});

// Proxy function
const proxyRequest = async (req, res, serviceName, path) => {
  try {
    const url = `${services[serviceName]}${path}`;
    const headers = { ...req.headers };

    logger.info(`Routing ${req.method} ${url}`);

    const result = await breakers[serviceName].fire(
      url,
      req.method,
      req.body,
      headers
    );

    res.json(result);
  } catch (error) {
    logger.error(`Error routing to ${serviceName}: ${error.message}`);
    res.status(error.response?.status || 500).json({
      error: error.message,
      service: serviceName
    });
  }
};

// Routes
app.post('/auth/register', (req, res) => proxyRequest(req, res, 'auth', '/register'));
app.post('/auth/login', (req, res) => proxyRequest(req, res, 'auth', '/login'));

app.use('/users', authenticateToken);
app.all('/users/*path', (req, res) => proxyRequest(req, res, 'user', req.path.replace('/users', '')));

app.use('/posts', authenticateToken);
app.all('/posts', (req, res) => proxyRequest(req, res, 'post', '/'));
app.all('/posts/*path', (req, res) => proxyRequest(req, res, 'post', req.path.replace('/posts', '')));

app.use('/feed', authenticateToken);
app.all('/feed/*path', (req, res) => proxyRequest(req, res, 'feed', req.path.replace('/feed', '')));

app.use('/notifications', authenticateToken);
app.all('/notifications/*path', (req, res) => proxyRequest(req, res, 'notification', req.path.replace('/notifications', '')));

app.use('/jobs', authenticateToken);
app.all('/jobs/*path', (req, res) => proxyRequest(req, res, 'job', req.path.replace('/jobs', '')));

app.use('/search', authenticateToken);
app.all('/search/*path', (req, res) => proxyRequest(req, res, 'search', req.path.replace('/search', '')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});
