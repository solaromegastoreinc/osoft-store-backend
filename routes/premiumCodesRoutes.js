// backend/routes/premiumCodesRoutes.js
import express from 'express';
import { addBulkCodes, getCodesForProduct, deletePremiumCode } from '../controllers/premiumCodeController.js';

const router = express.Router();

// POST /api/premium/codes/bulk
router.post('/bulk', addBulkCodes);

//GET codes (for admin UI display later)
router.get('/product/:productId', getCodesForProduct);

router.delete('/:id', deletePremiumCode);

export default router;