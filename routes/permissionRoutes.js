import express from 'express';
import {
    getAllEmployeePermissions,
    getCurrentUserPermissions,
    updateEmployeePermissions
} from '../controllers/userPermissionController.js';
import userAuth from '../middleware/authMiddleware.js';
import ownerMiddleware from '../middleware/ownerMiddleware.js';

const permissionRouter = express.Router();

// Get current user's permissions (for frontend routing)
permissionRouter.get('/my-permissions', userAuth, getCurrentUserPermissions);

// Owner-only routes for managing employee permissions
permissionRouter.get('/employees', userAuth, ownerMiddleware, getAllEmployeePermissions);
permissionRouter.put('/employees/:employeeId', userAuth, ownerMiddleware, updateEmployeePermissions);

export default permissionRouter;