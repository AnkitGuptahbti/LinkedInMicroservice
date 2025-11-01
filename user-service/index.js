import 'dotenv/config';
import express from 'express';
import winston from 'winston';
import { setUserInfo } from './middlewares/setUserInfo.js';
import mongoose from 'mongoose';

import routes from './routes/index.js';
const app = express();
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI);

app.use(setUserInfo);

app.use('/', routes);

export const logger = winston.createLogger({
  transports: [new winston.transports.Console()]
});

app.get('/health', (req, res) => res.json({ status: 200, message: 'healthy' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  logger.info(`User Service running on port ${PORT}`);
});