// models/User.mjs
import mongoose from 'mongoose';

const { Schema } = mongoose;

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  subscriptionStatus: { type: String, default: 'inactive' },
  role: { type: String, default: 'user' } // Default role is 'user'
});

// Avoid model overwrite
const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User;