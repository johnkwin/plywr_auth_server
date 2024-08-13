import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import crypto from 'crypto';
import axios from 'axios';
import User from '../models/User.mjs';
import { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_HANDLE } from '../config.mjs';

const router = express.Router();

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/user/login');
}

// Utility function to get the broadcaster ID from the Twitch handle
async function getBroadcasterId(accessToken) {
    try {
        const response = await axios.get('https://api.twitch.tv/helix/users', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Client-Id': TWITCH_CLIENT_ID
            },
            params: {
                login: TWITCH_HANDLE
            }
        });

        return response.data.data[0].id;
    } catch (error) {
        console.error('Error getting broadcaster ID:', error);
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

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            req.flash('message', 'Email already in use');
            return res.redirect('/user/register');
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = new User({
            email,
            password: hashedPassword,
            isAdmin: false,
            subscriptionStatus: 'inactive'
        });

        await newUser.save();

        req.session.userId = newUser._id;
        res.redirect('/user/dashboard');
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});

router.get('/login', (req, res) => {
    res.render('user/login', { message: req.flash('message') });
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            req.flash('message', 'Invalid credentials');
            return res.redirect('/user/login');
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            req.session.userId = user._id;
            res.redirect('/user/dashboard');
        } else {
            req.flash('message', 'Invalid credentials');
            res.redirect('/user/login');
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
        console.error('Login error:', error);
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

router.get('/subscribe', isAuthenticated, (req, res) => {
    const subscribeUrl = `https://twitch.tv/subs/${TWITCH_HANDLE}`;
    res.render('user/subscribe', { subscribeUrl, message: req.flash('message') });
});

// OAuth Callback Route
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
        // Exchange the authorization code for an access token
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
        console.log('Access Token:', access_token);
        console.log('Refresh Token:', refresh_token);

        // Fetch user info from Twitch
        const userInfoResponse = await axios.get('https://api.twitch.tv/helix/users', {
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Client-Id': TWITCH_CLIENT_ID
            }
        });

        console.log('User Info Response:', userInfoResponse.data);
        const twitchUserId = userInfoResponse.data.data[0].id;

        // Fetch broadcaster ID
        const broadcasterId = await getBroadcasterId(access_token);
        console.log('Broadcaster ID:', broadcasterId);

        // Check if the user is subscribed to the broadcaster
        const subscriptionResponse = await axios.get('https://api.twitch.tv/helix/subscriptions/user', {
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Client-Id': TWITCH_CLIENT_ID
            },
            params: {
                broadcaster_id: broadcasterId,
                user_id: twitchUserId
            }
        });

        console.log('Subscription Response:', subscriptionResponse.data);
        const isSubscribed = subscriptionResponse.data.data.length > 0;

        const user = await User.findById(req.session.userId);
        user.twitchUserId = twitchUserId;
        user.twitchAccessToken = access_token;
        user.twitchRefreshToken = refresh_token;

        if (isSubscribed) {
            user.subscriptionStatus = 'active';
        } else {
            user.subscriptionStatus = 'inactive';
            req.flash('message', 'You are not subscribed to our Twitch channel. Please subscribe to gain full access.');
        }
        await user.save();
        res.redirect('/user/dashboard');
    } catch (error) {
        console.error('Error during OAuth process:', error);

        if (error.response) {
            console.error('Error Response Data:', error.response.data);
            console.error('Error Response Status:', error.response.status);
            console.error('Error Response Headers:', error.response.headers);
        }

        res.status(500).json({ success: false, message: 'Failed to complete OAuth process' });
    }
});

// Logout Route
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/user/login');
});

export default router;
