// ✅ routes/adminPlatforms.js — versión sin guardado de imágenes, usa logos fijos en /public/img/plataformas
import express from 'express';
import csrf from 'csurf';
import cookieParser from 'cookie-parser';
import {
  view,
  create,
  update,
  remove
} from '../controllers/adminPlatformsController.js';

const router = express.Router();

// ✅ Configurar CSRF con cookies
const csrfProtection = csrf({ cookie: true });

// ✅ Agregar cookie-parser antes del CSRF
router.use(cookieParser());

// 🧩 Middleware temporal de autenticación (ajústalo según tu sesión admin)
const ensureAdmin = (req, res, next) => {
  // if (!req.session?.admin) return res.redirect('/admin');
  next();
};

// ==============================
// 📋 Vista principal
// ==============================
router.get('/admin/plataformas', ensureAdmin, csrfProtection, view);

// ➕ Crear nueva plataforma (sin multer)
router.post('/admin/plataformas', ensureAdmin, express.urlencoded({ extended: true }), csrfProtection, create);

// 🔁 Actualizar plataforma (sin multer)
router.post('/admin/plataformas/:id/update', ensureAdmin, express.urlencoded({ extended: true }), csrfProtection, update);

// ❌ Eliminar plataforma
router.post('/admin/plataformas/:id/delete', ensureAdmin, csrfProtection, remove);

export default router;
