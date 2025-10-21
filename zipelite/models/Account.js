// ✅ models/Account.js — versión ESM lista para Render
import mongoose from 'mongoose';

const AccountSchema = new mongoose.Schema(
  {
    platform: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Platform',
      required: true
    },
    email: {
      type: String,
      required: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    slots: {
      type: Number,
      required: true,
      min: 0
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Índice para búsquedas rápidas por plataforma y correo
AccountSchema.index({ platform: 1, email: 1 });

// Exportación correcta para módulos ESM
const Account = mongoose.model('Account', AccountSchema);
export default Account;
