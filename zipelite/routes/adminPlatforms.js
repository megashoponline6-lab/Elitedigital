// ✅ routes/adminPlatforms.js — versión final con edición de precios, mensajes personalizados y lista para Render

import express from 'express';
import csrf from 'csurf';
import cookieParser from 'cookie-parser';
import Platform from '../models/Platform.js';

const router = express.Router();
const csrfProtection = csrf({ cookie: true });
router.use(cookieParser());

// 🧩 Middleware de autenticación de admin
function requireAdmin(req, res, next) {
  if (req.session?.user)
    return res.redirect('/panel?error=No tienes permiso para entrar aquí');
  if (!req.session?.admin)
    return res.redirect('/admin?error=Debes iniciar sesión como administrador');
  next();
}

// ==============================
// 📋 Vista principal de plataformas
// ==============================
router.get('/admin/plataformas', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const platforms = await Platform.find({}).sort({ name: 1 }).lean();
    res.render('admin/admin-platforms', {
      csrfToken: req.csrfToken(),
      platforms,
      ok: req.query.ok || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error('❌ Error cargando plataformas:', err);
    res.redirect('/admin/panel?error=Error al cargar las plataformas');
  }
});

// ==============================
// ➕ Crear nueva plataforma
// ==============================
router.post(
  '/admin/plataformas',
  requireAdmin,
  express.urlencoded({ extended: true }),
  csrfProtection,
  async (req, res) => {
    try {
      const { name, logoUrl } = req.body;
      if (!name?.trim())
        return res.redirect('/admin/plataformas?error=El nombre es obligatorio');

      await Platform.create({
        name: name.trim(),
        logoUrl: (logoUrl || '').trim(),
        available: true,
        precios: { 1: 0, 3: 0, 6: 0, 12: 0 },
        mensajes: {
          1: 'Gracias por adquirir un plan de 1 mes. Disfruta tu tiempo en nuestra plataforma.',
          3: 'Tu acceso estará activo durante 3 meses. Aprovéchalo al máximo.',
          6: 'Plan de 6 meses adquirido. ¡Gracias por tu preferencia!',
          12: 'Plan anual activado. ¡Disfruta 12 meses de entretenimiento sin interrupciones!',
        },
      });

      res.redirect('/admin/plataformas?ok=Plataforma creada correctamente');
    } catch (err) {
      console.error('❌ Error al crear plataforma:', err);
      res.redirect('/admin/plataformas?error=No se pudo crear la plataforma');
    }
  }
);

// ==============================
// 🔁 Actualizar logo o ruta
// ==============================
router.post(
  '/admin/plataformas/:id/update',
  requireAdmin,
  express.urlencoded({ extended: true }),
  csrfProtection,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { logoUrl } = req.body;

      await Platform.updateOne(
        { _id: id },
        { $set: { logoUrl: (logoUrl || '').trim() } }
      );

      res.redirect('/admin/plataformas?ok=Logo actualizado correctamente');
    } catch (err) {
      console.error('❌ Error al actualizar logo:', err);
      res.redirect('/admin/plataformas?error=No se pudo actualizar el logo');
    }
  }
);

// ==============================
// 💰 Actualizar precios y mensajes personalizados
// ==============================
router.post(
  '/admin/plataformas/:id/precios',
  requireAdmin,
  express.urlencoded({ extended: true }),
  csrfProtection,
  async (req, res) => {
    try {
      const { id } = req.params;

      // 💰 Actualizar precios
      const precios = {
        1: parseFloat(req.body.mes1) || 0,
        3: parseFloat(req.body.mes3) || 0,
        6: parseFloat(req.body.mes6) || 0,
        12: parseFloat(req.body.mes12) || 0,
      };

      // 🧾 Actualizar mensajes personalizados
      const mensajes = {
        1: req.body.msg1?.trim() || '',
        3: req.body.msg3?.trim() || '',
        6: req.body.msg6?.trim() || '',
        12: req.body.msg12?.trim() || '',
      };

      await Platform.updateOne(
        { _id: id },
        { $set: { precios, mensajes } }
      );

      res.redirect('/admin/plataformas?ok=Precios y mensajes actualizados correctamente');
    } catch (err) {
      console.error('❌ Error al actualizar precios o mensajes:', err);
      res.redirect('/admin/plataformas?error=No se pudieron guardar los cambios');
    }
  }
);

// ==============================
// ❌ Eliminar plataforma
// ==============================
router.post(
  '/admin/plataformas/:id/delete',
  requireAdmin,
  csrfProtection,
  async (req, res) => {
    try {
      await Platform.deleteOne({ _id: req.params.id });
      res.redirect('/admin/plataformas?ok=Plataforma eliminada correctamente');
    } catch (err) {
      console.error('❌ Error al eliminar plataforma:', err);
      res.redirect('/admin/plataformas?error=No se pudo eliminar la plataforma');
    }
  }
);

export default router;
