import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.mjs';

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
    try {
        const users = await User.find({});
        res.render('dashboard', { users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});

// Create User
router.post('/user/create', isAuthenticated, async (req, res) => {
    try {
        const { email, password, isAdmin, subscriptionStatus } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            email,
            password: hashedPassword,
            isAdmin: isAdmin === 'on',
            subscriptionStatus
        });
        await newUser.save();
        res.json({ success: true, message: 'User created', user: newUser });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});

// Update User
router.patch('/user/update', isAuthenticated, async (req, res) => {
    try {
        const { id, email, password, isAdmin, subscriptionStatus } = req.body;

        // Validate the provided user ID
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid or missing User ID' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Update user details
        user.email = email || user.email;
        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }
        if (isAdmin !== undefined) {
            user.isAdmin = isAdmin;
        }
        if (subscriptionStatus) {
            user.subscriptionStatus = subscriptionStatus;
        }

        await user.save();
        res.json({ success: true, message: 'User updated', user });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete User
router.delete('/user/delete', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.body;
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
        console.error(error);
    }
});

export default router;
