import express from 'express';
import { getUserPurchases } from '../controllers/PurchaseHistoryController.js';
import userAuth from '../middleware/authMiddleware.js';

const router = express.Router();

// Route for fetching user's purchase history, matching the frontend's API call.
router.get('/user-purchases', userAuth, getUserPurchases);

export default router;
