// ✅ models/Platform.js — versión final con mensajes personalizados por duración y lista para Render

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

    // 🧾 Mensajes personalizados por duración (uno por cada tipo de plan)
    mensajes: {
      1: {
        type: String,
        default: 'Gracias por adquirir un plan de 1 mes. Disfruta tu tiempo en nuestra plataforma.',
      },
      3: {
        type: String,
        default: 'Tu acceso estará activo durante 3 meses. Aprovéchalo al máximo.',
      },
      6: {
        type: String,
        default: 'Plan de 6 meses adquirido. ¡Gracias por tu preferencia!',
      },
      12: {
        type: String,
        default: 'Plan anual activado. ¡Disfruta 12 meses de entretenimiento sin interrupciones!',
      },
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
