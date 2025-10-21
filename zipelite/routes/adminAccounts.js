// ✅ routes/adminAccounts.js — Versión final lista para Render (ESM)
import express from 'express';
import csrf from 'csurf';
import {
  view,
  create,
  update,
  remove
} from '../controllers/adminAccountsController.js';

const router = express.Router();
const csrfProtection = csrf({ cookie: true });

/**
 * 🛡️ Middleware de autenticación (temporal)
 * Más adelante se conectará con tu sistema real de sesiones/admin.
 */
const ensureAdmin = (req, res, next) => {
  // Si más adelante usas sesiones, aquí podrás validar el rol admin:
  // if (!req.session?.admin) return res.redirect('/admin');
  next();
};

/**
 * 📋 Rutas de gestión de cuentas
 */

// 🔹 Vista principal: listado + formulario
router.get('/admin/cuentas', ensureAdmin, csrfProtection, view);

// 🔹 Crear nueva cuenta
router.post('/admin/cuentas', ensureAdmin, csrfProtection, create);

// 🔹 Actualizar una cuenta existente
router.post('/admin/cuentas/:id/update', ensureAdmin, csrfProtection, update);

// 🔹 Eliminar una cuenta
router.post('/admin/cuentas/:id/delete', ensureAdmin, csrfProtection, remove);

/**
 * 🚀 Exportación por defecto
 * Compatible con Node ESM y Render.
 */
export default router;
