import express from 'express';
import Message from '../models/Message.model.js';
import Conversation from '../models/Conversation.model.js';
import axios from 'axios';
const router = express.Router();

router.get('/messages', async (req, res) => {
    const messages = await Message.find();
    res.status(200).json({
        status: 200,
        data: messages,
        message: "Messages fetched successfully"
    })
})

router.get('/messages/:userId/:otherUserId', async (req, res) => {
    try {
        const { userId, otherUserId } = req.params;

        const messages = await Message.find({
            $or: [
                { senderId: userId, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: userId }
            ]
        }).sort({ createdAt: 1 }).limit(100);

        res.status(200).json({
            status: 200,
            data: messages,
            message: "Messages fetched successfully"
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "Failed to fetch messages",
            error: error.message
        });
    }
});

router.post('/conversation/create', async (req, res) => {
    console.log("---------------------1--------------------------------")
    try {
        const { participants } = req.body;
        console.log("---------------------2--------------------------------")
        if (!participants || !Array.isArray(participants)) {
            return res.status(400).json({
                status: 400,
                error: "Participants are required and should be an array",
                message: "Participants are required and should be an array"
            });
        }
        console.log("---------------------3--------------------------------")
        const userId = req.user.userId;
        console.log("---------------------4--------------------------------")
        participants.push(userId);
        console.log("---------------------5--------------------------------")
        let following = [];
        try {
            const profile = await axios.get(`${process.env.USER_SERVICE_URL}/following/${userId}`);
            console.log("---------------------7--------------------------------")
            following = profile.data;
        } catch (error) {
            console.log("---------------------8--------------------------------")
            return res.status(500).json({
                status: 500,
                error: "Failed to fetch followings to verify participants",
                message: "Failed to fetch followings to verify participants"
            });
        }
        console.log("---------------------6--------------------------------")
        if(!Array.isArray(following)) {
            console.log("---------------------9--------------------------------")
            return res.status(400).json({
                status: 400,
                error: "Following is not an array",
                message: "Following is not an array"
            });
        }

        console.log("---------------------10--------------------------------")
        const isFollowed = participants.every(participant => following.includes(participant));
        console.log("---------------------11--------------------------------")

        if (!isFollowed) {
            console.log("---------------------12--------------------------------")
            return res.status(400).json({
                status: 400,
                error: "User is not followed by all participants",
                message: "User is not followed by all participants"
            });
        }

        try {
            console.log("---------------------13--------------------------------")
            const conversation = new Conversation({ participants });
            await conversation.save();
            console.log("---------------------14--------------------------------")
            res.status(200).json({
                status: 200,
                data: conversation,
                message: "Conversation created successfully"
            });
        } catch (error) {
            console.log("-------------------ERROR IN SAVING CONVERSATION-----", error);
            console.log("---------------------15--------------------------------")
            res.status(400).json({
                status: 400,
                message: "Failed to create may be duplocate participants"
            });
        }
    } catch (error) {
        console.log("-------------------ERROR IN CREATE CONVERSATION-----", error);
        console.log("---------------------16--------------------------------")
        res.status(500).json({
            status: 500,
            message: error.message || error.errmsg || error.errorResponse.errmsg || "Failed to create conversation",
            error: error.message || error.errmsg || error.errorResponse.errmsg || "Failed to create conversation"
        });
    }
});

router.get('/conversation/:userId', async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: { $in: [req.params.userId] }
        }).sort({ updatedAt: -1 });

        res.status(200).json({
            status: 200,
            data: conversations,
            message: "Conversations fetched successfully"
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "Failed to fetch conversations",
            error: error.message
        });
    }
});

export default router;