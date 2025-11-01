import Notification from '../models/Notification.js';
import { userSockets, io } from '../index.js';
import winston from 'winston';

const logger = winston.createLogger({
  transports: [new winston.transports.Console()]
});

export const handleNotificationEvent = async (topic, data) => {
    try {
      let notification;
  
      switch (topic) {
        case 'post_liked':
          notification = new Notification({
            userId: data.postOwnerId,
            type: 'like',
            fromUserId: data.userId,
            postId: data.postId,
            message: 'liked your post'
          });
          break;
  
        case 'post_commented':
          notification = new Notification({
            userId: data.postOwnerId,
            type: 'comment',
            fromUserId: data.userId,
            postId: data.postId,
            message: 'commented on your post'
          });
          break;
  
        case 'user_followed':
          notification = new Notification({
            userId: data.targetUserId,
            type: 'follow',
            fromUserId: data.userId,
            message: 'started following you'
          });
          break;
  
        case 'message_sent':
          notification = new Notification({
            userId: data.receiverId,
            type: 'message',
            fromUserId: data.senderId,
            message: 'sent you a message'
          });
          break;
      }
  
      if (notification) {
        await notification.save();
  
        // Send real-time notification via Socket.IO
        const socketId = userSockets.get(notification.userId);
        if (socketId) {
          io.to(socketId).emit('notification', notification);
          logger.info(`Real-time notification sent to user: ${notification.userId}`);
        }
      }
    } catch (error) {
      logger.error(`Error handling notification: ${error.message}`);
    }
  };
  