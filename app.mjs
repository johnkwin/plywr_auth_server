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
import fs from 'fs';
import https from 'https';
import path from 'path';
import { setupWebSocket } from './websocket.mjs';
import adminRoutes from './admin/routes.mjs';
import User from './models/User.mjs';
import { DB_USER, DB_PASSWORD, DB_NAME } from './config.mjs';

const stripe = Stripe('your-stripe-secret-key');
const app = express();

// HTTPS server options
const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/join-playware.com/privkey.pem'), // Update with your key path
  cert: fs.readFileSync('/etc/letsencrypt/live/join-playware.com/fullchain.pem') // Update with your cert path
};

// Create HTTPS server
const server = https.createServer(options, app);

// Setup WebSocket
setupWebSocket(server);

// Middleware for security
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      connectSrc: ["'self'", "https://join-playware.com"]
    }
  }
}));

// CORS configuration
const allowedOrigins = [
  'https://join-playware.com',
  'http://localhost:3000',
  'https://localhost:3000',
  'http://0.0.0.0:3000',
  'https://0.0.0.0:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    console.log('CORS request from:', origin);
    if (!origin || origin === 'null' || allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.options('*', cors());

// Body parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Express built-in middleware for JSON parsing (redundant with bodyParser, but good to keep if you plan to remove bodyParser later)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session and Flash
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));
app.use(flash());

// Static files and view engine
app.use(express.static(new URL('./public', import.meta.url).pathname));
app.set('view engine', 'ejs');
app.set('views', new URL('./views', import.meta.url).pathname);

// MongoDB connection
const dbURI = `mongodb://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@127.0.0.1:27017/${DB_NAME}`;
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    console.error('Error Details:', err);
  });

// Routes
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    res.json({ message: 'User registered' }); // Send JSON response
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
    console.error(error);
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    console.log(bcrypt.hash(password, 10));
    console.log(user.password);
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ userId: user._id }, 'PSh0JzhGxz6AC0yimgHVUXXVzvM3DGb5');
      console.log("password correct...");
      res.json({ token });
    } else {
      res.status(400).json({ message: 'Invalid credentials' }); // Send JSON response
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
    console.error(error);
  }
});

app.post('/check-subscription', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  try {
    const decoded = jwt.verify(token, 'PSh0JzhGxz6AC0yimgHVUXXVzvM3DGb5');
    const user = await User.findById(decoded.userId);
    if (!user || user.subscriptionStatus !== 'active') {
      return res.status(401).json({ message: 'Subscription expired' });
    }
    res.json({ valid: true });
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized' });
  }
});

app.post('/subscribe', async (req, res) => {
  const { token, planId } = req.body;
  try {
    const decoded = jwt.verify(req.headers.authorization.split(' ')[1], 'PSh0JzhGxz6AC0yimgHVUXXVzvM3DGb5');
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const customer = await stripe.customers.create({
      email: user.email,
      source: token,
    });
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ plan: planId }],
    });
    await User.findByIdAndUpdate(user._id, { subscriptionStatus: 'active' });
    res.json({ message: 'Subscription successful' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
    console.error(error);
  }
});
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, './views/privacy.html'));
});

app.use('/admin', adminRoutes);

// Start server
server.listen(3000, '0.0.0.0', () => console.log('Server running on port 3000'));
