// ✅ routes/adminAccounts.js — Versión final lista para Render (ESM)
import express from 'express';
import {
  view,
  create,
  update,
  remove
} from '../controllers/adminAccountsController.js';

const router = express.Router();

/**
 * 🛡️ Middleware de autenticación (temporal)
 * Más adelante se conectará con tu sistema real de sesiones/admin.
 */
const ensureAdmin = (req, res, next) => {
  // Si más adelante usas sesiones, aquí podrás validar el rol admin:
  // if (!req.session?.isAdmin) return res.redirect('/login');
  next();
};

/**
 * 📋 Rutas de gestión de cuentas
 */

// 🔹 Vista principal: listado + formulario
router.get('/admin/cuentas', ensureAdmin, view);

// 🔹 Crear nueva cuenta
router.post('/admin/cuentas', ensureAdmin, create);

// 🔹 Actualizar una cuenta existente
router.post('/admin/cuentas/:id/update', ensureAdmin, update);

// 🔹 Eliminar una cuenta
router.post('/admin/cuentas/:id/delete', ensureAdmin, remove);

/**
 * 🚀 Exportación por defecto
 * Compatible con Node ESM y Render.
 */
export default router;
