// ✅ models/Account.js — versión final y funcional con cupos automáticos
import mongoose from 'mongoose';

const AccountSchema = new mongoose.Schema(
  {
    // 🎬 Plataforma asociada (Netflix, Disney+, etc.)
    plataformaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Platform',
      required: true,
    },

    // 📧 Correo y contraseña de la cuenta compartida
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

    // 👥 Cupos disponibles (ej: Netflix con 4 cupos)
    cupos: {
      type: Number,
      required: true,
      min: 0,
    },

    // 📋 Estado de la cuenta (activa o pausada)
    activa: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// 🔎 Índice para mejorar búsquedas por plataforma
AccountSchema.index({ plataformaId: 1, correo: 1 });

// ✅ Evita error de modelo duplicado en entornos tipo Render o Vercel
const Account =
  mongoose.models.Account || mongoose.model('Account', AccountSchema);

export default Account;
