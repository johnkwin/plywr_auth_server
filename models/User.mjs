const { Schema } = mongoose;

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  subscriptionStatus: { type: String, default: 'inactive' },
  role: { type: String, default: 'user' },
  isAdmin: { type: Boolean, default: false }
});

// Pre-save middleware for password hashing
UserSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User;
