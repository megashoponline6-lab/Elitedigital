// ✅ models/Subscription.js — versión corregida (incluye mensaje de pantalla)
import mongoose from 'mongoose';

// 🧾 Subdocumento con los datos de acceso
const datosCuentaSchema = new mongoose.Schema({
  correo: { type: String },
  password: { type: String },
  mensaje: { type: String, default: '' }, // ✅ ← CLAVE: ahora sí se guarda el texto "Pantalla 1"
});

// 📦 Esquema de suscripciones (cuando un usuario compra una plataforma)
const subscriptionSchema = new mongoose.Schema(
  {
    // 🔗 Usuario que hizo la compra
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // 🎬 Plataforma adquirida
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

    // 📅 Fechas
    fechaInicio: { type: Date, default: Date.now },
    fechaFin: { type: Date },

    // 🟢 Estado
    activa: { type: Boolean, default: true },

    // 🧾 Datos de cuenta con correo, password y mensaje (pantalla asignada)
    datosCuenta: { type: datosCuentaSchema, required: true },
  },
  { timestamps: true }
);

// ✅ Evita error de modelo duplicado en Render
const Subscription =
  mongoose.models.Subscription ||
  mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
