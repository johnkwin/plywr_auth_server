import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } from './config.mjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const tokenStoragePath = path.join(__dirname, 'tokens.json');

// Load SSL/TLS certificates
const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/join-playware.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/join-playware.com/fullchain.pem')
};

// Step 1: Authorization Endpoint
app.get('/auth/twitch', (req, res) => {
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=https://join-playware.com/auth/twitch/callback&response_type=code&scope=channel:read:subscriptions`;
    res.redirect(authUrl);
});

// Step 2: OAuth Callback Endpoint
app.get('/auth/twitch/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).send('Missing authorization code.');
    }

    try {
        const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: TWITCH_CLIENT_ID,
                client_secret: TWITCH_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: 'https://join-playware.com/auth/twitch/callback',
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const tokens = tokenResponse.data;

        // Fetch broadcaster information using the access token
        const userInfoResponse = await axios.get('https://api.twitch.tv/helix/users', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Client-Id': TWITCH_CLIENT_ID,
            },
        });

        const broadcasterUserId = userInfoResponse.data.data[0].id;

        // Save the tokens and additional information in a JSON file
        const tokenData = {
            ...tokens,
            broadcaster_user_id: broadcasterUserId,
            obtained_at: new Date().toISOString()
        };
        fs.writeFileSync(tokenStoragePath, JSON.stringify(tokenData, null, 4));

        res.send('Authorization successful. Tokens saved.');
    } catch (error) {
        console.error('Error fetching tokens:', error.response ? error.response.data : error.message);
        res.status(500).send('Error fetching tokens.');
    }
});

// Helper function to load tokens
const loadTokens = () => {
    if (fs.existsSync(tokenStoragePath)) {
        const tokens = fs.readFileSync(tokenStoragePath);
        return JSON.parse(tokens);
    }
    return null;
};

// Helper function to refresh tokens
const refreshAccessToken = async () => {
    const tokens = loadTokens();
    if (!tokens || !tokens.refresh_token) {
        throw new Error('No refresh token available.');
    }

    try {
        const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: TWITCH_CLIENT_ID,
                client_secret: TWITCH_CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: tokens.refresh_token,
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const newTokens = response.data;

        // Update token data with new access token and expiration time
        const updatedTokenData = {
            ...tokens,
            ...newTokens,
            obtained_at: new Date().toISOString(),
        };

        fs.writeFileSync(tokenStoragePath, JSON.stringify(updatedTokenData, null, 4));
        console.log('Access token refreshed and saved.');
        return updatedTokenData;
    } catch (error) {
        console.error('Error refreshing access token:', error.response ? error.response.data : error.message);
        throw new Error('Failed to refresh access token.');
    }
};

// Create HTTPS server
const server = https.createServer(options, app);

// Start server on port 3200
server.listen(3200, () => {
    console.log('HTTPS Server running on port 3200');
});

export { loadTokens, refreshAccessToken };
