import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import session from 'express-session';
import bodyParser from 'body-parser';
import flash from 'connect-flash';
import adminRoutes from './admin/routes.mjs'; // Ensure this path is correct
import { DB_USER, DB_PASSWORD, DB_NAME } from './config.mjs';

const stripe = Stripe('your-stripe-secret-key'); // Initialize Stripe with your secret key

const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));
app.use(flash());
app.use(express.static(new URL('./public', import.meta.url).pathname));
app.set('view engine', 'ejs');
app.set('views', new URL('./views', import.meta.url).pathname);

const dbURI = `mongodb://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@127.0.0.1:27017/${DB_NAME}`;

mongoose.connect(dbURI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    console.error('Error Details:', err);
  });

import User from './models/User.mjs'; // Importing User model from a single place

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
    const token = jwt.sign({ userId: user._id }, 'PSh0JzhGxz6AC0yimgHVUXXVzvM3DGb5');
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

// Use admin routes
app.use('/admin', adminRoutes);

app.listen(3000, '0.0.0.0', () => console.log('Server running on port 3000'));
