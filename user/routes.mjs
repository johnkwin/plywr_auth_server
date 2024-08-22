import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import crypto from 'crypto';
import axios from 'axios';
import WebSocket from 'ws';
import User from '../models/User.mjs';
import { loadTokens, refreshAccessToken } from '../auth.mjs'; // Import the token handling functions
import { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_HANDLE, TWITCH_EVENTSUB_SECRET } from '../config.mjs';

const router = express.Router();
let ws;

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/user/login');
}
export const initializeWebSocketConnection = async () => {
    try {
        const wsUrl = 'wss://eventsub.wss.twitch.tv/ws';
        ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            console.log('WebSocket connection opened');
        });

        ws.on('message', (message) => {
            handleWebSocketMessage(message);
        });

        ws.on('close', () => {
            console.log('WebSocket connection closed, attempting to reconnect...');
            // Optionally, handle reconnect logic
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

    } catch (error) {
        console.error('Error initializing WebSocket connection:', error);
    }
};

// Handle WebSocket messages
const handleWebSocketMessage = async (message) => {
    const parsedMessage = JSON.parse(message);

    switch (parsedMessage.metadata.message_type) {
        case 'session_welcome':
            console.log('WebSocket session initialized:', parsedMessage);
            subscribeToEvents(parsedMessage.payload.session.id);
            break;
        case 'session_keepalive':
            //console.log('Received keepalive message'); Too spammy, Dont log.
            break;
        case 'notification':
            console.log('Received notification:', parsedMessage.payload.event);
            await handleSubscriptionNotification(parsedMessage);
            break;
        case 'session_reconnect':
            console.log('Reconnect required:', parsedMessage.payload.session.reconnect_url);
            await handleSessionReconnect(parsedMessage.payload.session.reconnect_url);
            break;
        case 'revocation':
            console.log('Subscription revoked:', parsedMessage.payload.subscription);
            await handleSubscriptionRevocation(parsedMessage);
            break;
        default:
            console.log('Unknown WebSocket message type:', parsedMessage.metadata.message_type);
    }
};
const handleSessionReconnect = async (reconnectUrl) => {
    try {
        // Reconnect to the new WebSocket URL
        const newWs = new WebSocket(reconnectUrl);

        newWs.on('open', () => {
            console.log('WebSocket reconnected to new URL.');
        });

        newWs.on('message', (message) => {
            handleWebSocketMessage(message);
        });

        newWs.on('close', () => {
            console.log('New WebSocket connection closed.');
        });

        newWs.on('error', (error) => {
            console.error('Error with new WebSocket connection:', error);
        });

        // Once the new connection is open, close the old WebSocket connection
        newWs.on('open', () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                console.log('Closing old WebSocket connection.');
                ws.close();
            }
            // Replace the old WebSocket connection with the new one
            ws = newWs;
        });

    } catch (error) {
        console.error('Error during WebSocket reconnection:', error);
    }
};
const handleSubscriptionRevocation = async (parsedMessage) => {
    const { subscription } = parsedMessage.payload;
    const broadcasterUserId = subscription.condition.broadcaster_user_id;

    try {
        const user = await User.findOne({ twitchUserId: broadcasterUserId });

        if (user) {
            // Check the revocation reason and log it
            switch (subscription.status) {
                case 'authorization_revoked':
                    console.log(`Authorization revoked for user: ${user.email}`);
                    break;
                case 'user_removed':
                    console.log(`User removed: ${user.email}`);
                    break;
                case 'version_removed':
                    console.log(`Subscription version no longer supported for user: ${user.email}`);
                    break;
                default:
                    console.log(`Unknown revocation reason for user: ${user.email}`);
            }

            // Update the user's subscription status to inactive
            user.subscriptionStatus = 'inactive';
            await user.save();

            console.log(`User ${user.email}'s subscription status set to inactive due to revocation.`);
        } else {
            console.log(`User not found for Twitch ID: ${broadcasterUserId}`);
        }
    } catch (error) {
        console.error('Error handling subscription revocation:', error);
    }
};
const handleSubscriptionNotification = async (parsedMessage) => {
    const { subscription_type, event } = parsedMessage.metadata;
    const userId = event.user_id;

    try {
        const user = await User.findOne({ twitchUserId: userId });

        if (user) {
            // If the event is a subscription or unsubscription, update the user's subscription status
            if (subscription_type === 'channel.subscribe') {
                user.subscriptionStatus = 'active';
                console.log(`User ${event.user_name} (ID: ${userId}) subscription status set to active.`);
            } else if (subscription_type === 'channel.subscription.end') {
                user.subscriptionStatus = 'inactive';
                console.log(`User ${event.user_name} (ID: ${userId}) subscription status set to inactive.`);
            }

            await user.save();
        } else {
            console.log(`User not found for Twitch ID: ${userId}`);
        }
    } catch (error) {
        console.error('Error handling subscription notification:', error);
    }
};
// Subscribe to events via WebSocket
const subscribeToEvents = async (sessionId) => {
    try {
        let tokens = loadTokens();
        if (!tokens || new Date() > new Date(tokens.obtained_at).getTime() + tokens.expires_in * 1000) {
            tokens = await refreshAccessToken();
        }

        const broadcasterId = await getBroadcasterId(tokens.access_token);
        const events = ['channel.subscribe', 'channel.subscription.end'];

        for (const event of events) {
            await subscribeToEventSub(tokens.access_token, event, broadcasterId, sessionId);
        }

        console.log('Subscribed to events via WebSocket.');
    } catch (error) {
        console.error('Error subscribing to events:', error);
    }
};

// Subscribe to a specific event using EventSub
const subscribeToEventSub = async (userAccessToken, type, broadcasterId, sessionId) => {
    const requestData = {
        type: type,
        version: '1',
        condition: {
            broadcaster_user_id: broadcasterId
        },
        transport: {
            method: 'websocket',
            session_id: sessionId
        }
    };

    const requestHeaders = {
        'Client-Id': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${userAccessToken}`, // Use the user access token here
        'Content-Type': 'application/json'
    };

    try {
        const response = await axios.post('https://api.twitch.tv/helix/eventsub/subscriptions', requestData, {
            headers: requestHeaders
        });
        console.log(`Subscribed to ${type} event: `, response.data);
    } catch (error) {
        console.error(`Error subscribing to ${type} event:`, error.response ? error.response.data : error.message);
    }
};
// Utility function to get the broadcaster ID from the Twitch handle
export async function getBroadcasterId(accessToken, isApp = false) {
    try {
        const params = isApp ? { login: TWITCH_HANDLE } : {};

        const response = await axios.get('https://api.twitch.tv/helix/users', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Client-Id': TWITCH_CLIENT_ID
            },
            params
        });

        return response.data.data[0].id;
    } catch (error) {
        console.error('Error getting broadcaster ID:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// User Registration Page
router.get('/register', (req, res) => {
    res.render('./user/register', { message: req.flash('message') });
});

router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            req.flash('message', 'Email and password are required');
            return res.redirect('/user/register');
        }

        const newUser = await User.createUser({ email, password });

        req.session.userId = newUser._id;
        res.redirect('/user/dashboard');
    } catch (error) {
        console.error('Error during registration:', error);
        req.flash('message', error.message);
        res.redirect('/user/register');
    }
});



router.get('/login', (req, res) => {
    res.render('user/login', { message: req.flash('message') });
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            req.flash('message', 'Email and password are required');
            return res.redirect('/user/login');
        }

        const user = await User.findOne({ email });

        if (!user) {
            console.log('User not found:', email);  // Log if user not found
            req.flash('message', 'Invalid credentials');
            return res.redirect('/user/login');
        }

        console.log('Stored hashed password:', user.password);  // Log stored hashed password

        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password comparison result:', isMatch);  // Log comparison result

        if (isMatch) {
            req.session.userId = user._id;
            res.redirect('/user/dashboard');
        } else {
            req.flash('message', 'Invalid credentials');
            res.redirect('/user/login');
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


router.get('/dashboard', isAuthenticated, async (req, res) => {
    const user = await User.findById(req.session.userId);
    res.render('user/dashboard', { user });
});

router.get('/oauth/authorize', (req, res) => {
    const clientId = TWITCH_CLIENT_ID;
    const redirectUri = encodeURIComponent('https://join-playware.com/user/oauth');
    const scope = encodeURIComponent('user:read:subscriptions channel:read:subscriptions');
    const state = crypto.randomBytes(16).toString('hex');

    req.session.oauthState = state;

    const authUrl = `https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

    res.redirect(authUrl);
});
// Check if the user is authorized and then direct to subscription or OAuth
router.get('/subscribe/check', isAuthenticated, async (req, res) => {
    const user = await User.findById(req.session.userId);

    if (!user.twitchAccessToken) {
        const clientId = TWITCH_CLIENT_ID;
        const redirectUri = encodeURIComponent('https://join-playware.com/user/oauth');
        const scope = encodeURIComponent('user:read:subscriptions');
        const state = crypto.randomBytes(16).toString('hex');

        req.session.oauthState = state;

        const authUrl = `https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

        return res.redirect(authUrl);
    } else {
        try {
            const broadcasterId = await getBroadcasterId(user.twitchAccessToken);
            const subscriptionResponse = await axios.get('https://api.twitch.tv/helix/subscriptions/user', {
                headers: {
                    'Authorization': `Bearer ${user.twitchAccessToken}`,
                    'Client-Id': TWITCH_CLIENT_ID
                },
                params: {
                    broadcaster_id: broadcasterId,
                    user_id: user.twitchUserId
                }
            });

            const isSubscribed = subscriptionResponse.data.data.length > 0;

            if (isSubscribed) {
                user.subscriptionStatus = 'active';
                await user.save();
                return res.redirect('/user/dashboard');
            } else {
                req.flash('message', 'You are not subscribed to our Twitch channel. Please subscribe to gain full access.');
                return res.redirect('/user/subscribe');
            }
        } catch (error) {
            if (error.response && error.response.status === 404) {
                req.flash('message', 'You are not subscribed to our Twitch channel. Please subscribe to gain full access.');
                return res.redirect('/user/subscribe');
            } else {
                console.error('Error checking subscription status:', error);
                return res.status(500).json({ success: false, message: 'Failed to check subscription status' });
            }
        }
    }
});
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
router.get('/subscribe', isAuthenticated, async (req, res) => {
    const user = await User.findById(req.session.userId);

    // If the user is already subscribed, redirect to the dashboard
    if (user.subscriptionStatus === 'active') {
        return res.redirect('/user/dashboard');
    }

    const subscribeUrl = `https://twitch.tv/subs/${TWITCH_HANDLE}`;
    res.render('user/subscribe', { subscribeUrl, user, TWITCH_HANDLE });
});

router.get('/check-subscription', isAuthenticated, async (req, res) => {
    const user = await User.findById(req.session.userId);

    if (!user.twitchAccessToken || !user.twitchUserId || !user.broadcasterId) {
        return res.status(400).json({ success: false, message: 'User is not properly authenticated with Twitch' });
    }

    try {
        const subscriptionResponse = await axios.get('https://api.twitch.tv/helix/subscriptions/user', {
            headers: {
                'Authorization': `Bearer ${user.twitchAccessToken}`,
                'Client-Id': TWITCH_CLIENT_ID
            },
            params: {
                broadcaster_id: user.broadcasterId,  // Correct broadcaster ID
                user_id: user.twitchUserId           // Correct user ID
            }
        });

        const isSubscribed = subscriptionResponse.data.data.length > 0;

        if (isSubscribed) {
            user.subscriptionStatus = 'active';
            await user.save();
            return res.json({ success: true });  // Return success if subscribed
        } else {
            user.subscriptionStatus = 'inactive';
            await user.save();
            return res.json({ success: false });  // Return failure if not subscribed
        }
    } catch (error) {
        if (error.response && error.response.status === 404) {
            // User is not subscribed, handle this as a normal case
            user.subscriptionStatus = 'inactive';
            await user.save();
            return res.json({ success: false });  // Return failure if not subscribed
        } else {
            console.error('Error checking subscription status:', error);
            return res.status(500).json({ success: false, message: 'Failed to check subscription status' });
        }
    }
});




router.get('/oauth', async (req, res) => {
    const { code, state } = req.query;

    if (state !== req.session.oauthState) {
        return res.status(400).json({ success: false, message: 'Invalid state parameter' });
    }

    req.session.oauthState = null;

    if (!code) {
        return res.status(400).json({ success: false, message: 'Authorization code is missing' });
    }

    try {
        const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: TWITCH_CLIENT_ID,
                client_secret: TWITCH_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: 'https://join-playware.com/user/oauth'
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token } = tokenResponse.data;

        const userInfoResponse = await axios.get('https://api.twitch.tv/helix/users', {
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Client-Id': TWITCH_CLIENT_ID
            }
        });

        const twitchUserId = userInfoResponse.data.data[0].id;

        const user = await User.findById(req.session.userId);
        user.twitchUserId = twitchUserId;
        user.twitchAccessToken = access_token;
        user.twitchRefreshToken = refresh_token;

        // Optionally, fetch and store the broadcaster ID
        const broadcasterId = await getBroadcasterId(access_token);
        user.broadcasterId = broadcasterId;
        const callbackUrl = 'https://join-playware.com/twitch/events';  // Replace with your callback URL
        const AppAccessToken = await getAppAccessToken();
        const channelBroadcasterId = await getBroadcasterId(AppAccessToken, true);
        await ensureSubscriptions(AppAccessToken, broadcasterId, callbackUrl);
        await user.save();

        res.redirect('/user/dashboard');
    } catch (error) {
        console.error('Error during OAuth process:', error);
        res.status(500).json({ success: false, message: 'Failed to complete OAuth process' });
    }
});
// Logout Route
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/user/login');
});

export default router;