import express from 'express';
import { getUserData } from '../controllers/authController.js'; // Import the getUserData function
import {
  changePassword,
  deleteAccount,
  sendInitialVerifyOtp,
  updateProfile,
  verifyEmailSignup,
} from '../controllers/userController.js';
import userAuth from '../middleware/authMiddleware.js'; // Import your authentication middleware

const userRouter = express.Router();

// ------------------------------
// ✅ Public Routes (as requested)
// These routes do NOT require authentication
// ------------------------------
userRouter.post('/verify-email-signup', verifyEmailSignup);      // Verify email via OTP
userRouter.post('/send-initial-verify-otp', sendInitialVerifyOtp); // Resend email OTP


// ------------------------------
// ✅ Protected Routes
// All routes below this line will use the userAuth middleware
// ------------------------------
userRouter.use(userAuth); // Apply userAuth middleware to all subsequent routes in this router

userRouter.get('/data', getUserData); // Get user data (requires login)
userRouter.put('/update-profile', updateProfile); // Update user profile
userRouter.put('/change-password', changePassword); // Change user password
userRouter.delete('/delete-account', deleteAccount); // Delete user account

// This route is often used for client-side token validation
userRouter.post('/is-auth', (req, res) => {
    return res.status(200).json({ success: true, message: 'User is authenticated' });
});

export default userRouter;
