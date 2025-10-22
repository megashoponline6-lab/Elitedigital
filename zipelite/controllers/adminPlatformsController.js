// ✅ controllers/adminPlatformsController.js — versión final Mongo pura + CSRF
import Platform from '../models/Platform.js';
import Account from '../models/Account.js';
import fs from 'fs';
import path from 'path';

export const view = async (req, res) => {
  try {
    const platforms = await Platform.find({}).sort({ createdAt: -1 }).lean();
    res.render('admin/admin-platforms', {
      title: 'Gestión de Plataformas',
      platforms,
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      errores: []
    });
  } catch (err) {
    console.error('❌ Error al cargar plataformas:', err);
    res.status(500).render('admin/admin-platforms', {
      title: 'Gestión de Plataformas',
      platforms: [],
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      errores: [{ msg: 'Error al cargar las plataformas.' }]
    });
  }
};

export const create = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.redirect('/admin/plataformas?error=Falta el nombre');

    let logoUrl = '';
    if (req.file) {
      const fileName = Date.now() + '-' + req.file.originalname;
      const dest = path.join('public', 'uploads', fileName);
      fs.renameSync(req.file.path, dest);
      logoUrl = '/public/uploads/' + fileName;
    }

    await Platform.create({ name, logoUrl, available: true });
    console.log(`✅ Plataforma creada: ${name}`);
    res.redirect('/admin/plataformas?ok=Plataforma creada correctamente');
  } catch (err) {
    console.error('❌ Error al crear plataforma:', err);
    res.redirect('/admin/plataformas?error=Error al crear la plataforma');
  }
};

export const update = async (req, res) => {
  try {
    const platform = await Platform.findById(req.params.id);
    if (!platform) return res.redirect('/admin/plataformas?error=No encontrada');

    if (req.file) {
      const fileName = Date.now() + '-' + req.file.originalname;
      const dest = path.join('public', 'uploads', fileName);
      fs.renameSync(req.file.path, dest);
      platform.logoUrl = '/public/uploads/' + fileName;
    }

    // (Si en el futuro agregas toggle de available)
    if (typeof req.body.available !== 'undefined') {
      platform.available = req.body.available === 'true';
    }

    await platform.save();
    console.log(`🟡 Plataforma actualizada: ${platform.name}`);
    res.redirect('/admin/plataformas?ok=Plataforma actualizada');
  } catch (err) {
    console.error('❌ Error al actualizar plataforma:', err);
    res.redirect('/admin/plataformas?error=Error al actualizar');
  }
};

export const remove = async (req, res) => {
  try {
    const platform = await Platform.findById(req.params.id);
    if (!platform) return res.redirect('/admin/plataformas?error=No encontrada');

    // Eliminar logo físico si existe
    if (platform.logoUrl) {
      const filePath = path.join(process.cwd(), platform.logoUrl.replace('/public/', 'public/'));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    // 🔥 Borrado en cascada de cuentas asociadas
    await Account.deleteMany({ platform: platform._id });

    await Platform.deleteOne({ _id: platform._id });
    console.log(`🗑️ Plataforma eliminada: ${platform.name} (y sus cuentas asociadas)`);
    res.redirect('/admin/plataformas?ok=Plataforma eliminada');
  } catch (err) {
    console.error('❌ Error al eliminar plataforma:', err);
    res.redirect('/admin/plataformas?error=Error al eliminar');
  }
};
