// models/User.mjs
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    subscriptionStatus: { type: String, default: 'inactive' },
    role: { type: String, default: 'user' } // Default role is 'user'
});

const User = mongoose.model('User', UserSchema);
export default User;
