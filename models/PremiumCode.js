// models/PremiumCode.js
import mongoose from 'mongoose';

const premiumCodeSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  encryptedCode: { type: String, required: true },
  isAssigned: { type: Boolean, default: false },
  assignedToOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  assignedToEmail: { type: String, default: null },
  assignedAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('PremiumCode', premiumCodeSchema);
