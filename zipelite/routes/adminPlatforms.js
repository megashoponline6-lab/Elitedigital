// ✅ routes/adminPlatforms.js — versión final lista para Render (ESM)
import express from 'express';
import multer from 'multer';
import {
  view,
  create,
  update,
  remove
} from '../controllers/adminPlatformsController.js';

const router = express.Router();
const upload = multer({ dest: 'public/uploads/' });

// 🧩 Middleware temporal de autenticación
const ensureAdmin = (req, res, next) => {
  // Más adelante podrás conectar esto con req.session.admin
  next();
};

// 📋 Vista principal
router.get('/admin/plataformas', ensureAdmin, view);

// ➕ Crear nueva plataforma
router.post('/admin/plataformas', ensureAdmin, upload.single('logoimg'), create);

// 🔁 Actualizar logo o estado
router.post('/admin/plataformas/:id/update', ensureAdmin, upload.single('logoimg'), update);

// ❌ Eliminar plataforma
router.post('/admin/plataformas/:id/delete', ensureAdmin, remove);

export default router;
