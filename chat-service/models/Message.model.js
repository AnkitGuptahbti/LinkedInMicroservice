import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    senderId: { type: String, required: true },
    receiverId: { type: String, required: true },
    content: { type: String, required: true },
    read: { type: Boolean, default: false },
}, { timestamps: true });

messageSchema.index({ senderId: 1, receiverId: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;