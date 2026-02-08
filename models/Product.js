// models/Product.js
import mongoose from 'mongoose';

const baseOptions = {
  discriminatorKey: 'type',
  collection: 'products',
  timestamps: true,
};

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  isAvailable: { type: Boolean, default: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  tags: { type: [String], default: [] },
  thumbnailUrl: { type: String, default: '' },
  thumbnailPublicId: { type: String, default: '' },
  deliveryFormat: { type: String, default: 'email' },
}, baseOptions);

const Product = mongoose.model('Product', ProductSchema);
export default Product;