// ✅ models/Platform.js — versión con gestión de precios mensuales lista para Render
import mongoose from 'mongoose';

const PlatformSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    logoUrl: {
      type: String,
      default: '',
    },
    available: {
      type: Boolean,
      default: true,
    },
    // 💰 Precios por mes (editable desde el panel admin)
    precios: {
      1: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      6: { type: Number, default: 0 },
      12: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

const Platform = mongoose.model('Platform', PlatformSchema);
export default Platform;
