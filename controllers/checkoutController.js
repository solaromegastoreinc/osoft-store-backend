// backend/controllers/checkoutController.js
import crypto from "crypto";
import Order from "../models/Order.js";
import Product from "../models/Product.js";


export async function beginCheckout(req, res) {
  try {
    console.log("Checkout request body:", req.body);
    const { email, items, paymentSessionId } = req.body;
    // items: [{ productId, quantity }]; if logged in, you could instead read from server-side cart

    if (!email || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "email and items required" });
    }

    // Grab products in one query
    const products = await Product.find({
      _id: { $in: items.map((i) => i.productId) },
    });

    // Snapshot the cart items
    const snapshotItems = items.map((it) => {
      const p = products.find((x) => String(x._id) === String(it.productId));
      if (!p) return null;
      return {
        productId: it.productId,
        quantity: it.quantity || 1,
        productSnapshot: {
          name: p.name,
          type: p.type, // 'ebook' | 'premium' etc.
          price: Number(p.price || 0),
          fileInfo: p.fileInfo, // relevant only for ebooks
        },
      };
    }).filter(Boolean);

    // Calculate total
    const totalAmount = snapshotItems.reduce(
      (sum, it) =>
        sum +
        (it.productSnapshot?.price || 0) * (it.quantity || 1),
      0
    );

    // Create order in "pending" state
    const order = await Order.create({
      userId: req.user?._id, // requires auth middleware if logged in
      email,
      status: "pending",
      payment: {
        provider: "demo", // later swap to 'stripe' or similar
        sessionId: paymentSessionId || crypto.randomUUID(),
        amount: totalAmount,
        currency: "LKR",
      },
      items: snapshotItems,
    });

    return res.json({
      success: true,
      orderId: order._id,
      sessionId: order.payment.sessionId,
      amount: order.payment.amount,
    });
  } catch (err) {
    console.error("Error in beginCheckout:", err);
    return res.status(500).json({ error: "Server error during checkout" });
  }
}