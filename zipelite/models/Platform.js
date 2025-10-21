// ✅ models/Platform.js — versión ESM lista para Render
import mongoose from 'mongoose';

const PlatformSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    logoUrl: {
      type: String,
      default: ''
    },
    available: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Exportación correcta para módulos ESM
const Platform = mongoose.model('Platform', PlatformSchema);
export default Platform;
