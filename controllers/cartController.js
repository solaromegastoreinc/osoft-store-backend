// backend/controllers/cartController.js
import User from '../models/User.js';
import Product from '../models/Product.js'; // your product model
import mongoose from 'mongoose';

// Helper: normalize incoming item shape { productId, quantity }
const normalizeItems = (items = []) =>
    items.map(i => {
        // Validate if it's a valid ObjectId
        const isValidId = mongoose.Types.ObjectId.isValid(i.productId);
        return {
            productId: isValidId
                ? new mongoose.Types.ObjectId(i.productId)
                : null,
            quantity: Math.max(1, Number(i.quantity) || 1)
        };
    }).filter(i => i.productId !== null); // Filter out invalid IDs

// GET /api/cart
export const getCart = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('cart.productId', 'name price thumbnailUrl author');
        // explicitly select fields

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            cart: user.cart.map(item => ({
                productId: item.productId._id,
                quantity: item.quantity,
                product: item.productId   // populated with name, price, etc.
            }))
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// POST /api/cart  { productId, quantity }
// POST /api/cart  { productId, quantity }
export const addOrUpdateCartItem = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const { productId, quantity } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: 'productId required' });

    const productObjectId = new mongoose.Types.ObjectId(productId);

    // Ensure product exists
    const product = await Product.findById(productObjectId).lean();
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Find user
    const user = await User.findById(req.user.id);

    // Find if already in cart
    const existingIndex = user.cart.findIndex(item =>
      item.productId.equals(productObjectId)
    );

    if (existingIndex > -1) {
      user.cart[existingIndex].quantity = Math.max(1, Number(quantity) || user.cart[existingIndex].quantity);
    } else {
      user.cart.push({
        productId: productObjectId,
        quantity: Math.max(1, Number(quantity) || 1)
      });
    }

    user.markModified('cart');
    await user.save();

    // ✅ Re-populate with the needed product fields
    const updatedUser = await User.findById(req.user.id)
      .populate('cart.productId', 'name price thumbnailUrl author');

    return res.json({
      success: true,
      cart: updatedUser.cart.map(item => ({
        productId: item.productId._id,
        quantity: item.quantity,
        product: item.productId // will include name, price, thumbnailUrl, author
      }))
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


// DELETE /api/cart/:productId
export const removeCartItem = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
        const { productId } = req.params;
        const user = await User.findById(req.user.id);
        user.cart = user.cart.filter(c => c.productId.toString() !== productId);
        await user.save();
        await user.populate('cart.productId', '-__v');
        return res.json({
            success: true,
            cart: user.cart.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                product: item.productId  // Send the populated product
            }))
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// POST /api/cart/merge { items: [{ productId, quantity }, ...] }
export const mergeCart = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
        const items = normalizeItems(req.body.items || []);

        const user = await User.findById(req.user.id);
        if (!items.length) {
            await user.populate('cart.productId', 'name price thumbnailUrl author');
            return res.json({
                success: true,
                cart: user.cart.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    product: item.productId  // Send the populated product
                }))
            });
        }

        // Verify products exist
        const productIds = items.map(i => i.productId);
        const validProducts = await Product.find({ _id: { $in: productIds } });
        const validProductIds = validProducts.map(p => p._id.toString());

        // Build a map of existing productId => index
        const map = new Map();
        user.cart.forEach((c, idx) => map.set(c.productId.toString(), idx));

        // Merge: sum quantities if exists, otherwise push
        for (const it of items) {
            if (!it.productId || !validProductIds.includes(it.productId.toString())) continue;

            const key = it.productId.toString();
            if (map.has(key)) {
                const idx = map.get(key);
                user.cart[idx].quantity = Math.max(1, user.cart[idx].quantity + it.quantity);
            } else {
                user.cart.push({ productId: it.productId, quantity: it.quantity });
            }
        }

        await user.save();
        await user.populate('cart.productId', '-__v');
        return res.json({
            success: true,
            cart: user.cart.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                product: item.productId  // Send the populated product
            }))
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
    console.log("Merge request items:", req.body.items);
    console.log("Normalized items:", normalizeItems(req.body.items));
    console.log("User cart after merge:", user.cart);
};

// PUT /api/cart  { items: [...] } -> replace user cart (optional)
export const replaceCart = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
        const items = normalizeItems(req.body.items || []);
        const user = await User.findById(req.user.id).populate('cart.productId', 'name price thumbnailUrl author -_v');
        user.cart = items.map(i => ({ productId: i.productId, quantity: i.quantity }));
        await user.save();
        await user.populate('cart.productId', '-__v');
        return res.json({
            success: true,
            cart: user.cart.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                product: item.productId  // Send the populated product
            }))
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};