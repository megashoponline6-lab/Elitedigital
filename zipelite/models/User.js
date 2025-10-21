// ✅ models/User.js
// Modelo oficial de usuarios para Eliteflix (MongoDB Atlas)
// Guarda usuarios de forma permanente y se integra con el server.js actual

import mongoose from "mongoose";

// 🧩 Esquema del usuario
const userSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, "El nombre es obligatorio"],
      trim: true,
    },
    apellido: {
      type: String,
      required: [true, "El apellido es obligatorio"],
      trim: true,
    },
    pais: {
      type: String,
      required: [true, "El país es obligatorio"],
      trim: true,
    },
    telefono: {
      type: String,
      default: "",
      trim: true,
    },
    correo: {
      type: String,
      required: [true, "El correo es obligatorio"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/.+\@.+\..+/, "Correo inválido"],
    },
    passhash: {
      type: String,
      required: [true, "La contraseña es obligatoria"],
    },
    saldo: {
      type: Number,
      default: 0,
      min: [0, "El saldo no puede ser negativo"],
    },
    activo: {
      type: Boolean,
      default: true,
    },
    last_login: {
      type: Date,
      default: null,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // agrega createdAt y updatedAt automáticos
    collection: "users", // fuerza el nombre exacto de la colección
  }
);

// 🔍 Índice para mejorar búsqueda por correo
userSchema.index({ correo: 1 });

// 🚀 Exportar modelo
export default mongoose.models.User || mongoose.model("User", userSchema);
