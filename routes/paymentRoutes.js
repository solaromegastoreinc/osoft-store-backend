// backend/routes/paymentRoutes.js
import express from "express";
import { deliverOrderByPaymentSession } from "../controllers/deliveryController.js";

const router = express.Router();

/** Example webhook
 * Adjust for your provider: verify signature, parse sessionId, etc.
 */
router.post("/webhook", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    // TODO: verify signature from your payment gateway
    const payloadStr = req.body.toString("utf8");
    const payload = JSON.parse(payloadStr);

    // e.g. provider emits checkoutSessionId
    const sessionId = payload?.data?.sessionId || payload?.session_id || payload?.id;
    if (!sessionId) return res.status(400).json({ error: "Missing session id" });

    await deliverOrderByPaymentSession({
      provider: "demo", // set your real provider name
      sessionId,
      payload,
    });

    return res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(400).json({ error: "Webhook handling failed" });
  }
});

/** Dev/manual trigger to complete + deliver (used by your Payment Success button during dev) */
router.post("/complete", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "sessionId required" });

    const order = await deliverOrderByPaymentSession({
      provider: "demo",
      sessionId,
      payload: { source: "manual" },
    });

    res.json({ success: true, orderId: order._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Delivery failed", details: err.message });
  }
});

export default router;