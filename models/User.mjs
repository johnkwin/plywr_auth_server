import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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

// Pre-save middleware for password hashing
UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});
userSchema.statics.createUser = async function({ email, password, isAdmin = false, subscriptionStatus = 'inactive' }) {
  // Check if the email is already in use
  const existingUser = await this.findOne({ email });
  if (existingUser) {
      throw new Error('Email already in use');
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create the new user
  const newUser = new this({
      email,
      password: hashedPassword,
      isAdmin,
      subscriptionStatus
  });

  // Save the new user
  await newUser.save();
  return newUser;
};
// Static method for conditional email update
UserSchema.statics.updateUser = async function (id, updates) {
  // Convert the id to a valid ObjectId if it's a valid string
  if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
    id = new mongoose.Types.ObjectId(id);
  } else if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid User ID');
  }

  if (updates.password) {
    updates.password = await bcrypt.hash(updates.password, 10);
  }

  // Remove email from updates if it's not provided
  if (!updates.email) {
    delete updates.email;
  }

  return this.findByIdAndUpdate(id, updates, { new: true });
};

// Utility function to validate ObjectId
UserSchema.statics.isValidObjectId = function (id) {
  return mongoose.Types.ObjectId.isValid(id);
};

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User;
