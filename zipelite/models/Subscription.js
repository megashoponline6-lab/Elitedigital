// ✅ models/Subscription.js — versión completa y funcional con datos de cuenta asignada

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

    // 📅 Fechas de inicio y fin
    fechaInicio: {
      type: Date,
      default: Date.now,
    },
    fechaFin: {
      type: Date,
    },

    // 🟢 Estado actual de la suscripción
    activa: {
      type: Boolean,
      default: true,
    },

    // 🧾 Datos de la cuenta asignada (Netflix, Disney+, etc.)
    datosCuenta: {
      correo: { type: String },
      password: { type: String },
    },
  },
  { timestamps: true }
);

// ✅ Evita error de modelo duplicado en entornos como Render
const Subscription =
  mongoose.models.Subscription ||
  mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
