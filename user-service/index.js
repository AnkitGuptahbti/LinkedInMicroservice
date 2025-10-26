



import 'dotenv/config';
import express from 'express';
import winston from 'winston';
import Profile from './models/Profiles.js';

const app = express();
app.use(express.json());

const logger = winston.createLogger({
  transports: [new winston.transports.Console()]
});

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

app.get('/user_list', async (req, res) => {
  try {
    const users = await Profile.find()
    const formattedUsers = users.map(user => ({
      userId: user.userId,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      headline: user.headline || '',
      location: user.location || '',
      industry: user.industry || '',
      summary: user.summary || ''
    }));
    res.json(formattedUsers);
  } catch (error) {
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

app.get('/health', (req, res) => res.json({ status: 200, message: 'healthy' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  logger.info(`User Service running on port ${PORT}`);
});