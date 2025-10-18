



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

// Profile Schema
const profileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  headline: String,
  location: String,
  industry: String,
  summary: String,
  experience: [{
    title: String,
    company: String,
    startDate: Date,
    endDate: Date,
    description: String
  }],
  education: [{
    school: String,
    degree: String,
    field: String,
    startDate: Date,
    endDate: Date
  }],
  skills: [String],
  followers: [String],
  following: [String],
  connections: [String],
  createdAt: { type: Date, default: Date.now }
});

const Profile = mongoose.model('Profile', profileSchema);

// Create/Update Profile
app.post('/profile', async (req, res) => {
  try {
    const { userId, ...profileData } = req.body;

    const profile = await Profile.findOneAndUpdate(
      { userId },
      { userId, ...profileData },
      { upsert: true, new: true }
    );

    logger.info(`Profile updated for user: ${userId}`);
    res.json(profile);
  } catch (error) {
    logger.error(`Profile update error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get Profile
app.get('/profile/:userId', async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.params.userId });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Follow User
app.post('/follow', async (req, res) => {
  try {
    const { userId, targetUserId } = req.body;

    await Profile.findOneAndUpdate(
      { userId },
      { $addToSet: { following: targetUserId } }
    );

    await Profile.findOneAndUpdate(
      { userId: targetUserId },
      { $addToSet: { followers: userId } }
    );

    logger.info(`User ${userId} followed ${targetUserId}`);
    res.json({ message: 'Followed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unfollow User
app.post('/unfollow', async (req, res) => {
  try {
    const { userId, targetUserId } = req.body;

    await Profile.findOneAndUpdate(
      { userId },
      { $pull: { following: targetUserId } }
    );

    await Profile.findOneAndUpdate(
      { userId: targetUserId },
      { $pull: { followers: userId } }
    );

    res.json({ message: 'Unfollowed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Connections
app.get('/connections/:userId', async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.params.userId });
    const connections = await Profile.find({
      userId: { $in: profile.following }
    }).select('userId firstName lastName headline');

    res.json(connections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'healthy' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  logger.info(`User Service running on port ${PORT}`);
});