// ✅ models/Account.js — versión final con rotación ordenada de cupos
import mongoose from 'mongoose';

const AccountSchema = new mongoose.Schema(
  {
    // 🎬 Plataforma asociada (Netflix, Disney+, YouTube, etc.)
    plataformaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Platform',
      required: true,
    },

    // 📧 Credenciales de la cuenta compartida
    correo: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      trim: true,
    },

    // 👥 Cupos disponibles (por ejemplo, Netflix con 4 cupos)
    cupos: {
      type: Number,
      required: true,
      min: 0,
    },

    // ⚙️ Estado de la cuenta (activa o pausada)
    activa: {
      type: Boolean,
      default: true,
    },

    // 🔁 Control de rotación (para usar la menos reciente primero)
    lastUsed: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// 🔎 Índice para búsquedas rápidas por plataforma y correo
AccountSchema.index({ plataformaId: 1, correo: 1 });

// ✅ Evita error de modelo duplicado en Render/Vercel
const Account =
  mongoose.models.Account || mongoose.model('Account', AccountSchema);

export default Account;
