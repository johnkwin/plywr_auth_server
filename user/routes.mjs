import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import crypto from 'crypto';
import axios from 'axios';
import User from '../models/User.mjs';
import { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_BROADCASTER_ID } from '../config.mjs';

const router = express.Router();

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/user/login');
}

// OAuth Authorization Route
router.get('/oauth/authorize', (req, res) => {
    const clientId = TWITCH_CLIENT_ID;
    const redirectUri = encodeURIComponent('https://join-playware.com/user/oauth');
    const scope = encodeURIComponent('user:read:subscriptions channel:manage:polls channel:read:polls');
    const state = crypto.randomBytes(16).toString('hex');

    req.session.oauthState = state;

    const authUrl = `https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

    res.redirect(authUrl);
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

        // Get the Twitch user ID using the access token
        const userInfoResponse = await axios.get('https://api.twitch.tv/helix/users', {
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Client-Id': TWITCH_CLIENT_ID
            }
        });

        const twitchUserId = userInfoResponse.data.data[0].id;

        // Check if the user is subscribed to your Twitch channel
        let isSubscribed = false;
        try {
            const subscriptionResponse = await axios.get('https://api.twitch.tv/helix/subscriptions/user', {
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'Client-Id': TWITCH_CLIENT_ID
                },
                params: {
                    broadcaster_id: TWITCH_BROADCASTER_ID, // Use the broadcaster ID from your config
                    user_id: twitchUserId
                }
            });

            isSubscribed = subscriptionResponse.data.data.length > 0;
        } catch (err) {
            if (err.response && err.response.status === 404) {
                console.log('User is not subscribed.');
                isSubscribed = false; // Handle gracefully if the user is not subscribed
            } else {
                throw err; // For any other errors, rethrow the error
            }
        }

        // Update the user's subscription status based on their Twitch Prime subscription
        const user = await User.findById(req.session.userId);
        user.twitchUserId = twitchUserId; // Save the Twitch user ID
        user.twitchAccessToken = access_token;
        user.twitchRefreshToken = refresh_token;
        
        if (isSubscribed) {
            user.subscriptionStatus = 'active';
            await user.save();
            res.redirect('/user/dashboard');
        } else {
            user.subscriptionStatus = 'inactive';
            await user.save();
            res.redirect('/user/subscribe'); // Redirect to your site's subscription page
        }
    } catch (error) {
        console.error('Error during OAuth process:', error);
        res.status(500).json({ success: false, message: 'Failed to complete OAuth process' });
    }
});

// Check if the user is authorized and then direct to subscription or OAuth
router.get('/subscribe/check', isAuthenticated, async (req, res) => {
    const user = await User.findById(req.session.userId);

    if (!user.twitchAccessToken) {
        // If the user isn't authorized with Twitch, start the OAuth process
        const clientId = TWITCH_CLIENT_ID;
        const redirectUri = encodeURIComponent('https://join-playware.com/user/oauth');
        const scope = encodeURIComponent('user:read:subscriptions');
        const state = crypto.randomBytes(16).toString('hex');

        req.session.oauthState = state;

        const authUrl = `https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

        return res.redirect(authUrl);
    } else {
        // If the user is already authorized, check their subscription status
        try {
            const subscriptionResponse = await axios.get('https://api.twitch.tv/helix/subscriptions/user', {
                headers: {
                    'Authorization': `Bearer ${user.twitchAccessToken}`,
                    'Client-Id': TWITCH_CLIENT_ID
                },
                params: {
                    broadcaster_id: TWITCH_BROADCASTER_ID, // Use the broadcaster ID from your config
                    user_id: user.twitchUserId
                }
            });

            const isSubscribed = subscriptionResponse.data.data.length > 0;

            if (isSubscribed) {
                user.subscriptionStatus = 'active';
                await user.save();
                return res.redirect('/user/dashboard');
            } else {
                return res.redirect('/user/subscribe'); // Direct to the subscribe page if not subscribed
            }
        } catch (error) {
            console.error('Error checking subscription status:', error);
            return res.status(500).json({ success: false, message: 'Failed to check subscription status' });
        }
    }
});

// Subscribe Page
router.get('/subscribe', isAuthenticated, (req, res) => {
    const subscribeUrl = `https://twitch.tv/subs/YOUR_TWITCH_HANDLE`; // Replace with your channel's subscription URL
    res.render('user/subscribe', { subscribeUrl });
});

// Logout Route
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/user/login');
});

export default router;
