// ✅ routes/adminPlatforms.js — versión final 100% compatible con Render (ESM)
import express from 'express';
import multer from 'multer';
import csrf from 'csurf';
import cookieParser from 'cookie-parser'; // ✅ Necesario si usas cookie-based CSRF
import {
  view,
  create,
  update,
  remove
} from '../controllers/adminPlatformsController.js';

const router = express.Router();
const upload = multer({ dest: 'public/uploads/' });

// ✅ Configurar CSRF con cookies
const csrfProtection = csrf({ cookie: true });

// ✅ Agregar cookie-parser antes del CSRF
router.use(cookieParser());

// 🧩 Middleware temporal de autenticación
const ensureAdmin = (req, res, next) => {
  // Más adelante podrás conectar esto con req.session.admin
  // if (!req.session?.admin) return res.redirect('/admin');
  next();
};

// ==============================
// 📋 Vista principal
// ==============================
router.get('/admin/plataformas', ensureAdmin, csrfProtection, view);

// ➕ Crear nueva plataforma
router.post('/admin/plataformas', ensureAdmin, upload.single('logoimg'), csrfProtection, create);

// 🔁 Actualizar logo o estado
router.post('/admin/plataformas/:id/update', ensureAdmin, upload.single('logoimg'), csrfProtection, update);

// ❌ Eliminar plataforma
router.post('/admin/plataformas/:id/delete', ensureAdmin, csrfProtection, remove);

export default router;
