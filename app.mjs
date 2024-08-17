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
import User from './models/User.mjs';
import userRoutes, { getBroadcasterId } from './user/routes.mjs';
import { DB_USER, DB_PASSWORD, DB_NAME, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_EVENTSUB_SECRET } from './config.mjs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const stripe = Stripe('your-stripe-secret-key');
const app = express();
const TWITCH_MESSAGE_ID = 'Twitch-Eventsub-Message-Id'.toLowerCase();
const TWITCH_MESSAGE_TIMESTAMP = 'Twitch-Eventsub-Message-Timestamp'.toLowerCase();
const TWITCH_MESSAGE_SIGNATURE = 'Twitch-Eventsub-Message-Signature'.toLowerCase();
const MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type'.toLowerCase();

const MESSAGE_TYPE_VERIFICATION = 'webhook_callback_verification';
const MESSAGE_TYPE_NOTIFICATION = 'notification';
const MESSAGE_TYPE_REVOCATION = 'revocation';

const HMAC_PREFIX = 'sha256=';
app.use(express.raw({ type: 'application/json' }));

// HTTPS server options
const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/join-playware.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/join-playware.com/fullchain.pem')
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
app.post('/twitch/events', (req, res) => {
  const secret = TWITCH_EVENTSUB_SECRET;  // Replace with your actual secret
  const message = getHmacMessage(req);
  const hmac = HMAC_PREFIX + getHmac(secret, message);

  if (verifyMessage(hmac, req.headers[TWITCH_MESSAGE_SIGNATURE])) {
      console.log("Signatures match");

      const notification = JSON.parse(req.body);

      if (MESSAGE_TYPE_NOTIFICATION === req.headers[MESSAGE_TYPE]) {
          console.log(`Event type: ${notification.subscription.type}`);
          console.log(JSON.stringify(notification.event, null, 4));
          res.sendStatus(204);
      } else if (MESSAGE_TYPE_VERIFICATION === req.headers[MESSAGE_TYPE]) {
          res.set('Content-Type', 'text/plain').status(200).send(notification.challenge);
      } else if (MESSAGE_TYPE_REVOCATION === req.headers[MESSAGE_TYPE]) {
          console.log(`${notification.subscription.type} notifications revoked!`);
          console.log(`reason: ${notification.subscription.status}`);
          console.log(`condition: ${JSON.stringify(notification.subscription.condition, null, 4)}`);
          res.sendStatus(204);
      } else {
          console.log(`Unknown message type: ${req.headers[MESSAGE_TYPE]}`);
          res.sendStatus(204);
      }
  } else {
      console.log('403 - Invalid Signature');
      res.sendStatus(403);
  }
});

function getHmacMessage(request) {
  return (request.headers[TWITCH_MESSAGE_ID] + 
          request.headers[TWITCH_MESSAGE_TIMESTAMP] + 
          request.body);
}

function getHmac(secret, message) {
  return crypto.createHmac('sha256', secret)
      .update(message)
      .digest('hex');
}

function verifyMessage(hmac, verifySignature) {
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(verifySignature));
}

const getAppAccessToken = async () => {
  const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
    params: {
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'channel:read:subscriptions'
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  return response.data.access_token;
};

const getExistingSubscriptions = async (accessToken) => {
  try {
    const response = await axios.get('https://api.twitch.tv/helix/eventsub/subscriptions', {
      headers: {
        'Client-Id': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching existing subscriptions:', error);
    return [];
  }
};

// Function to initialize Twitch EventSub subscriptions
const initializeEventHooks = async () => {
  try {
    const accessToken = await getAppAccessToken();
    const callbackUrl = 'https://join-playware.com/twitch/events';
    const broadcasterId = await getBroadcasterId(accessToken);

    await ensureSubscriptions(accessToken, broadcasterId, callbackUrl);

    console.log('Twitch EventSub subscriptions ensured.');
  } catch (error) {
    console.error('Error during app initialization:', error);
  }
};

// Function to subscribe to events
const ensureSubscriptions = async (accessToken, broadcasterId, callbackUrl) => {
  const existingSubscriptions = await getExistingSubscriptions(accessToken);

  const requiredEvents = ['channel.subscribe', 'channel.subscription.end'];

  for (const event of requiredEvents) {
    const existingSub = existingSubscriptions.find(sub => sub.type === event && sub.condition.broadcaster_user_id === broadcasterId);

    if (!existingSub) {
      await subscribeToEventSub(accessToken, event, broadcasterId, callbackUrl);
    } else {
      console.log(`${event} subscription already exists.`);
    }
  }
};

// Function to subscribe to EventSub
const subscribeToEventSub = async (accessToken, type, broadcasterId, callbackUrl) => {
  try {
      const response = await axios.post('https://api.twitch.tv/helix/eventsub/subscriptions', {
          type: type,
          version: '1',
          condition: {
              broadcaster_user_id: broadcasterId  // Use the broadcaster ID
          },
          transport: {
              method: 'webhook',
              callback: callbackUrl,  // Ensure this is passed correctly
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
      if (error.response) {
          console.error(`Error subscribing to ${type} event:`, {
              status: error.response.status,
              statusText: error.response.statusText,
              headers: error.response.headers,
              data: error.response.data
          });
      } else if (error.request) {
          console.error(`No response received for ${type} event subscription:`, error.request);
      } else {
          console.error(`Error setting up request for ${type} event:`, error.message);
      }
  }
};

// Other routes and middleware

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

// Initialize Twitch EventSub subscriptions
initializeEventHooks();

// Start server
server.listen(3000, '0.0.0.0', () => console.log('Server running on port 3000'));