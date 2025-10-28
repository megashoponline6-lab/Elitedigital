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
 * 🛡️ Middleware de autenticación admin
 * Evita accesos no autorizados al panel de gestión de cuentas.
 */
const ensureAdmin = (req, res, next) => {
  if (req.session?.user)
    return res.redirect('/panel?error=No tienes permiso para acceder aquí');
  if (!req.session?.admin)
    return res.redirect('/admin?error=Debes iniciar sesión como administrador');
  next();
};

/**
 * 📋 Rutas de gestión de cuentas (panel admin)
 * No libera cupos automáticamente al expirar suscripciones.
 */

// 🔹 Vista principal: listado de cuentas + formulario
router.get('/admin/cuentas', ensureAdmin, csrfProtection, view);

// 🔹 Crear nueva cuenta (correo, contraseña, cupos, etc.)
router.post('/admin/cuentas', ensureAdmin, csrfProtection, create);

// 🔹 Actualizar cuenta existente
router.post('/admin/cuentas/:id/update', ensureAdmin, csrfProtection, update);

// 🔹 Eliminar cuenta permanentemente
router.post('/admin/cuentas/:id/delete', ensureAdmin, csrfProtection, remove);

/**
 * 🚀 Exportación
 * Compatible con entorno ESM y despliegue en Render.
 */
export default router;
