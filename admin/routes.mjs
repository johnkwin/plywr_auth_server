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

// Add, Edit, or Delete User
router.post('/user', isAuthenticated, async (req, res) => {
    try {
        const { action, id, email, password, isAdmin, subscriptionStatus } = req.body;
        console.log("USER DELETE START");
        if (action === 'delete' && id) {
            // Delete user
            console.log("INSIDE USER DELETE ACTION");
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
            // Edit existing user
            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            user.email = email;
            user.isAdmin = isAdmin === 'on';
            if (password) {
                user.password = await bcrypt.hash(password, 10);
            }
            user.subscriptionStatus = subscriptionStatus;
            await user.save();
            return res.json({ success: true, message: 'User updated' });
        } else {
            // Add new user
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Email already in use' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            await User.create({
                email,
                password: hashedPassword,
                isAdmin: isAdmin === 'on',
                subscriptionStatus
            });
            return res.json({ success: true, message: 'User created' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});
router.patch('/user/update', async (req, res) => {
    try {
        const { id, email, password, isAdmin, subscriptionStatus } = req.body;

        // Log the incoming payload
        console.log('Payload received:', req.body);

        // Validate the provided user ID
        if (!User.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid or missing User ID' });
        }

        // Build the updates object
        const updates = { email, password, isAdmin, subscriptionStatus };

        // Use the static method to update the user
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
router.patch('/user/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { email, isAdmin, subscriptionStatus, password } = req.body;
        const user = await User.findById(id);
        if (user) {
            user.email = email;
            user.isAdmin = isAdmin === 'true'; // Ensure boolean
            user.subscriptionStatus = subscriptionStatus;
            if (password) {
                user.password = await bcrypt.hash(password, 10);
            }
            await user.save();
            notifyClient(user._id.toString());
            res.json({ success: true, message: 'User updated' });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});

// Delete User
router.delete('/user/:id', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            await User.findByIdAndDelete(req.params.id);
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
