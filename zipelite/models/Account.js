// ✅ models/Account.js — Versión final con suscripciones funcionales
import mongoose from 'mongoose';

const AccountSchema = new mongoose.Schema(
  {
    // 🔗 Plataforma asociada (Netflix, Disney+, etc.)
    platform: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Platform',
      required: true
    },

    // 📧 Correo del usuario que adquirió el plan
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // 🕐 Meses de duración
    meses: {
      type: Number,
      required: true
    },

    // 💰 Precio pagado por el usuario
    precioPagado: {
      type: Number,
      required: true
    },

    // 📅 Fecha de vencimiento
    vence_en: {
      type: Date,
      required: true
    },

    // 🔒 Estado de la suscripción
    activo: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

AccountSchema.index({ userId: 1, platform: 1 });

const Account = mongoose.model('Account', AccountSchema);
export default Account;
