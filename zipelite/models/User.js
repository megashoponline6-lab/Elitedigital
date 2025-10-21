import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  pais: { type: String, required: true },
  telefono: { type: String },
  correo: { type: String, required: true, unique: true },
  passhash: { type: String, required: true },
  saldo: { type: Number, default: 0 },
  activo: { type: Boolean, default: true },
  last_login: { type: Date },
  created_at: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);
