// ✅ models/Platform.js — versión final con gestión de precios mensuales lista para Render

import mongoose from 'mongoose';

// 📦 Esquema de plataforma (usado en panel admin y panel cliente)
const PlatformSchema = new mongoose.Schema(
  {
    // 🔤 Nombre visible de la plataforma (Netflix, Disney+, etc.)
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // 🖼️ Ruta o URL del logo (ej: /img/plataformas/netflix.png)
    logoUrl: {
      type: String,
      default: '',
    },

    // 🟢 Estado de disponibilidad (visible o no para el cliente)
    available: {
      type: Boolean,
      default: true,
    },

    // 💰 Precios por plan mensual (editable desde el panel admin)
    // Claves fijas: 1, 3, 6 y 12 meses
    precios: {
      1: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      6: { type: Number, default: 0 },
      12: { type: Number, default: 0 },
    },

    // 💵 Precio base opcional (por si deseas usarlo como referencia global)
    precioBase: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // 📅 Guarda createdAt y updatedAt automáticamente
  }
);

// ✅ Compilación segura (evita error “Cannot overwrite model once compiled” en Render)
const Platform =
  mongoose.models.Platform || mongoose.model('Platform', PlatformSchema);

export default Platform;
