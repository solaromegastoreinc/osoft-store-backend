// models/PremiumProduct.js
import Product from './Product.js';
import mongoose from 'mongoose';

const PremiumProductSchema = new mongoose.Schema({
  platform: { type: String, required: true },           // e.g., Grammarly
  duration: { type: String, required: true },           // e.g., "30 days", "1 year"
  licenseType: { type: String, enum: ['key', 'login', 'serial'], required: true },
}, { _id: false });

export const PremiumProduct = Product.discriminator('premium_account', PremiumProductSchema);