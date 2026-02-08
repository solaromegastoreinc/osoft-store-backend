// backend/models/Order.js
import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, default: 1, min: 1 },
    // Keep a product snapshot to avoid drift
    productSnapshot: {
      name: { type: String, required: true },
      type: { type: String, required: true }, // 'ebook' | 'premium' | ...
      price: { type: Number, required: true },
      // For ebooks:
      fileInfo: {
        fileId: String,
        fileName: String,
        bucketId: String,
      },
    },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional (guest order if absent)
    email: { type: String, required: true }, // delivery email (either user email or guest email)
    status: { type: String, enum: ["pending", "paid", "delivered", "failed"], default: "pending" },
    payment: {
      provider: String,
      sessionId: { type: String, index: true, sparse: true },   // e.g. checkoutSessionId / paymentIntentId
      amount: Number,
      currency: String,
      raw: Object,         // webhook payload backup (optional)
    },
    items: [OrderItemSchema],
    delivered: {
      at: Date,
      emailMessageId: String,
      premiumCodeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "PremiumCode" }],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Order", OrderSchema);