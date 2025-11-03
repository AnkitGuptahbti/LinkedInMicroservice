import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
    participants: [{ type: String, required: true }],
    lastMessage: String,
}, { timestamps: true });

conversationSchema.pre("save", function (next) {
    if (Array.isArray(this.participants)) {
      this.participants = [...new Set(this.participants.map(String))].sort();
    }
    next();
});

conversationSchema.index({ participants: 1 }, { unique: true });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;