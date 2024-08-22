import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { SALT_ROUNDS } from '.config.mjs';
const { Schema } = mongoose;

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { 
    type: String, 
    required: function() { return this.isNew || this.isModified('password'); } 
  },
  subscriptionStatus: { type: String, default: 'inactive' },
  role: { type: String, default: 'user' },
  isAdmin: { type: Boolean, default: false },
  twitchUserId: { type: String },  // Added field for Twitch User ID
  twitchAccessToken: { type: String },  // Added field for Twitch Access Token
  twitchRefreshToken: { type: String },  // Added field for Twitch Refresh Token
  broadcasterId: { type: String },  // Added field for Twitch Broadcaster ID
  tokens: [{ 
    token: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: '1h' }  // Tokens expire in 1 hour
  }]
});

UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
      this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  }
  next();
});
UserSchema.statics.createUser = async function({ email, password, isAdmin = false, subscriptionStatus = 'inactive' }) {
  // Check if the email is already in use
  const existingUser = await this.findOne({ email });
  if (existingUser) {
      throw new Error('Email already in use');
  }

  // Create the new user (password will be hashed by pre-save middleware)
  const newUser = new this({
      email,
      password,  // No need to hash here
      isAdmin,
      subscriptionStatus
  });

  // Save the new user
  await newUser.save();
  return newUser;
};

UserSchema.statics.updateUser = async function (id, updates) {
  if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
      id = new mongoose.Types.ObjectId(id);
  } else if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid User ID');
  }

  // Password will be hashed by pre-save middleware if it is modified
  return this.findByIdAndUpdate(id, updates, { new: true });
};

// Utility function to validate ObjectId
UserSchema.statics.isValidObjectId = function (id) {
  return mongoose.Types.ObjectId.isValid(id);
};

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User;
