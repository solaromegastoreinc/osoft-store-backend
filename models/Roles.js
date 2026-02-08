// File: backend/models/Roles.js
import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema({
  name: { type: String, enum: ['admin', 'limited_admin'], required: true },
  permissions: [{ type: String }],
});

export default mongoose.model('Role', roleSchema);
