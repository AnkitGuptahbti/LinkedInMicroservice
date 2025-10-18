



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

// Admin Log Schema
const adminLogSchema = new mongoose.Schema({
  adminId: String,
  action: String,
  targetType: String,
  targetId: String,
  details: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now }
});

const AdminLog = mongoose.model('AdminLog', adminLogSchema);

// Report Schema
const reportSchema = new mongoose.Schema({
  reportedBy: String,
  reportedUser: String,
  reportedPost: String,
  reason: String,
  status: { type: String, default: 'pending' },
  resolvedBy: String,
  resolution: String,
  createdAt: { type: Date, default: Date.now }
});

const Report = mongoose.model('Report', reportSchema);

// Submit Report
app.post('/reports', async (req, res) => {
  try {
    const report = new Report(req.body);
    await report.save();
    logger.info(`Report created: ${report._id}`);
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Reports
app.get('/reports', async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const reports = await Report.find(query).sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve Report
app.put('/reports/:id/resolve', async (req, res) => {
  try {
    const { adminId, resolution } = req.body;
    
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      {
        status: 'resolved',
        resolvedBy: adminId,
        resolution
      },
      { new: true }
    );

    // Log admin action
    await new AdminLog({
      adminId,
      action: 'resolve_report',
      targetType: 'report',
      targetId: req.params.id,
      details: { resolution }
    }).save();

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Admin Logs
app.get('/logs', async (req, res) => {
  try {
    const { adminId, action } = req.query;
    const query = {};
    if (adminId) query.adminId = adminId;
    if (action) query.action = action;

    const logs = await AdminLog.find(query).sort({ timestamp: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// System Stats
app.get('/stats', async (req, res) => {
  try {
    const stats = {
      totalReports: await Report.countDocuments(),
      pendingReports: await Report.countDocuments({ status: 'pending' }),
      resolvedReports: await Report.countDocuments({ status: 'resolved' }),
      recentActions: await AdminLog.countDocuments({
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'healthy' }));

const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
  logger.info(`Admin Service running on port ${PORT}`);
});