// ✅ models/Subscription.js — versión final y funcional para registrar compras de usuarios

import mongoose from 'mongoose';

// 📦 Esquema de suscripciones (cuando un usuario compra una plataforma)
const subscriptionSchema = new mongoose.Schema(
  {
    // 🔗 Usuario que hizo la compra
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // 🎬 Plataforma adquirida (Netflix, Disney+, etc.)
    platformId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Platform',
      required: true,
    },

    // ⏳ Duración en meses
    meses: {
      type: Number,
      required: true,
      min: 1,
    },

    // 💰 Precio pagado
    precio: {
      type: Number,
      required: true,
      min: 0,
    },

    // 📅 Fecha de inicio y fin de la suscripción
    fechaInicio: {
      type: Date,
      default: Date.now,
    },
    fechaFin: {
      type: Date,
    },

    // 🟢 Estado actual (por si luego querés desactivar automáticamente)
    activa: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// ✅ Evita error de modelo duplicado en Render
const Subscription =
  mongoose.models.Subscription ||
  mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
