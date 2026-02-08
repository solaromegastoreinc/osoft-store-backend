// models/Ebook.js
import Product from './Product.js';
import mongoose from 'mongoose';

const EbookSchema = new mongoose.Schema({
  author: { type: String, required: true },
  ISBN: String,
  language: String,
  publicationDate: Date,
  publisher: String,
  edition: String,
  
  fileInfo: {
    fileId: String,
    fileName: String,
    bucketId: String
  },
  metadata: {
    pageCount: Number,
    fileSize: Number,
    fileFormat: String,
  },
}, { _id: false });

export const Ebook = Product.discriminator('ebook', EbookSchema);