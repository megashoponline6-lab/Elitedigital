// ✅ routes/adminAccounts.js (versión compatible con ES Modules)
import express from 'express';
import { view, create, update, remove } from '../controllers/adminAccountsController.js';

const router = express.Router();

// 🧩 Middleware temporal de autenticación (solo para desarrollo)
const ensureAdmin = (req, res, next) => {
  // Más adelante puedes conectar esto con tu sesión de admin real
  next();
};

// 📋 Mostrar la tabla de gestión de cuentas
router.get('/admin/cuentas', ensureAdmin, view);

// ➕ Crear nueva cuenta
router.post('/admin/cuentas', ensureAdmin, create);

// 🔁 Actualizar cuenta existente
router.post('/admin/cuentas/:id/update', ensureAdmin, update);

// ❌ Eliminar cuenta
router.post('/admin/cuentas/:id/delete', ensureAdmin, remove);

// ✅ Exportación por defecto (necesaria para Render)
export default router;
