import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.mjs'; // Ensure User model uses ES module and has .mjs extension

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
    const { email, password } = req.body;
    const admin = await User.findOne({ email, role: 'admin' }); // Ensure your admin user has a role field
    if (admin && await bcrypt.compare(password, admin.password)) {
        req.session.userId = admin._id;
        res.redirect('/admin/dashboard');
    } else {
        req.flash('message', 'Invalid credentials');
        res.redirect('/admin/login');
    }
});

// Admin dashboard
router.get('/dashboard', isAuthenticated, async (req, res) => {
    const users = await User.find({});
    res.render('dashboard', { users });
});

// Add or Edit User
router.post('/user', isAuthenticated, async (req, res) => {
    const { id, email, password } = req.body;
    if (id) {
        // Edit existing user
        const user = await User.findById(id);
        user.email = email;
        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }
        await user.save();
    } else {
        // Add new user
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ email, password: hashedPassword });
    }
    res.redirect('/admin/dashboard');
});

// Delete User
router.post('/user/delete', isAuthenticated, async (req, res) => {
    await User.findByIdAndDelete(req.body.id);
    res.redirect('/admin/dashboard');
});

// Admin logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

export default router;
