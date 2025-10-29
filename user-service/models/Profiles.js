import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI);

const profileSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    firstName: String,
    lastName: String,
    profilePicture: String,
    headline: String,
    location: String,
    industry: String,
    summary: String,
    experience: [{
      title: String,
      company: String,
      startDate: Date,
      endDate: Date,
      description: String
    }],
    education: [{
      school: String,
      degree: String,
      field: String,
      startDate: Date,
      endDate: Date
    }],
    skills: [String],
    followers: [String],
    following: [String],
    connections: [String],
    createdAt: { type: Date, default: Date.now }
  });
  
  const Profile = mongoose.model('Profile', profileSchema);

  export default Profile;