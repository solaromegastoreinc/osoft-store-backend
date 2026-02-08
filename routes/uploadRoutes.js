// File: backend/routes/uploadRoutes.js
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import util from 'util';
import dotenv from 'dotenv';

dotenv.config();
const unlinkFile = util.promisify(fs.unlink);
const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true // Always use HTTPS
});

// Configure multer with file validation
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
    files: 1 // Only 1 file
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed'));
    }
  }
});

router.post('/', upload.single('thumbnail'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded or invalid file type' 
      });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'ebook-thumbnails',
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
      transformation: [
        { width: 500, height: 500, crop: 'limit' } // Optimize image
      ]
    });

    // Cleanup: Delete the temporary file
    await unlinkFile(req.file.path);

    res.json({ 
      success: true,
      url: result.secure_url,
      public_id: result.public_id 
    });
    
  } catch (error) {
    // Cleanup on error
    if (req.file) {
      await unlinkFile(req.file.path).catch(console.error);
    }
    
    console.error('Upload error:', error);
    
    // Handle specific errors
    if (error.message.includes('File too large')) {
      return res.status(413).json({ 
        error: 'File too large. Max size is 2MB' 
      });
    }
    
    if (error.message.includes('Invalid file type')) {
      return res.status(400).json({ 
        error: 'Only image files are allowed (JPEG, PNG, WebP, SVG)' 
      });
    }
    
    res.status(500).json({ 
      error: 'Upload failed',
      details: error.message 
    });
  }
});

export default router;