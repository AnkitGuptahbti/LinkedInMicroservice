import mongoose from 'mongoose';

const experienceSchema = new mongoose.Schema({
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
    company: { type: String, required: true },
    title: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    description: { type: String, required: true },
}, { timestamps: true });

const Experience = mongoose.model('Experience', experienceSchema);

export default Experience;