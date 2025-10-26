import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;
const MONGO_CONFIG = {
    useNewUrlParser: true,
    useUnifiedTopology: true
};

console.log("-----------MONGO URI----------", MONGO_URI);

mongoose.connect(MONGO_URI, MONGO_CONFIG);

const notificationSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    type: { type: String, required: true, enum: ['like', 'comment', 'follow', 'message'] },
    fromUserId: { type: String, required: true },
    postId: { type: String, required: false },
    message: { type: String, required: false },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Notification', notificationSchema);