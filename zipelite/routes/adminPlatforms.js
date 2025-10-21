// ✅ routes/adminPlatforms.js — versión final lista para Render (ESM)
import express from 'express';
import multer from 'multer';
import csrf from 'csurf';
import {
  view,
  create,
  update,
  remove
} from '../controllers/adminPlatformsController.js';

const router = express.Router();
const upload = multer({ dest: 'public/uploads/' });
const csrfProtection = csrf({ cookie: true });

// 🧩 Middleware temporal de autenticación
const ensureAdmin = (req, res, next) => {
  // Más adelante podrás conectar esto con req.session.admin
  // if (!req.session?.admin) return res.redirect('/admin');
  next();
};

// 📋 Vista principal
router.get('/admin/plataformas', ensureAdmin, csrfProtection, view);

// ➕ Crear nueva plataforma
router.post('/admin/plataformas', ensureAdmin, csrfProtection, upload.single('logoimg'), create);

// 🔁 Actualizar logo o estado
router.post('/admin/plataformas/:id/update', ensureAdmin, csrfProtection, upload.single('logoimg'), update);

// ❌ Eliminar plataforma
router.post('/admin/plataformas/:id/delete', ensureAdmin, csrfProtection, remove);

export default router;
