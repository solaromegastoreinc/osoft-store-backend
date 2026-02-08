//backend/models/Analytics.js
import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  event: { type: String, enum: ['view', 'purchase', 'download'], required: true },
  timestamp: { type: Date, default: Date.now },
  context: { type: Object, default: {} },
});

export default mongoose.model('Analytics', analyticsSchema);
