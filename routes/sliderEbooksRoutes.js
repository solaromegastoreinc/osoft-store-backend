import express from 'express';
import { getNewestEbooks, getRandomEbooks } from '../controllers/ebookGetController.js'; // Import the controller functions


const router = express.Router();
router.get('/newest', getNewestEbooks); // GET /api/slider-ebooks/newest
router.get('/random', getRandomEbooks); // GET /api/slider-ebooks/random

export default router;