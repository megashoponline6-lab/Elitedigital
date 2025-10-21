// ✅ models/Account.js — Versión final lista para Render (ESM)
import mongoose from 'mongoose';

const AccountSchema = new mongoose.Schema(
  {
    // 🔗 Relación con la plataforma (Netflix, Spotify, etc.)
    platform: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Platform',
      required: true
    },

    // 📧 Correo de acceso de la cuenta
    email: {
      type: String,
      required: true,
      trim: true
    },

    // 🔒 Contraseña asociada a la cuenta
    password: {
      type: String,
      required: true
    },

    // 🎟️ Cupos disponibles (veces que puede asignarse)
    slots: {
      type: Number,
      required: true,
      min: 0
    },

    // ⚙️ Estado activo/inactivo
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true // 📅 Añade createdAt y updatedAt automáticamente
  }
);

// 📈 Índice compuesto para búsquedas rápidas por plataforma y correo
AccountSchema.index({ platform: 1, email: 1 });

// 🚀 Exportación para módulos ESM (Render / Node 18+)
const Account = mongoose.model('Account', AccountSchema);
export default Account;
