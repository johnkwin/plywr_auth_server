import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import stripe from 'stripe';
import { DB_USER, DB_PASSWORD, DB_NAME } from './config.mjs';

const app = express();
app.use(express.json());

const dbURI = `mongodb://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@localhost:27017/${DB_NAME}`;

mongoose.connect(dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch(err => {
  console.error('Failed to connect to MongoDB:', err.message);
  console.error('Error Details:', err);
});

const UserSchema = new mongoose.Schema({
    email: String,
    password: String,
    subscriptionStatus: String,
});

const User = mongoose.model('User', UserSchema);

app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    res.send('User registered');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ userId: user._id }, 'your-secret-key');
        res.json({ token });
    } else {
        res.status(400).send('Invalid credentials');
    }
});

app.post('/subscribe', async (req, res) => {
    const { token, planId } = req.body;
    const customer = await stripe.customers.create({
        email: req.user.email,
        source: token,
    });
    const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ plan: planId }],
    });
    await User.findByIdAndUpdate(req.user._id, { subscriptionStatus: 'active' });
    res.send('Subscription successful');
});

app.listen(3000, () => console.log('Server running on port 3000'));
