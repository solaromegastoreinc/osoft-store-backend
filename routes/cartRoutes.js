// backend/routes/cartRoutes.js
import express from 'express';
import {
  getCart,
  addOrUpdateCartItem,
  removeCartItem,
  mergeCart,
  replaceCart
} from '../controllers/cartController.js';
import userAuth from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', userAuth, getCart);
router.post('/', userAuth, addOrUpdateCartItem);
router.put('/', userAuth, replaceCart);            // optional: replace whole cart
router.post('/merge', userAuth, mergeCart);
router.delete('/:productId', userAuth, removeCartItem);

export default router;