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
import connectMongo from 'connect-mongo';
import { setupWebSocket } from './websocket.mjs';
import adminRoutes from './admin/routes.mjs';
import userRoutes from './user/routes.mjs';
import User from './models/User.mjs';
import { DB_USER, DB_PASSWORD, DB_NAME } from './config.mjs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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

// Static files and view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
const dbURI = `mongodb://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@127.0.0.1:27017/${DB_NAME}`;
mongoose.connect(dbURI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    console.error('Error Details:', err);
  });

// Correct usage of connect-mongo
const MongoStore = connectMongo.create({
  mongoUrl: dbURI,
  collectionName: 'sessions'
});

// Session and Flash
app.use(session({
  secret: 'PSh0JzhGxz6AC0yimgHVUXXVzvM3DGb5',
  resave: false,
  saveUninitialized: false,
  store: MongoStore
}));
app.use(flash());

// Routes
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    res.json({ message: 'User registered' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
    console.error(error);
  }
});

// Twitch event routes
app.post('/twitch/events', express.json(), (req, res) => {
  if (req.headers['twitch-eventsub-message-type'] === 'webhook_callback_verification') {
      return res.status(200).send(req.body.challenge);
  }

  const messageId = req.headers['twitch-eventsub-message-id'];
  const timestamp = req.headers['twitch-eventsub-message-timestamp'];
  const signature = req.headers['twitch-eventsub-message-signature'];
  const hmacMessage = messageId + timestamp + JSON.stringify(req.body);
  const hmac = `sha256=${crypto.createHmac('sha256', TWITCH_EVENTSUB_SECRET).update(hmacMessage).digest('hex')}`;

  if (hmac !== signature) {
      return res.status(403).send('Forbidden');
  }

  const event = req.body.event;
  switch (req.body.subscription.type) {
      case 'channel.subscribe':
          console.log('New subscriber:', event.user_name);
          break;
      case 'channel.subscription.end':
          console.log('Subscription ended for:', event.user_name);
          break;
      default:
          console.log('Unhandled event type:', req.body.subscription.type);
  }

  res.status(200).send('OK');
});

const getAppAccessToken = async () => {
  const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
          client_id: TWITCH_CLIENT_ID,
          client_secret: TWITCH_CLIENT_SECRET,
          grant_type: 'client_credentials'
      },
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
      }
  });
  return response.data.access_token;
};

const ensureSubscriptions = async (accessToken, callbackUrl) => {
  const existingSubscriptions = await getExistingSubscriptions(accessToken);

  const requiredEvents = ['channel.subscribe', 'channel.subscription.end'];

  for (const event of requiredEvents) {
      const existingSub = existingSubscriptions.find(sub => sub.type === event && sub.condition.broadcaster_user_id === TWITCH_BROADCASTER_ID);

      if (!existingSub) {
          await subscribeToEventSub(accessToken, event, callbackUrl);
      } else {
          console.log(`${event} subscription already exists.`);
      }
  }
};

const subscribeToEventSub = async (accessToken, type, callbackUrl) => {
  try {
      const response = await axios.post('https://api.twitch.tv/helix/eventsub/subscriptions', {
          type: type,
          version: '1',
          condition: {
              broadcaster_user_id: TWITCH_BROADCASTER_ID
          },
          transport: {
              method: 'webhook',
              callback: callbackUrl,
              secret: TWITCH_EVENTSUB_SECRET
          }
      }, {
          headers: {
              'Client-Id': TWITCH_CLIENT_ID,
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
          }
      });
      console.log(`Subscribed to ${type} event: `, response.data);
  } catch (error) {
      console.error(`Error subscribing to ${type} event:`, error.response ? error.response.data : error.message);
  }
};

const getExistingSubscriptions = async (accessToken) => {
  try {
      const response = await axios.get('https://api.twitch.tv/helix/eventsub/subscriptions', {
          headers: {
              'Client-Id': TWITCH_CLIENT_ID,
              'Authorization': `Bearer ${accessToken}`,
          },
      });
      return response.data.data;
  } catch (error) {
      console.error('Error fetching existing subscriptions:', error);
      return [];
  }
};

const initializeEventHooks = async () => {
  try {
      const accessToken = await getAppAccessToken();
      const callbackUrl = 'https://join-playware.com/twitch/events';

      await ensureSubscriptions(accessToken, callbackUrl);

      console.log('Twitch EventSub subscriptions ensured.');
  } catch (error) {
      console.error('Error during app initialization:', error);
  }
};

// Add your other routes and middleware here

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(password, user.password)) {
      user.tokens = [];
      const token = jwt.sign({ userId: user._id }, 'PSh0JzhGxz6AC0yimgHVUXXVzvM3DGb5');
      user.tokens.push({ token });
      await user.save();
      res.json({ token });
    } else {
      res.status(400).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
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

app.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, 'PSh0JzhGxz6AC0yimgHVUXXVzvM3DGb5');
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'Invalid user' });
    }

    user.tokens = user.tokens.filter(t => t.token !== token);
    await user.save();

    res.json({ message: 'Logout successful' });
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
  }
});

app.get('/privacy', (req, res) => {
  res.sendFile(new URL('./views/privacy.html', import.meta.url).pathname);
});

app.use('/admin', adminRoutes);
app.use('/user', userRoutes);

initializeEventHooks();

// Start server
server.listen(3000, '0.0.0.0', () => console.log('Server running on port 3000'));
