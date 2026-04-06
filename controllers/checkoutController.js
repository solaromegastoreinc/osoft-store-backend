// backend/controllers/checkoutController.js
import crypto from "crypto";
import Stripe from "stripe";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { deliverOrderByPaymentSession } from "./deliveryController.js";
import dotenv from "dotenv";
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
        provider: "stripe",
        amount: totalAmount,
        currency: "USD",
      },
      items: snapshotItems,
    });

    // Create Stripe Checkout Session
    const envFrontendUrls = (process.env.FRONTEND_URL || '').split(',');
    const origin = envFrontendUrls[0] || req.headers.origin || 'http://localhost:5173';
    
    // Convert items for Stripe
    const line_items = snapshotItems.map(item => ({
        price_data: {
            currency: 'usd',
            product_data: {
                name: item.productSnapshot.name,
            },
            unit_amount: Math.round(item.productSnapshot.price * 100), // in cents
        },
        quantity: item.quantity || 1,
    }));

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items,
        mode: 'payment',
        customer_email: email,
        success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/cart`,
        client_reference_id: order._id.toString(),
    });

    order.payment.sessionId = session.id;
    await order.save();

    return res.json({
      success: true,
      orderId: order._id,
      sessionId: session.id,
      url: session.url, // URL for redirecting
      amount: order.payment.amount,
    });
  } catch (err) {
    console.error("Error in beginCheckout:", err);
    return res.status(500).json({ error: "Server error during checkout" });
  }
}

// Webhook handler for Stripe
export async function stripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log(`Payment successful for session: ${session.id}`);

    try {
      await deliverOrderByPaymentSession({
        provider: 'stripe',
        sessionId: session.id,
        payload: { amount: session.amount_total / 100 }
      });
      console.log(`Order delivered successfully for session: ${session.id}`);
    } catch (deliveryError) {
      console.error(`Delivery failed for session ${session.id}:`, deliveryError);
      // We still return 200 to Stripe so it doesn't retry, or we return 500 if we want retry?
      // Usually better to return 200 and handle delivery retries manually if it fails
    }
  }

  // Return a 200 response to acknowledge receipt of the event
  res.send();
}