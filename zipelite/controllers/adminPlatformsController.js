// ✅ controllers/adminPlatformsController.js — versión final y funcional
import Platform from '../models/Platform.js';
import Account from '../models/Account.js';

/**
 * 📋 Mostrar todas las plataformas
 */
export const view = async (req, res) => {
  try {
    const platforms = await Platform.find({}).sort({ createdAt: -1 }).lean();

    res.render('admin/admin-platforms', {
      title: 'Gestión de Plataformas',
      platforms,
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      errores: [],
    });
  } catch (err) {
    console.error('❌ Error al cargar plataformas:', err);
    res.status(500).render('admin/admin-platforms', {
      title: 'Gestión de Plataformas',
      platforms: [],
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      errores: [{ msg: 'Error al cargar las plataformas.' }],
    });
  }
};

/**
 * ➕ Crear plataforma (normaliza ruta del logo)
 */
export const create = async (req, res) => {
  try {
    const { name, logoUrl } = req.body;
    if (!name) return res.redirect('/admin/plataformas?error=Falta el nombre');

    // 🧩 Normalizar ruta del logo
    let finalLogoUrl = (logoUrl || '').trim();

    if (!finalLogoUrl) {
      finalLogoUrl = '/img/plataformas/default.png';
    } else {
      // Si empieza con "public/", lo reemplazamos por "/"
      if (finalLogoUrl.startsWith('public/')) {
        finalLogoUrl = finalLogoUrl.replace(/^public\//, '/');
      }

      // Si no empieza con "/", se lo agregamos
      if (!finalLogoUrl.startsWith('/')) {
        finalLogoUrl = '/' + finalLogoUrl;
      }
    }

    await Platform.create({ name, logoUrl: finalLogoUrl, available: true });
    console.log(`✅ Plataforma creada: ${name} (${finalLogoUrl})`);
    res.redirect('/admin/plataformas?ok=Plataforma creada correctamente');
  } catch (err) {
    console.error('❌ Error al crear plataforma:', err);
    res.redirect('/admin/plataformas?error=Error al crear la plataforma');
  }
};

/**
 * 🔁 Actualizar plataforma (normaliza ruta del logo)
 */
export const update = async (req, res) => {
  try {
    const platform = await Platform.findById(req.params.id);
    if (!platform) return res.redirect('/admin/plataformas?error=No encontrada');

    // Actualizar logo si se envía uno nuevo
    if (req.body.logoUrl && req.body.logoUrl.trim() !== '') {
      let newLogo = req.body.logoUrl.trim();

      // Normalizar ruta igual que en "create"
      if (newLogo.startsWith('public/')) {
        newLogo = newLogo.replace(/^public\//, '/');
      }
      if (!newLogo.startsWith('/')) {
        newLogo = '/' + newLogo;
      }

      platform.logoUrl = newLogo;
    }

    // Actualizar disponibilidad si aplica
    if (typeof req.body.available !== 'undefined') {
      platform.available = req.body.available === 'true' || req.body.available === 'on';
    }

    await platform.save();
    console.log(`🟡 Plataforma actualizada: ${platform.name} (${platform.logoUrl})`);
    res.redirect('/admin/plataformas?ok=Plataforma actualizada');
  } catch (err) {
    console.error('❌ Error al actualizar plataforma:', err);
    res.redirect('/admin/plataformas?error=Error al actualizar');
  }
};

/**
 * ❌ Eliminar plataforma (y sus cuentas asociadas)
 */
export const remove = async (req, res) => {
  try {
    const platform = await Platform.findById(req.params.id);
    if (!platform) return res.redirect('/admin/plataformas?error=No encontrada');

    // Borrar cuentas asociadas
    await Account.deleteMany({ platform: platform._id });

    // Borrar la plataforma
    await Platform.deleteOne({ _id: platform._id });
    console.log(`🗑️ Plataforma eliminada: ${platform.name} (y sus cuentas asociadas)`);
    res.redirect('/admin/plataformas?ok=Plataforma eliminada');
  } catch (err) {
    console.error('❌ Error al eliminar plataforma:', err);
    res.redirect('/admin/plataformas?error=Error al eliminar');
  }
};
