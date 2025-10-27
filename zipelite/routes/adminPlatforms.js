// ✅ routes/adminPlatforms.js — versión con edición de precios de plataformas
import express from 'express';
import csrf from 'csurf';
import cookieParser from 'cookie-parser';
import {
  view,
  create,
  update,
  remove,
} from '../controllers/adminPlatformsController.js';
import Platform from '../models/Platform.js';

const router = express.Router();
const csrfProtection = csrf({ cookie: true });
router.use(cookieParser());

// 🧩 Middleware temporal (ajusta si usas sesión admin real)
const ensureAdmin = (req, res, next) => {
  // if (!req.session?.admin) return res.redirect('/admin');
  next();
};

// ==============================
// 📋 Vista principal
// ==============================
router.get('/admin/plataformas', ensureAdmin, csrfProtection, view);

// ➕ Crear nueva plataforma
router.post('/admin/plataformas', ensureAdmin, express.urlencoded({ extended: true }), csrfProtection, create);

// 🔁 Actualizar logo / ruta
router.post('/admin/plataformas/:id/update', ensureAdmin, express.urlencoded({ extended: true }), csrfProtection, update);

// 💰 Actualizar precios (1, 3, 6, 12 meses)
router.post('/admin/plataformas/:id/precios', ensureAdmin, express.urlencoded({ extended: true }), csrfProtection, async (req, res) => {
  try {
    const { id } = req.params;
    const precios = {
      1: parseFloat(req.body.mes1) || 0,
      3: parseFloat(req.body.mes3) || 0,
      6: parseFloat(req.body.mes6) || 0,
      12: parseFloat(req.body.mes12) || 0,
    };
    await Platform.updateOne({ _id: id }, { $set: { precios } });
    res.redirect('/admin/plataformas?ok=Precios actualizados correctamente');
  } catch (err) {
    console.error('❌ Error al actualizar precios:', err);
    res.redirect('/admin/plataformas?error=No se pudieron guardar los precios');
  }
});

// ❌ Eliminar plataforma
router.post('/admin/plataformas/:id/delete', ensureAdmin, csrfProtection, remove);

export default router;
