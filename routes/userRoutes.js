import express from 'express';
import {
    changePassword,
    deleteAccount,
    deleteUser,
    getAllUsers,
    getSingleUser,
    grantAdminAccess,
    login,
    logout,
    register,
    resetPassword,
    sendInitialVerifyOtp,
    sendResetOtp,
    updateProfile,
    updateUser,
    verifyEmailSignup
} from '../controllers/userController.js';

import adminMiddleware from '../middleware/adminMiddleware.js';
import userAuth from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';

const userRouter = express.Router();

// Public Routes
userRouter.post('/register', register);
userRouter.post('/login', login);
userRouter.post('/logout', logout);
userRouter.post('/verify-email-signup', verifyEmailSignup);
userRouter.post('/send-initial-verify-otp', sendInitialVerifyOtp);
userRouter.post('/send-reset-otp', sendResetOtp);
userRouter.post('/reset-password', resetPassword);

// User Protected Routes
userRouter.put('/update-profile', userAuth, updateProfile);
userRouter.put('/change-password', userAuth, changePassword);
userRouter.delete('/delete-account', userAuth, deleteAccount);

// Admin Protected Routes with page permissions
userRouter.get('/all-users', userAuth, adminMiddleware, requirePermission('manageUsers'), getAllUsers);
userRouter.post('/grant-admin/:id', userAuth, adminMiddleware, requirePermission('manageUsers'), grantAdminAccess);

userRouter
    .route('/:id')
    .get(userAuth, adminMiddleware, requirePermission('manageUsers'), getSingleUser)
    .put(userAuth, adminMiddleware, requirePermission('manageUsers'), updateUser)
    .delete(userAuth, adminMiddleware, requirePermission('manageUsers'), deleteUser);

export default userRouter;