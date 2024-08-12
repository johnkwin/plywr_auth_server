import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.mjs';
import axios from 'axios';
import crypto from 'crypto';
import { notifyClient } from '../websocket.mjs';
import { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } from '../config.mjs';

const router = express.Router();

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/admin/login');
}

router.get('/login', (req, res) => {
    res.render('user/login', { message: req.flash('message') });
});

router.get('/register', (req, res) => {
    res.render('user/register', { message: req.flash('message') });
});

router.get('/dashboard', isAuthenticated, (req, res) => {
    const user = await User.findById(req.session.userId);
    res.render('user/dashboard', { user });
});

router.post('/user', isAuthenticated, async (req, res) => {
    try {
        const { email, password, isAdmin, subscriptionStatus } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.setHeader('Content-Type', 'application/json');
            return res.status(400).json({ success: false, message: 'Email already in use' });
        }

        const newUser = new User({
            email,
            password,  // No need to hash here, the middleware will handle it
            isAdmin,
            subscriptionStatus
        });
        await newUser.save();
        res.setHeader('Content-Type', 'application/json');
        return res.json({ success: true, message: 'User created', user: newUser });
    } catch (error) {
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});

router.patch('/update-user', isAuthenticated, async (req, res) => {
    try {
        const { id, email, password, isAdmin, subscriptionStatus } = req.body;

        console.log('Update User ID:', id); // Debug log for ID

        const updates = { email, isAdmin, subscriptionStatus, password };

        const updatedUser = await User.updateUser(id, updates);

        if (!updatedUser) {
            res.setHeader('Content-Type', 'application/json');
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.setHeader('Content-Type', 'application/json');
        res.json({ success: true, message: 'User updated', user: updatedUser });
    } catch (error) {
        console.error('Error updating user:', error);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
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
    const query = req.query.q;
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
