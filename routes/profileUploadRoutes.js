// In backend/routes/uploadRoutes.js
import express from 'express';
import { profilePictureUpload } from '../config/multerConfig.js'; // Import from your existing config
import { uploadProfilePicture } from '../controllers/uploadProfileController.js';
import userAuth from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/profile-picture', userAuth, (req, res, next) => {
  profilePictureUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, uploadProfilePicture);

router.delete('/profile-picture', userAuth);

export default router;