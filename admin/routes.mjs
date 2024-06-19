import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.mjs';
import { notifyClient } from '../websocket.mjs';

const router = express.Router();

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
        const admin = await User.findOne({ email, isAdmin: true });
        if (admin && await bcrypt.compare(password, admin.password)) {
            req.session.userId = admin._id;
            res.redirect('/admin/dashboard');
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
        const { email, password, isAdmin, subscriptionStatus } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.setHeader('Content-Type', 'application/json');
            return res.status(400).json({ success: false, message: 'Email already in use' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            email,
            password: hashedPassword,
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

// Use PATCH for updates
router.patch('/user/update/:id', isAuthenticated, async (req, res) => {
    try {
        const id = req.params.id;
        const { email, password, isAdmin, subscriptionStatus } = req.body;
        console.log('User ID:', id);
        console.log('Payload received:', req.body);

        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.setHeader('Content-Type', 'application/json');
            return res.status(400).json({ success: false, message: 'Invalid or missing User ID' });
        }

        const objectId = new mongoose.Types.ObjectId(id);
        const updates = {};
        if (email) updates.email = email;
        if (typeof isAdmin === 'boolean') updates.isAdmin = isAdmin;
        if (subscriptionStatus) updates.subscriptionStatus = subscriptionStatus;
        if (password) updates.password = await bcrypt.hash(password, 10);

        const updatedUser = await User.findByIdAndUpdate(objectId, updates, { new: true });
        console.log('Updated user:', updatedUser);
        console.log('Updates:', updates);
        if (!updatedUser) {
            res.setHeader('Content-Type', 'application/json');
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.setHeader('Content-Type', 'application/json');
        res.json({ success: true, message: 'User updated', user: updatedUser });
    } catch (error) {
        console.error('Error updating user:', error);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ success: false, message: 'Server error' });
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
