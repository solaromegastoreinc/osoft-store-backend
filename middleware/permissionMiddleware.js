// backend/middleware/permissionMiddleware.js

import UserModel from '../models/User.js';

/**
 * Checks if the authenticated user has the necessary permissions to access a resource.
 *
 * @param {string} permissionKey The key representing the required permission (e.g., 'manageUsers').
 * @returns {function} An async Express middleware function.
 */
export const requirePermission = (permissionKey) => {
    return async (req, res, next) => {
        try {
            // Correctly retrieve the user's ID from the user object set by userAuth
            const userId = req.user._id;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Unauthorized: User not authenticated' });
            }

            // Find the user to get their latest permissions
            const user = await UserModel.findById(userId).select('+allowedPages');

            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            // Owners have full access to all resources.
            if (user.role === 'owner') {
                return next();
            }

            // Customers are not allowed in the admin area.
            if (user.role === 'customer') {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: Customers are not allowed in the admin area'
                });
            }

            // For employees, check if the required permission is in their allowedPages array.
            if (user.role === 'employee') {
                // Ensure allowedPages exists and check if the permissionKey is included
                if (!user.allowedPages || !user.allowedPages.includes(permissionKey)) {
                    return res.status(403).json({
                        success: false,
                        message: `Access denied: You don't have permission to access this resource`
                    });
                }
                
                // If the permission is found, proceed to the next middleware.
                return next();
            }

            // Fallback: deny access for any other role.
            res.status(403).json({ success: false, message: 'Access denied' });
        } catch (error) {
            console.error('Permission middleware error:', error);
            res.status(500).json({ success: false, message: 'Server error checking permissions' });
        }
    };
};