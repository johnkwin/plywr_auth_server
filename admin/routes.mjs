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
        res.status(500).send('Server error');
        console.error(error);
    }
});

router.get('/dashboard', isAuthenticated, async (req, res) => {
    const users = await User.find({});
    res.render('dashboard', { users });
});

// Create or Update User
router.post('/user', isAuthenticated, async (req, res) => {
    try {
        const { action, id, email, password, isAdmin, subscriptionStatus } = req.body;

        if (action === 'delete' && id) {
            // Delete user
            const user = await User.findById(id);
            if (user) {
                await User.findByIdAndDelete(id);
                notifyClient(user._id.toString());
                return res.json({ success: true, message: 'User deleted' });
            } else {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
        }

        if (id) {
            // Update existing user
            const updates = {};
            if (email) updates.email = email;
            if (typeof isAdmin === 'boolean') updates.isAdmin = isAdmin;
            if (subscriptionStatus) updates.subscriptionStatus = subscriptionStatus;
            if (password) updates.password = await bcrypt.hash(password, 10);

            const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true });

            if (!updatedUser) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            return res.json({ success: true, message: 'User updated', user: updatedUser });
        } else {
            // Create new user
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Email already in use' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = new User({
                email,
                password: hashedPassword,
                isAdmin: isAdmin === 'true',
                subscriptionStatus
            });
            await newUser.save();
            return res.json({ success: true, message: 'User created', user: newUser });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});

// Search users
router.get('/search-users', isAuthenticated, async (req, res) => {
    const query = req.query.q;
    try {
        const users = await User.find({
            email: { $regex: query, $options: 'i' }
        }).select('email isAdmin subscriptionStatus');
        res.json(users);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});

// Update user
router.patch('/user/update', isAuthenticated, async (req, res) => {
    try {
        const { id, email, password, isAdmin, subscriptionStatus } = req.body;

        // Validate and convert the user ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid or missing User ID' });
        }
        const objectId = mongoose.Types.ObjectId(id);

        // Build the updates object
        const updates = {};
        if (email) updates.email = email;
        if (typeof isAdmin === 'boolean') updates.isAdmin = isAdmin;
        if (subscriptionStatus) updates.subscriptionStatus = subscriptionStatus;
        if (password) updates.password = await bcrypt.hash(password, 10);

        // Find and update the user
        const updatedUser = await User.findByIdAndUpdate(objectId, updates, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'User updated', user: updatedUser });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete User
router.delete('/user/:id', isAuthenticated, async (req, res) => {
    try {
        const userId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid User ID' });
        }

        const user = await User.findById(userId);
        if (user) {
            await User.findByIdAndDelete(userId);
            notifyClient(user._id.toString());
            res.json({ success: true, message: 'User deleted' });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

export default router;
