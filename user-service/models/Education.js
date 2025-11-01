import mongoose from 'mongoose';

const educationSchema = new mongoose.Schema({
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
    degree: { type: String, required: true },
    school: { type: String, required: true },
    fieldOfStudy: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: false },
    grade: { type: String, required: false },
    activitiesAndSocieties: { type: String, required: false },
    description: { type: String, required: false },
    skills: { type: [String], required: false },

}, { timestamps: true });

const Education = mongoose.model('Education', educationSchema);

export default Education;