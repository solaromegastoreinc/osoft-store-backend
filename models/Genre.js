// backend/models/Genre.js
import mongoose from 'mongoose';

const genreSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  bannerImageUrl: { // This is for the large banner at the top of the page
    type: String,
    default: '',
  },
  cardImageUrl: { // This is for the small, circular image in the slider
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

export default mongoose.model('Genre', genreSchema);