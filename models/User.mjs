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
// Static method for conditional email update
UserSchema.statics.updateUser = async function (id, updates) {
  if (updates.password) {
    updates.password = await bcrypt.hash(updates.password, 10);
  }

  // Remove email from updates if it's not provided
  if (!updates.email) {
    delete updates.email;
  }

  // Validate id again to prevent invalid updates
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid User ID');
  }

  return this.findByIdAndUpdate(id, updates, { new: true });
};

// Utility function to validate ObjectId
UserSchema.statics.isValidObjectId = function (id) {
  return mongoose.Types.ObjectId.isValid(id);
};

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User;
