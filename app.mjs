import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import stripe from 'stripe';
import session from 'express-session';
import bodyParser from 'body-parser';
import flash from 'connect-flash';
import { DB_USER, DB_PASSWORD, DB_NAME } from './config.mjs';

const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));
app.use(flash());

app.set('view engine', 'ejs');
app.set('views', new URL('./views', import.meta.url).pathname);

const dbURI = `mongodb://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@127.0.0.1:27017/${DB_NAME}`;

mongoose.connect(dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch(err => {
  console.error('Failed to connect to MongoDB:', err.message);
  console.error('Error Details:', err);
});

const UserSchema = new mongoose.Schema({
    email: String,
    password: String,
    subscriptionStatus: String,
});

const User = mongoose.model('User', UserSchema);

app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    res.send('User registered');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ userId: user._id }, 'PSh0JzhGxz6AC0yimgHVUXXVzvM3DGb5');
        res.json({ token });
    } else {
        res.status(400).send('Invalid credentials');
    }
});

app.post('/subscribe', async (req, res) => {
    const { token, planId } = req.body;
    const customer = await stripe.customers.create({
        email: req.user.email,
        source: token,
    });
    const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ plan: planId }],
    });
    await User.findByIdAndUpdate(req.user._id, { subscriptionStatus: 'active' });
    res.send('Subscription successful');
});

// Middleware for checking authentication for admin routes
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/admin/login');
}

// Admin login page
app.get('/admin/login', (req, res) => {
    res.render('login', { message: req.flash('message') });
});

app.post('/admin/login', async (req, res) => {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, role: 'admin' });
    if (admin && await bcrypt.compare(password, admin.password)) {
        req.session.userId = admin._id;
        res.redirect('/admin/dashboard');
    } else {
        req.flash('message', 'Invalid credentials');
        res.redirect('/admin/login');
    }
});

// Admin dashboard
app.get('/admin/dashboard', isAuthenticated, async (req, res) => {
    const users = await User.find({});
    res.render('dashboard', { users });
});

// Add or Edit User
app.post('/admin/user', isAuthenticated, async (req, res) => {
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
app.post('/admin/user/delete', isAuthenticated, async (req, res) => {
    await User.findByIdAndDelete(req.body.id);
    res.redirect('/admin/dashboard');
});

// Admin logout
app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

app.listen(3000, () => console.log('Server running on port 3000'));
