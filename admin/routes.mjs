// Update user endpoint
router.put('/user/:id', isAuthenticated, async (req, res) => {
    try {
        const { email, isAdmin, subscriptionStatus } = req.body;
        const user = await User.findById(req.params.id);
        if (user) {
            user.email = email;
            user.isAdmin = isAdmin;
            user.subscriptionStatus = subscriptionStatus;
            await user.save();
            res.json(user);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
        console.error('Error updating user:', error);
    }
});
