// ✅ routes/adminAccounts.js — Versión final lista para Render (ESM)

import express from 'express';
import csrf from 'csurf';
import {
  view,
  create,
  update,
  remove
} from '../controllers/adminAccountsController.js';
import Account from '../models/Account.js'; // ✅ Import necesario para toggle

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

// 🔹 Activar / desactivar cuenta (toggle)
router.post('/admin/cuentas/:id/toggle', ensureAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const cuenta = await Account.findById(id);
    if (!cuenta) return res.redirect('/admin/cuentas?error=Cuenta no encontrada');

    cuenta.activa = !cuenta.activa;
    await cuenta.save();

    console.log(`🔁 Cuenta ${cuenta.correo} ahora ${cuenta.activa ? 'ACTIVA' : 'INACTIVA'}`);
    res.redirect(`/admin/cuentas?ok=Cuenta ${cuenta.activa ? 'activada' : 'desactivada'} correctamente`);
  } catch (err) {
    console.error('❌ Error al alternar estado de cuenta:', err);
    res.redirect('/admin/cuentas?error=Error al cambiar estado');
  }
});

/**
 * 🚀 Exportación
 * Compatible con entorno ESM y despliegue en Render.
 */
export default router;
