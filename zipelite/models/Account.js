// ✅ models/Account.js — versión extendida con mensajes por cupo
import mongoose from 'mongoose';

// 🎟️ Subesquema de cupo individual
const cupoSchema = new mongoose.Schema({
  numero: { type: Number, required: true }, // Ej: 1, 2, 3, 4, 5
  disponible: { type: Boolean, default: true },
  mensaje: { type: String, default: '' } // Ej: "Pantalla 1"
});

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

    // 👥 Cupos de la cuenta (con mensajes personalizados)
    cupos: {
      type: [cupoSchema],
      default: [],
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
