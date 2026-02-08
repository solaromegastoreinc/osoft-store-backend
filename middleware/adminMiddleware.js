// backend/middleware/adminMiddleware.js

const adminMiddleware = (req, res, next) => {
    // Check if user is authenticated and has a role
    // The req.user object now contains the full user data, including the role
    if (req.user && (req.user.role === 'employee' || req.user.role === 'owner')) {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to perform this action.' });
    }
};

export default adminMiddleware;