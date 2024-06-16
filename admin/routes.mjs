// Search users
router.get('/search-users', isAuthenticated, async (req, res) => {
    try {
        const query = req.query.q;
        const users = await User.find({ email: { $regex: query, $options: 'i' } }).lean();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
        console.error(error);
    }
});
