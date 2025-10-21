// routes/adminAccounts.js
const express = require('express');
const router = express.Router();
const adminAccounts = require('../controllers/adminAccountsController');

// Middleware temporal de autenticación (puedes reemplazarlo luego)
const ensureAdmin = (req, res, next) => {
  // Aquí puedes validar sesión si tienes login de admin
  // Por ahora dejamos que todos los accedan para desarrollo
  next();
};

// Mostrar la tabla de gestión de cuentas
router.get('/admin/cuentas', ensureAdmin, adminAccounts.view);

// Crear nueva cuenta
router.post('/admin/cuentas', ensureAdmin, adminAccounts.create);

// Actualizar cuenta existente
router.post('/admin/cuentas/:id/update', ensureAdmin, adminAccounts.update);

// Eliminar cuenta
router.post('/admin/cuentas/:id/delete', ensureAdmin, adminAccounts.remove);

module.exports = router;
