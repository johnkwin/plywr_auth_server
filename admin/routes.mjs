import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.mjs';
import { notifyClient } from '../websocket.mjs';

const router = express.Router();

// Middleware for checking authentication for admin routes
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/admin/login');
}

// Admin login page
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

// Admin dashboard
router.get('/dashboard', isAuthenticated, async (req, res) => {
    res.render('dashboard', { users: [] });
});

// Search users
router.get('/search-users', isAuthenticated, async (req, res) => {
    try {
        const query = req.query.query || '';
        const users = await User.find({
            email: new RegExp(query, 'i') // Case-insensitive search
        }).limit(10); // Limit results for performance
        res.json(users);
    } catch (error) {
        res.status(500).send('Server error');
        console.error(error);
    }
});

// Update user
router.post('/update-user/:id', isAuthenticated, async (req, res) => {
    try {
        const { email, isAdmin, subscriptionStatus } = req.body;
        const user = await User.findById(req.params.id);
        if (user) {
            user.email = email;
            user.isAdmin = isAdmin;
            user.subscriptionStatus = subscriptionStatus;
            await user.save();
            notifyClient(user._id.toString());
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});

// Delete User
router.post('/user/delete', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.body.id);
        if (user) {
            await User.findByIdAndDelete(req.body.id);
            notifyClient(user._id.toString());
        }
        res.redirect('/admin/dashboard');
    } catch (error) {
        res.status(500).send('Server error');
        console.error(error);
    }
});

// Admin logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

export default router;
