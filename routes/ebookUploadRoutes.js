//file: backend/routes/ebookUploadRoutes.js
import express from 'express';
import { ebookUpload } from '../config/multerConfig.js';
import { uploadEbook } from '../controllers/b2UploadController.js';

const router = express.Router();

router.post('/', ebookUpload.single('ebook'), uploadEbook);

export default router;