import service from '../services/index.js';

const controller = {}

controller.createProfile = async (req, res) => {
  try {
      const userId = req.user.userId;
      const profileData = req.body;
      const response = await service.createProfile(profileData, userId);
      res.status(response.status).json(response.data);
    } catch (error) {
        console.log("----------ERROR WHILE CREATING PROFILE----------", error);
      res.status(response.status).json({ error: response.error });
    }
};

controller.createEducation = async (req, res) => {
  try {
    const educationData = req.body;
    const userId = req.user.userId;
    const response = await service.createEducation(educationData, userId);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.log("----------ERROR WHILE CREATING EDUCATION----------", error);
    res.status(response.status).json({ error: response.error });
  }
};

controller.createExperience = async (req, res) => {
  try {
    const experienceData = req.body;
    const userId = req.user.userId;
    const response = await service.createExperience(experienceData, userId);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.log("----------ERROR WHILE CREATING EXPERIENCE----------", error);
    res.status(response.status).json({ error: response.error });
  }
};

controller.getUserList = async (req, res) => {
  try {
    const userId = req.user.userId;
    const response = await service.getUserList(userId);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.log("----------ERROR WHILE GETTING USER LIST----------", error);
    res.status(response.status).json({ error: response.error });
  }
};

controller.getCurrentUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const response = await service.getCurrentUserProfile(userId);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.log("----------ERROR WHILE GETTING CURRENT USER PROFILE----------", error);
    res.status(response.status).json({ error: response.error });
  }
};

controller.getSpecificUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId;
    const response = await service.getSpecificUserProfile(userId);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.log("----------ERROR WHILE GETTING SPECIFIC USER PROFILE----------", error);
    res.status(response.status).json({ error: response.error });
  }
};

controller.followUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const targetUserId = req.params.targetUserId;
    const response = await service.followUser(userId, targetUserId);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.log("----------ERROR WHILE FOLLOWING USER----------", error);
    res.status(response.status).json({ error: response.error });
  }
};

controller.unfollowUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const targetUserId = req.params.targetUserId;
    const response = await service.unfollowUser(userId, targetUserId);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.log("----------ERROR WHILE UNFOLLOWING USER----------", error);
    res.status(response.status).json({ error: response.error });
  }
};

controller.getFollowers = async (req, res) => {
  try {
    const userId = req.params.userId;
    const response = await service.getFollowers(userId);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.log("----------ERROR WHILE GETTING FOLLOWERS----------", error);
    res.status(response.status).json({ error: response.error });
  }
};

controller.getFollowing = async (req, res) => {
  try {
    const userId = req.params.userId;
    const response = await service.getFollowing(userId);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.log("----------ERROR WHILE GETTING FOLLOWING----------", error);
    res.status(response.status).json({ error: response.error });
  }
};

controller.getFollowingProfile = async (req, res) => {
  try {
    const userId = req?.user?.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    const response = await service.getFollowingProfile(userId, page, limit);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.log("----------ERROR WHILE GETTING FOLLOWING PROFILE----------", error);
    res.status(response.status).json({ error: response.error });
  }
};

controller.getConnections = async (req, res) => {
  try {
    const userId = req.user.userId;
    const response = await service.getConnections(userId);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.log("----------ERROR WHILE GETTING CONNECTIONS----------", error);
    res.status(response.status).json({ error: response.error });
  }
};


export default controller;