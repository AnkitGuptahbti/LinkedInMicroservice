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
    skills: [String],
    followers: [String],
    following: [String],
    connections: [String],
}, { timestamps: true });
  
  const Profile = mongoose.model('Profile', profileSchema);

  export default Profile;