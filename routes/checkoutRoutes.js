// backend/routes/checkoutRoutes.js
import express from 'express';
import { beginCheckout } from '../controllers/checkoutController.js';

const router = express.Router();

// POST /api/orders/begin-checkout
router.post('/begin-checkout', beginCheckout);

export default router;