// File: backend/routes/ebookProductRoutes.js
import express from 'express';
import { uploadBothFiles } from '../config/multerConfig.js';
import { createEbook } from '../controllers/ebookAddController.js';
import { deleteEbook } from '../controllers/ebookDeleteController.js';
import { getAllEbooks, getEbookById, getFilteredAndSearchedEbooks } from '../controllers/ebookGetController.js'; // Import functions from your controller
import { updateEbook } from '../controllers/ebookUpdateController.js';

const router = express.Router();

// const uploadBoth = (req, res, next) => {
//   const thumb = thumbnailUpload.single('thumbnail');
//   const ebook = ebookUpload.single('ebook');

//   thumb(req, res, err => {
//     if (err) return next(err);
//     ebook(req, res, next);
//   });
// };

router.post('/', createEbook); 
router.get('/filtered', getFilteredAndSearchedEbooks);
router.get('/:id', getEbookById);

router.get('/', getAllEbooks);
router.get('/:id', getEbookById);

router.put('/:id', 
  (req, res, next) => {
    uploadBothFiles(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  updateEbook
);


router.delete('/:id', deleteEbook);  // NEW

export default router;