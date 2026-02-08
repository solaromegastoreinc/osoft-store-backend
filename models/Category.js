// backend/models/Category.js
import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['ebook', 'premium_account'], required: true },
  slug: { type: String, required: true, unique: true },
});

export default mongoose.model('Category', categorySchema);
