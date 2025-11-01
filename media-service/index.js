import 'dotenv/config';
import express from 'express';

import { ERROR, SUCCESS } from './constants/error.js';
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, MAX_FILE_SIZE } from './constants/constant.js';
import rateLimit from 'express-rate-limit';
import { uploadHelperFunction, upload, uploadMultipleHelperFunction } from './helpers/uploadHelper.js';

const app = express();
const PORT = process.env.PORT || 3011;


// Rate limiting
const uploadLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    message: ERROR.ERROR_TOO_MANY_UPLOADS,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: MAX_FILE_SIZE,
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  limit: MAX_FILE_SIZE, 
  extended: true 
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check endpoint with detailed status
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: SUCCESS.HEALTHY,
  });
});

// Upload endpoint with rate limiting
app.post('/upload', uploadLimiter, upload.single('file'), uploadHelperFunction);

// Multiple file upload endpoint
app.post('/upload-multiple', uploadLimiter, upload.array('files', 5), uploadMultipleHelperFunction);

// Error handling middleware
app.use((error, req, res, next) => {
    console.log("----------UNHANDLED ERROR WHILE UPLOADING FILE----------", error);
    res.status(500).json({
        success: false,
        message: ERROR.INTERNAL_SERVER_ERROR,
    });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: ERROR.NOT_FOUND,
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log(SUCCESS.SHUTDOWN);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(SUCCESS.SHUTDOWN);
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Media service is running on port ${PORT}`);
});