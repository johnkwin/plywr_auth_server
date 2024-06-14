import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.mjs';

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
    const users = await User.find({});
    res.render('dashboard', { users });
});

// Add or Edit User
router.post('/user', isAuthenticated, async (req, res) => {
    try {
        const { id, email, password, isAdmin } = req.body;
        if (id) {
            // Edit existing user
            const user = await User.findById(id);
            user.email = email;
            user.isAdmin = isAdmin === 'on'; // Checkbox value handling
            if (password) {
                user.password = await bcrypt.hash(password, 10);
            }
            await user.save();
        } else {
            // Add new user
            const hashedPassword = await bcrypt.hash(password, 10);
            await User.create({ email, password: hashedPassword, isAdmin: isAdmin === 'on' });
        }
        res.redirect('/admin/dashboard');
    } catch (error) {
        res.status(500).send('Server error');
        console.error(error);
    }
});

// Delete User
router.post('/user/delete', isAuthenticated, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.body.id);
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
