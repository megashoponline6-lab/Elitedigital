// ✅ models/Admin.js — versión final lista para Render (ESM)
import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema(
  {
    usuario: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passhash: {
      type: String,
      required: true,
    },
    activo: {
      type: Boolean,
      default: true,
    },
    rol: {
      type: String,
      enum: ['superadmin', 'admin'],
      default: 'admin',
    },
  },
  { timestamps: true }
);

const Admin = mongoose.model('Admin', AdminSchema);
export default Admin;
