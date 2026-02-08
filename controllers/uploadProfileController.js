// backend/controllers/uploadController.js
import UserModel from '../models/User.js';
import cloudinary from '../utils/cloudinary.js';

export const uploadProfilePicture = async (req, res) => {
  try {
    console.log('Upload profile picture request received');
    const userID = req.user;
    console.log('User ID from token:', userID);
    
    if (!userID) {
      console.log('No user ID found in request');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    console.log('File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Check file size (max 5MB)
    if (req.file.size > 5 * 1024 * 1024) {
      console.log('File too large:', req.file.size);
      return res.status(400).json({ success: false, message: 'File size exceeds 5MB limit' });
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      console.log('Invalid file type:', req.file.mimetype);
      return res.status(400).json({ success: false, message: 'Only JPG, PNG, and GIF files are allowed' });
    }

    // Find the user first
    console.log('Looking for user in database');
    const user = await UserModel.findById(userID);
    if (!user) {
      console.log('User not found in database');
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('User found:', {
      id: user._id,
      email: user.email,
      existingProfilePicture: user.profilePicture,
      existingProfilePicturePublicId: user.profilePicturePublicId
    });

    // Delete old profile picture from Cloudinary if exists
    if (user.profilePicturePublicId) {
      console.log('Deleting old profile picture from Cloudinary:', user.profilePicturePublicId);
      try {
        await cloudinary.uploader.destroy(user.profilePicturePublicId);
        console.log('Old profile picture deleted from Cloudinary');
      } catch (error) {
        console.error('Error deleting old profile picture from Cloudinary:', error);
        // Continue with upload even if deletion fails
      }
    }

    // Convert buffer to base64 for Cloudinary
    console.log('Converting file to base64 for Cloudinary');
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    // Upload new profile picture to Cloudinary
    console.log('Uploading to Cloudinary');
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'profile_pictures',
      transformation: [
        { width: 300, height: 300, crop: 'fill' },
        { quality: 'auto' },
        { format: 'auto' }
      ]
    });

    console.log('Cloudinary upload result:', {
      secure_url: result.secure_url,
      public_id: result.public_id
    });

    // Update user with new profile picture info
    console.log('Updating user document');
    user.profilePicture = result.secure_url;
    user.profilePicturePublicId = result.public_id;
    
    console.log('Saving user to database');
    const savedUser = await user.save();
    
    console.log('User saved successfully:', {
      profilePicture: savedUser.profilePicture,
      profilePicturePublicId: savedUser.profilePicturePublicId
    });

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profilePicture: result.secure_url
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ success: false, message: 'Failed to upload profile picture' });
  }
};