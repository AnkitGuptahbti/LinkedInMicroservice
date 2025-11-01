
import express from 'express';

import controller from '../controllers/index.js';

const router = express.Router();

router.post('/profile', controller.createProfile);

router.post('/education', controller.createEducation);

router.post('/experience', controller.createExperience);

router.get('/user_list', controller.getUserList);

router.get('/profile', controller.getCurrentUserProfile);

router.get('/profile/:userId', controller.getSpecificUserProfile);

router.post('/follow', controller.followUser);

router.post('/unfollow', controller.unfollowUser);

router.get('/connections', controller.getConnections);

router.get('/health', (req, res) => res.json({ status: 200, message: 'healthy' }));

export default router;