import express from 'express';
import bcrypt from 'bcryptjs';
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

router.post('/user', isAuthenticated, async (req, res) => {
    try {
        const { id, email, password, isAdmin, subscriptionStatus } = req.body;
        if (id) {
            const user = await User.findById(id);
            user.email = email;
            user.isAdmin = isAdmin === 'on';
            if (password) {
                user.password = await bcrypt.hash(password, 10);
            }
            user.subscriptionStatus = subscriptionStatus;
            await user.save();
            res.json({ success: true });
        } else {
            const hashedPassword = await bcrypt.hash(password, 10);
            await User.create({
                email,
                password: hashedPassword,
                isAdmin: isAdmin === 'on',
                subscriptionStatus: subscriptionStatus
            });
            res.json({ success: true });
        }
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
        res.json(users);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});

// Make sure the route is defined with the correct case-sensitive path
// In admin.js, the route is defined as '/update-user/:id', while the path in the request is '/update-user/:ID'
// This is why the route is not being matched correctly.
// Change the route to match the case-sensitive path in the request
router.patch('/update-user/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { isAdmin, subscriptionStatus } = req.body;
        const user = await User.findById(id);
        if (user) {
            user.isAdmin = isAdmin === 'true';
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
router.patch('/user/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { isAdmin, subscriptionStatus } = req.body;
        const user = await User.findById(id);
        if (user) {
            user.isAdmin = isAdmin === 'true';
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

router.post('/user/delete', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.body.id);
        if (user) {
            await User.findByIdAndDelete(req.body.id);
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

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

export default router;
