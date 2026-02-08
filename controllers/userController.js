// backend/controllers/userController.js

import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import UserModel from '../models/User.js';
import transporter from '../utils/email.js';

dotenv.config();

// =====================
// Utility functions
// =====================

/**
 * Generates a 6-digit OTP string
 */
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

/**
 * Sends an email using nodemailer transporter
 */
const sendEmail = async (to, subject, html) => {
  const mailOptions = {
    from: process.env.SENDER_EMAIL,
    to,
    subject,
    html,
  };
  await transporter.sendMail(mailOptions);
};

// =====================
// OTP Generators
// =====================

/**
 * Generate and send verification OTP (valid 24h)
 */
export const generateAndSendVerificationOtp = async (user) => {
  const otp = generateOtp();
  user.verifyOtp = otp;
  user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  await user.save();

  

  await sendEmail(
    user.email,
    'Email Verification OTP',
    `<p>Your OTP for email verification is <strong>${otp}</strong>. It is valid for 24 hours.</p>`
  );

};

/**
 * Generate and send password reset OTP (valid 15min)
 */
export const generateAndSendPasswordResetOtp = async (user) => {
  const otp = generateOtp();
  user.resetOtp = otp;
  user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000; // 15 minutes
  await user.save();



  await sendEmail(
    user.email,
    'Password Reset OTP',
    `<p>Your OTP for password reset is <strong>${otp}</strong>. It is valid for 15 minutes.</p>`
  );

};

// =====================
// Controllers
// =====================

// Register user
export const register = async (req, res) => {
  const { email, password, confirmPassword } = req.body;

  if (!email || !password || !confirmPassword)
    return res.status(400).json({ success: false, message: 'Missing details' });

  if (password !== confirmPassword)
    return res.status(400).json({ success: false, message: 'Passwords do not match' });

  try {
    let existingUser = await UserModel.findOne({ email });

    if (existingUser) {
      if (existingUser.isAccountVerified)
        return res.status(409).json({ success: false, message: 'User already verified. Please log in.' });

      // User exists but not verified, resend OTP
      const token = jwt.sign({ id: existingUser._id }, process.env.JWT_SECRET, { expiresIn: '10m' });
      await generateAndSendVerificationOtp(existingUser);

      return res.status(200).json({
        success: true,
        message: 'Account exists but not verified. New OTP sent.',
        token,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new UserModel({
      email,
      password: hashedPassword,
      isAccountVerified: false,
    });

    await newUser.save();
    await generateAndSendVerificationOtp(newUser);

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please verify your email.',
      token,
    });
  } catch (error) {
    console.error("❌ Registration Error:", error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

// Login user
export const login = async (req, res) => {
  const { email, password, guestCart } = req.body;

  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password are required' });

  try {
    const user = await UserModel.findOne({ email }).select('+password');

    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    if (!user.isAccountVerified) {
      const tempToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '10m' });
      await generateAndSendVerificationOtp(user);

      return res.status(403).json({
        success: false,
        message: 'Account not verified. New OTP sent.',
        tempToken,
      });
    }

    // Cart Merging Logic ---
if (Array.isArray(guestCart) && guestCart.length > 0) {
  // Normalize incoming guest cart -> [{ productId: ObjectId, quantity: number }]
  const normalizedGuestCart = guestCart
    .map(i => {
      const qty = Math.max(1, Number(i?.quantity) || 1);
      const pid = i?.productId;
      if (!pid || !mongoose.Types.ObjectId.isValid(pid)) return null;
      return {
        productId: new mongoose.Types.ObjectId(pid),
        quantity: qty,
      };
    })
    .filter(Boolean);

  // Build a map productId(string) -> quantity from guest cart
  const guestCartMap = new Map();
  for (const item of normalizedGuestCart) {
    const key = item.productId.toString();
    // if same product appears multiple times in guest cart, sum it
    guestCartMap.set(key, (guestCartMap.get(key) || 0) + item.quantity);
  }

  // Merge with user's existing cart (sum quantities when overlapping)
  if (!Array.isArray(user.cart)) user.cart = [];
  for (const item of user.cart) {
    const key = item.productId?.toString?.();
    if (!key) continue;
    if (guestCartMap.has(key)) {
      item.quantity = Math.max(1, Number(item.quantity) || 1) + guestCartMap.get(key);
      guestCartMap.delete(key);
    }
  }

  // Add remaining guest items not already in the user's cart
  for (const [productIdStr, quantity] of guestCartMap.entries()) {
    user.cart.push({
      productId: new mongoose.Types.ObjectId(productIdStr),
      quantity: Math.max(1, Number(quantity) || 1),
    });
  }

  await user.save();
}


    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, message: 'Logged in successfully', token });
  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// Verify email via OTP
export const verifyEmailSignup = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp)
    return res.status(400).json({ success: false, message: 'Email and OTP are required' });

  try {
    const user = await UserModel.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.isAccountVerified) return res.status(400).json({ success: false, message: 'Account already verified' });
    if (user.verifyOtp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP' });
    if (user.verifyOtpExpireAt < Date.now()) return res.status(400).json({ success: false, message: 'OTP expired' });

    user.isAccountVerified = true;
    user.verifyOtp = undefined;
    user.verifyOtpExpireAt = undefined;
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ success: true, message: 'Email verified successfully', token });
  } catch (error) {
    console.error("❌ Email Verification Error:", error);
    res.status(500).json({ success: false, message: 'Email verification failed' });
  }
};

// Resend initial verification OTP
export const sendInitialVerifyOtp = async (req, res) => {
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ success: false, message: 'Email is required' });

  try {
    const user = await UserModel.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.isAccountVerified) return res.status(400).json({ success: false, message: 'Account already verified' });

    await generateAndSendVerificationOtp(user);
    res.json({ success: true, message: 'Verification OTP resent' });
  } catch (error) {
    console.error("❌ Resend OTP Error:", error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

// Send password reset OTP
export const sendResetOtp = async (req, res) => {
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ success: false, message: 'Email is required' });

  try {
    const user = await UserModel.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.isAccountVerified)
      return res.status(403).json({ success: false, message: 'Account is not verified yet' });

    await generateAndSendPasswordResetOtp(user);

    res.status(200).json({ success: true, message: 'Password reset OTP sent' });
  } catch (error) {
    console.error('❌ sendResetOtp error:', error);
    res.status(500).json({ success: false, message: 'Server error while sending reset OTP' });
  }
};

// Reset password
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword)
    return res.status(400).json({ success: false, message: 'All fields are required' });

  try {
    const user = await UserModel.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (String(user.resetOtp) !== String(otp))
      return res.status(400).json({ success: false, message: 'Invalid OTP' });

    if (user.resetOtpExpireAt < Date.now())
      return res.status(400).json({ success: false, message: 'OTP expired' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetOtp = undefined;
    user.resetOtpExpireAt = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error("❌ resetPassword error:", error);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};

// Logout user
export const logout = (req, res) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error("❌ Logout error:", error);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
};

// Update User Profile
export const updateProfile = async (req, res) => {
  try {
    const userID = req.user;
    const { firstName, lastName, email, phone } = req.body;

    if (!userID) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User ID not found.' });
    }

    const user = await UserModel.findById(userID).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (email && email !== user.email) {
      const existingUserWithEmail = await UserModel.findOne({ email });
      if (existingUserWithEmail) {
        return res.status(409).json({ success: false, message: 'This email is already registered.' });
      }
      user.email = email;
    }

    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.phone = phone || user.phone;

    await user.save({ validateBeforeSave: true });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        isAccountVerified: user.isAccountVerified,
      }
    });

  } catch (error) {
    console.error("❌ Error updating profile:", error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update profile.' });
  }
};

// Change User Password
export const changePassword = async (req, res) => {
  try {
    const userID = req.user;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!userID) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User ID not found.' });
    }

    const user = await UserModel.findById(userID).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!currentPassword || !(await user.correctPassword(currentPassword, user.password))) {
      return res.status(401).json({ success: false, message: 'Incorrect current password.' });
    }

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirmation do not match.' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ success: false, message: 'New password cannot be the same as the current password.' });
    }

    // ✅ Explicitly hash new password here before saving
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save({ validateBeforeSave: true });

    res.cookie('token', 'loggedout', {
      httpOnly: true,
      expires: new Date(Date.now() + 10 * 1000),
      secure: true,
      sameSite:  'none' ,
    });

    res.status(200).json({ success: true, message: 'Password changed successfully! Please log in with your new password.' });

  } catch (error) {
    console.error("❌ Error changing password:", error);
    res.status(500).json({ success: false, message: error.message || 'Failed to change password.' });
  }
};

// NEW: Delete User Account
export const deleteAccount = async (req, res) => {
  try {
    const userID = req.user; // User ID from authMiddleware

    if (!userID) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User ID not found.' });
    }

    const user = await UserModel.findByIdAndDelete(userID);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Clear the authentication cookie upon successful deletion
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });

    res.status(200).json({ success: true, message: 'Account deleted successfully.' });

  } catch (error) {
    console.error("❌ Error deleting account:", error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete account.' });
  }
};

// NEW: Admin-only function to get all users
export const getAllUsers = async (req, res) => {
  try {
    const users = await UserModel.find().select('-password');
    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      users,
    });
  } catch (error) {
    console.error("❌ Get Users Error:", error);
    res.status(500).json({ success: false, message: 'Failed to retrieve users' });
  }
};

// NEW: Admin-only function to get a single user
export const getSingleUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserModel.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      user,
    });
  } catch (error) {
    console.error("❌ Get Single User Error:", error);
    res.status(500).json({ success: false, message: 'Failed to retrieve user' });
  }
};

// NEW: Admin-only function to update a user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, role, isAccountVerified } = req.body;

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.firstName = firstName ?? user.firstName;
    user.lastName = lastName ?? user.lastName;
    user.email = email ?? user.email;
    user.phone = phone ?? user.phone;
    user.role = role ?? user.role;
    user.isAccountVerified = isAccountVerified ?? user.isAccountVerified;

    await user.save({ validateBeforeSave: true });

    res.status(200).json({ success: true, message: 'User updated successfully', user });
  } catch (error) {
    console.error("❌ Update User Error:", error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
};

// NEW: Admin-only function to delete a user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await UserModel.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error("❌ Delete User Error:", error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

// NEW: Admin-only function to grant admin access
export const grantAdminAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserModel.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // A user with 'owner' role can't be demoted
    if (user.role === 'owner') {
      return res.status(403).json({ success: false, message: 'Cannot demote an owner' });
    }

    // Promote the user to employee
    user.role = 'employee';
    await user.save();

    res.status(200).json({ success: true, message: 'User promoted to employee successfully', user });
  } catch (error) {
    console.error("❌ Grant Admin Access Error:", error);
    res.status(500).json({ success: false, message: 'Failed to grant admin access' });
  }
};


