// backend/controllers/deliveryController.js
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import PremiumCode from "../models/PremiumCode.js";
import { generateDownloadUrl } from "../utils/b2Utils.js";
import { decryptCode } from "../utils/crypto.js";
import jwt from "jsonwebtoken";
import transporter from "../utils/email.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();

// Assign premium codes: basic safe approach using findOneAndUpdate in loop.
// Returns array of assigned PremiumCode documents (still encrypted).
async function assignPremiumCodes(productId, count, email, orderId) {
  const assigned = [];
  for (let i = 0; i < count; i++) {
    const doc = await PremiumCode.findOneAndUpdate(
      {
        productId: new mongoose.Types.ObjectId(productId),
        isAssigned: false
      },
      {
        $set: {
          isAssigned: true,
          assignedToOrderId: new mongoose.Types.ObjectId(orderId),
          assignedToEmail: email,
          assignedAt: new Date()
        }
      },
      { new: true }
    );

    if (!doc) break; // no more codes available
    assigned.push(doc);
  }
  return assigned;
}

// Simple HTML builder. Customize the template to match your design.
function buildEmailHtml({ order, ebookLinks, premiumCodeBlocks }) {
  let html = `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.4">`;
  html += `<h2>Thanks for your purchase</h2>`;
  html += `<p>Order ID: <strong>${order._id}</strong></p>`;
  html += `<p>Amount: <strong>${order.payment.amount} ${order.payment.currency || ""}</strong></p>`;

  if (ebookLinks.length) {
    html += `<h3>eBooks</h3><ul>`;
    ebookLinks.forEach((e) => {
      html += `<li><a href="${e.url}">${e.displayName}</a></li>`;
    });
    html += `</ul>`;
    html += `<p><small>Links expire in 24 hours (token lifetime). Contact support if you lose access.</small></p>`;
  }

  if (premiumCodeBlocks.length) {
    html += `<h3>Premium / Subscription Codes</h3>`;
    premiumCodeBlocks.forEach((block) => {
      html += `<div style="margin-bottom:12px"><strong>${block.productName}</strong>`;
      html += `<pre style="background:#f5f5f5;padding:8px;border-radius:4px">${block.codes.join("\n")}</pre>`;
      html += `</div>`;
    });
  }

  html += `<hr/><p>If something looks wrong, reply to this email or contact support.</p>`;
  html += `</div>`;
  return html;
}

export async function deliverOrderByPaymentSession({ provider, sessionId, payload }) {
    console.log("Delivery function called with:", { provider, sessionId });
  const order = await Order.findOne({ "payment.provider": provider, "payment.sessionId": sessionId });
  console.log("Found order:", order ? order._id : "None");
  if (!order) throw new Error("Order not found for payment session.");

  if (order.status === "delivered") return order; // idempotent

  // Optional amount guard
  if (payload?.amount && Number(payload.amount) !== Number(order.payment.amount)) {
    console.warn("Payment amount mismatch:", payload.amount, order.payment.amount);
    throw new Error("Payment amount mismatch");
  }

  // Get latest product docs (helps if snapshot is missing fileInfo/type)
  const productDocs = await Product.find({ _id: { $in: order.items.map((i) => i.productId) } });

  const ebookLinks = [];
  const premiumCodeIds = [];

  for (const it of order.items) {
    const live = productDocs.find((p) => String(p._id) === String(it.productId));
    const snap = it.productSnapshot || {};
    const type = snap.type || live?.type;
    const name = snap.name || live?.name || "Item";

    if (type === "ebook") {
      const fileInfo = snap.fileInfo || live?.fileInfo;
      if (!fileInfo || !fileInfo.fileName) {
        console.warn(`Missing fileInfo for ebook: ${name}`);
        continue;
      }

      // Short-lived JWT to map to the fileName (download route verifies it)
      const token = jwt.sign(
        { fileName: fileInfo.fileName, displayName: name, orderId: String(order._id) },
        process.env.DOWNLOAD_JWT_SECRET,
        { expiresIn: "24h" }
      );

      const base = process.env.APP_URL || "http://localhost:5000";
      ebookLinks.push({ displayName: name, url: `${base}/api/download/${token}` });
    }

    if (type === "premium_account") {
      const count = it.quantity || 1;
      const assigned = await assignPremiumCodes(it.productId, count, order.email, order._id);
      if (!assigned || assigned.length === 0) {
        console.warn(`No premium codes available for product ${name}`);
        continue;
      }
      assigned.forEach((doc) => premiumCodeIds.push(doc._id));
    }
  }

  // Fetch assigned codes, decrypt and group by product
  const justAssigned = premiumCodeIds.length
    ? await PremiumCode.find({ _id: { $in: premiumCodeIds } }).populate("productId", "name")
    : [];

  const premiumByProduct = new Map();
  justAssigned.forEach((doc) => {
    const key = String(doc.productId._id);
    const productName = doc.productId.name || "Premium";
    let code;
    try {
      code = decryptCode(doc.encryptedCode);
    } catch (err) {
      console.error("Failed to decrypt premium code:", err);
      code = "ERROR-DECRYPTING-CODE";
    }

    if (!premiumByProduct.has(key)) premiumByProduct.set(key, { productName, codes: [] });
    premiumByProduct.get(key).codes.push(code);
  });

  const premiumCodeBlocks = Array.from(premiumByProduct.values());

  // Build & send email
  const html = buildEmailHtml({ order, ebookLinks, premiumCodeBlocks });

  const mail = await transporter.sendMail({
    from: process.env.SENDER_EMAIL,
    to: order.email,
    subject: "Your purchase is ready",
    html,
  });

  // Clear cart server-side for logged in user
  if (order.userId) {
    try {
      console.log("Clearing cart for user:", order.userId);
      // Clear the cart field in the User document
      await User.findByIdAndUpdate(
        order.userId,
        { $set: { cart: [] } }, // Clear the cart array
        { new: true }
      );
      console.log("Cart cleared successfully for user:", order.userId);
    } catch (e) {
      console.warn("Failed to clear cart for user:", e.message);
    }
  }

  // Finalize order
  order.status = "delivered";
  order.payment.raw = payload || order.payment.raw;
  order.delivered = {
    at: new Date(),
    emailMessageId: mail.messageId || "",
    premiumCodeIds,
  };
  await order.save();

  return order;
}