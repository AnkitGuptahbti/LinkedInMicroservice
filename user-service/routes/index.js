
import express from 'express';

import controller from '../controllers/index.js';

const router = express.Router();

router.post('/profile', controller.createProfile);
router.post('/education', controller.createEducation);
router.post('/experience', controller.createExperience);

router.get('/user_list', controller.getUserList);

router.get('/profile', controller.getCurrentUserProfile);
router.get('/profile/:userId', controller.getSpecificUserProfile);

router.post('/follow/:targetUserId', controller.followUser);
router.post('/unfollow/:targetUserId', controller.unfollowUser);
router.get('/followers/:userId', controller.getFollowers);
router.get('/following/:userId', controller.getFollowing);

router.get('/connections', controller.getConnections);

export default router;