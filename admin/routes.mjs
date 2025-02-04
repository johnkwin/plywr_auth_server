import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.mjs';
import axios from 'axios';
import crypto from 'crypto';
import { notifyClient } from '../websocket.mjs';
import { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } from '../config.mjs';

import bodyParser from 'body-parser';

const router = express.Router();
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/admin/login');
}

router.get('/login', (req, res) => {
    res.render('login', { message: req.flash('message') });
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('Login attempt:', { email, password });

        const admin = await User.findOne({ email: email.toLowerCase(), isAdmin: true });
        console.log('Found admin:', admin);

        if (admin) {
            const isMatch = await bcrypt.compare(password, admin.password);
            console.log('Password match:', isMatch);

            if (isMatch) {
                req.session.userId = admin._id;
                console.log('Session set for user:', req.session.userId);
                res.redirect('/admin/dashboard');
            } else {
                req.flash('message', 'Invalid credentials');
                res.redirect('/admin/login');
            }
        } else {
            req.flash('message', 'Invalid credentials');
            res.redirect('/admin/login');
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});

router.get('/dashboard', isAuthenticated, async (req, res) => {
    const users = await User.find({});
    res.render('dashboard', { users });
});

router.post('/user', isAuthenticated, async (req, res) => {
    try {
        const parsedBody = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : req.body;
        const { email, password, isAdmin, subscriptionStatus } = parsedBody;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const newUser = await User.createUser({ email, password, isAdmin, subscriptionStatus });
        res.json({ success: true, message: 'User created successfully', user: newUser });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});



router.patch('/update-user', isAuthenticated, async (req, res) => {
    try {
        const parsedBody = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : req.body;
        const { id, email, password, isAdmin, subscriptionStatus } = parsedBody;

        if (!id) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        const updates = {};
        if (email) updates.email = email;
        if (password) updates.password = await bcrypt.hash(password, 12);
        if (isAdmin !== undefined) updates.isAdmin = isAdmin;
        if (subscriptionStatus) updates.subscriptionStatus = subscriptionStatus;

        const updatedUser = await User.updateUser(id, updates);

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'User updated', user: updatedUser });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});



router.get('/verify-password/:email', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, password: user.password });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});

router.get('/search-users', isAuthenticated, async (req, res) => {
    const query = req.query.q.toLowerCase();
    try {
        const users = await User.find({
            email: { $regex: query, $options: 'i' }
        }).select('email isAdmin subscriptionStatus');
        res.setHeader('Content-Type', 'application/json');
        res.json(users);
    } catch (error) {
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});

router.delete('/user/:id', isAuthenticated, async (req, res) => {
    try {
        const userId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            res.setHeader('Content-Type', 'application/json');
            return res.status(400).json({ success: false, message: 'Invalid User ID' });
        }

        const objectId = new mongoose.Types.ObjectId(userId);

        const user = await User.findById(objectId);
        if (user) {
            await User.findByIdAndDelete(objectId);
            notifyClient(user._id.toString());
            res.setHeader('Content-Type', 'application/json');
            res.json({ success: true, message: 'User deleted' });
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

export default router;
