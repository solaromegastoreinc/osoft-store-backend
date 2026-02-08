//backend/controllers/b2UploadController.js
import B2 from 'backblaze-b2';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID,
  applicationKey: process.env.B2_APP_KEY
});

export const uploadEbook = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate Backblaze configuration
    if (!process.env.B2_KEY_ID || !process.env.B2_APP_KEY || !process.env.B2_BUCKET_ID) {
      throw new Error('Backblaze configuration is incomplete');
    }

    // Log file info for debugging
    console.log(`Uploading file: ${req.file.originalname}, Size: ${req.file.size} bytes`);

    // Authorize with Backblaze
    await b2.authorize();
    
    // Get upload URL
    const response = await b2.getUploadUrl({
      bucketId: process.env.B2_BUCKET_ID
    });
    
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(req.file.originalname);
    const fileName = `ebooks/${uniqueSuffix}${ext}`;
   
    
    // Upload from memory buffer
    const uploadResponse = await b2.uploadFile({
      uploadUrl: response.data.uploadUrl,
      uploadAuthToken: response.data.authorizationToken,
      fileName: fileName,
      data: req.file.buffer,
      mime: req.file.mimetype
    });
    
    // For private buckets, we don't have a public URL
    // Instead, we'll store the file ID and name for future access
    const fileInfo = {
      fileId: uploadResponse.data.fileId,
      fileName: fileName,
      bucketId: process.env.B2_BUCKET_ID
    };

    res.json({
      success: true,
      message: 'File uploaded to private bucket',
      fileInfo: fileInfo
    });
    
  } catch (error) {
    console.error('B2 upload error:', error);
    res.status(500).json({
      error: 'Ebook upload failed',
      details: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};