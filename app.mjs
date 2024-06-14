import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import session from 'express-session';
import bodyParser from 'body-parser';
import flash from 'connect-flash';
import cors from 'cors';
import helmet from 'helmet';
import adminRoutes from './admin/routes.mjs';
import { DB_USER, DB_PASSWORD, DB_NAME } from './config.mjs';

const stripe = Stripe('your-stripe-secret-key');
const app = express();

// Apply security headers
app.use(helmet());

// Enable CORS
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://join-playware.com',
      'http://localhost:3000'
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle preflight (OPTIONS) requests globally
app.options('*', cors());

// Parsing and session management
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));
app.use(flash());

// Static files and view engine
app.use(express.static(new URL('./public', import.meta.url).pathname));
app.set('view engine', 'ejs');
app.set('views', new URL('./views', import.meta.url).pathname);

// MongoDB connection
const dbURI = `mongodb://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@127.0.0.1:27017/${DB_NAME}`;
mongoose.connect(dbURI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    console.error('Error Details:', err);
  });

import User from './models/User.mjs';

// Routes
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
app.post('/check-subscription', async (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
  }
  
  try {
      const decoded = jwt.verify(token, 'PSh0JzhGxz6AC0yimgHVUXXVzvM3DGb5');
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActiveSubscription) {
          return res.status(401).json({ message: 'Subscription expired' });
      }
      res.json({ valid: true });
  } catch (error) {
      res.status(401).json({ message: 'Unauthorized' });
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
// Admin routes
app.use('/admin', adminRoutes);

app.listen(3000, '0.0.0.0', () => console.log('Server running on port 3000'));
