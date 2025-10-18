



require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
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

// Job Schema
const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  location: String,
  type: { type: String, enum: ['full-time', 'part-time', 'contract', 'internship'] },
  description: String,
  requirements: [String],
  salary: String,
  postedBy: String,
  applications: [{
    userId: String,
    resume: String,
    coverLetter: String,
    status: { type: String, default: 'pending' },
    appliedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

const Job = mongoose.model('Job', jobSchema);

// Create Job
app.post('/', async (req, res) => {
  try {
    const job = new Job(req.body);
    await job.save();
    logger.info(`Job created: ${job._id}`);
    res.status(201).json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Jobs
app.get('/', async (req, res) => {
  try {
    const { location, type, search } = req.query;
    const query = {};

    if (location) query.location = new RegExp(location, 'i');
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { company: new RegExp(search, 'i') }
      ];
    }

    const jobs = await Job.find(query).sort({ createdAt: -1 }).limit(50);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Apply for Job
app.post('/:jobId/apply', async (req, res) => {
  try {
    const { userId, resume, coverLetter } = req.body;
    const job = await Job.findById(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const alreadyApplied = job.applications.some(app => app.userId === userId);
    if (alreadyApplied) {
      return res.status(400).json({ error: 'Already applied' });
    }

    job.applications.push({ userId, resume, coverLetter });
    await job.save();

    logger.info(`User ${userId} applied for job ${job._id}`);
    res.json({ message: 'Application submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'healthy' }));

const PORT = process.env.PORT || 3007;
app.listen(PORT, () => {
  logger.info(`Job Service running on port ${PORT}`);
});