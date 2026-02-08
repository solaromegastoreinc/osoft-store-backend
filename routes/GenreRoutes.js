// backend/routes/GenreRoutes.js

import express from 'express';
import {
  getAllGenres,
  getGenreByName,
} from '../controllers/GenreController.js';

const router = express.Router();

// Route to get all genres
router.get('/', getAllGenres);

// Route to get a single genre by its name
router.get('/:name', getGenreByName);

export default router;