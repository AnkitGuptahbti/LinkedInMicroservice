import Profile from '../models/Profiles.js';
import Education from '../models/Education.js';
import Experience from '../models/Experience.js';
import { logger } from '../index.js';

const service = {}
// Create/Update Profile
service.createProfile = async (profileData, userId) => {
    try {
        const profile = await Profile.findOneAndUpdate(
            { userId },
            { userId, ...profileData },
            { upsert: true, new: true }
        );

        logger.info(`Profile updated for user: ${userId}`);
        return { status: 200, data: profile };
    } catch (error) {
        logger.error(`Profile update error: ${error.message}`);
        return { status: 500, error: error.message };
    }
};

service.createEducation = async (educationData, userId) => {
    try {
        const profile = await Profile.findOne({ userId: userId });
        if (!profile) {
            return {
                status: 404,
                error: 'Profile not found',
            }
        }
        const education = await Education.create({ profileId: profile._id, ...educationData });
        logger.info(`Education created for user: ${userId}`);
        return { status: 201, data: education };
    } catch (error) {
        logger.error(`Education creation error: ${error.message}`);
        return { status: 500, error: error.message };
    }
};

service.createExperience = async (experienceData, userId) => {
    try {
        const profile = await Profile.findOne({ userId: userId });
        if (!profile) {
            return { status: 404, error: 'Profile not found' };
        }
        const experience = await Experience.create({ profileId: profile._id, ...experienceData });
        logger.info(`Experience created for user: ${userId}`);
        return { status: 201, data: experience };
    } catch (error) {
        logger.error(`Experience creation error: ${error.message}`);
        return { status: 500, error: error.message };
    }
};

service.getUserList = async (userId) => {
    try {
        const users = await Profile.find( { _id: { $ne: userId } } ).select('userId firstName lastName headline location industry profilePicture');
        return { status: 200, data: users };
    } catch (error) {
        logger.error(`Error getting user list: ${error.message}`);
        return { status: 500, error: error.message };
    }
};

// Get Current User's Profile
service.getCurrentUserProfile = async (userId) => {
    try {
        const profile = await Profile.findOne({ userId: userId });
        if (!profile) {
            return { status: 404, error: 'Profile not found' };
        }
        const education = await Education.find({ profileId: profile._id });
        const experience = await Experience.find({ profileId: profile._id });
        return { status: 200, data: { profile, education, experience } };
    } catch (error) {
        logger.error(`Error getting current user profile: ${error.message}`);
        return { status: 500, error: error.message };
    }
};

// Get Specific User's Profile
service.getSpecificUserProfile = async (userId) => {
    try {
        const profile = await Profile.findOne({ userId: userId });
        if (!profile) {
            return { status: 404, error: 'Profile not found' };
        }
        return { status: 200, data: profile };
    } catch (error) {
        logger.error(`Error getting specific user profile: ${error.message}`);
        return { status: 500, error: error.message };
    }
};

// Follow User
service.followUser = async (userId, targetUserId) => {
    try {
        await Profile.findOneAndUpdate(
            { userId },
            { $addToSet: { following: targetUserId } }
        );

        await Profile.findOneAndUpdate(
            { userId: targetUserId },
            { $addToSet: { followers: userId } }
        );

        logger.info(`User ${userId} followed ${targetUserId}`);
        return { status: 200, data: { message: 'Followed successfully' } };
    } catch (error) {
        logger.error(`Error following user: ${error.message}`);
        return { status: 500, error: error.message };
    }
};

// Unfollow User
service.unfollowUser = async (userId, targetUserId) => {
    try {
        await Profile.findOneAndUpdate(
            { userId },
            { $pull: { following: targetUserId } }
        );

        await Profile.findOneAndUpdate(
            { userId: targetUserId },
            { $pull: { followers: userId } }
        );

        logger.info(`User ${userId} unfollowed ${targetUserId}`);
        return { status: 200, data: { message: 'Unfollowed successfully' } };
    } catch (error) {
        logger.error(`Error unfollowing user: ${error.message}`);
        return { status: 500, error: error.message };
    }
};

service.getFollowers = async (userId) => {
    try {
        const profile = await Profile.findOne({ userId: userId }).select('followers');
        if (!profile) {
            return { status: 404, error: 'Profile not found' };
        }
        return { status: 200, data: profile.followers };
    } catch (error) {
        logger.error(`Error getting followers: ${error.message}`);
        return { status: 500, error: error.message };
    }
};

service.getFollowing = async (userId) => {
    try {
        const profile = await Profile.findOne({ userId: userId }).select('following');
        if (!profile) {
            return { status: 404, error: 'Profile not found' };
        }
        return { status: 200, data: profile.following };
    } catch (error) {
        logger.error(`Error getting following: ${error.message}`);
        return { status: 500, error: error.message };
    }
};

service.getFollowingProfile = async (userId, page, limit) => {
    try {
        const profile = await Profile.findOne({ userId: userId }).select('following');
        if (!profile) {
            return { status: 404, error: 'Profile not found' };
        }

        const following = profile.following.filter(id => id !== userId);
        const followingProfiles = await Profile.find({ userId: { $in: following } }).skip((page - 1) * limit).limit(limit);
        return { 
            status: 200, 
            data: { 
                followingProfiles, 
                pagination: { total: following.length, page, limit } 
            } 
        };
    } catch (error) {
        logger.error(`Error getting following profile: ${error.message}`);
        return { status: 500, error: error.error };
    }
};

// Get Connections
service.getConnections = async (userId) => {
    try {
        const profile = await Profile.findOne({ userId: userId });
        if (!profile) {
            return { status: 404, error: 'Profile not found' };
        }
        const connections = await Profile.find({
            userId: { $in: profile.following }
        }).select('userId firstName lastName headline');

        return { status: 200, data: connections };
    } catch (error) {
        logger.error(`Error getting connections: ${error.message}`);
        return { status: 500, error: error.message };
    }
};

export default service;