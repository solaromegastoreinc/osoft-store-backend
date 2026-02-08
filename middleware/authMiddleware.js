// backend/middleware/authMiddleware.js

import jwt from 'jsonwebtoken';
import UserModel from '../models/User.js';

const userAuth = async (req, res, next) => {
    let token;

    // 1. Check for token in Authorization header (Bearer token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // 2. Check for token in cookies
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    // Check if token is missing or explicitly logged out
    if (!token || token === 'loggedout') {
        return res.status(401).json({ success: false, message: 'Not authorized, no token provided.' });
    }

    try {
        // Attempt to verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find the user associated with the token's ID
        const currentUser = await UserModel.findById(decoded.id);

        if (!currentUser) {
            return res.status(401).json({ success: false, message: 'Not authorized, user no longer exists.' });
        }

        // Attach the entire user object to the request for subsequent middleware
        req.user = currentUser;
        next();

    } catch (error) {
        // Handle all other JWT errors (e.g., token expired, invalid signature)
        console.error('Authentication Error:', error);
        return res.status(401).json({ success: false, message: 'Not authorized, token failed.' });
    }
};

export default userAuth;