// ✅ controllers/adminPlatformsController.js — versión final lista para Render
import Platform from '../models/Platform.js';
import fs from 'fs';
import path from 'path';

// 📋 Mostrar todas las plataformas
export const view = async (req, res) => {
  try {
    const platforms = await Platform.find({}).sort({ createdAt: -1 }).lean();
    res.render('admin/admin-platforms', {
      title: 'Gestión de Plataformas',
      platforms,
      csrfToken: req.csrfToken(),
      errores: [] // ✅ evita ReferenceError
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

// ➕ Crear nueva plataforma
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

    await Platform.create({
      name,
      logoUrl,
      available: true
    });

    res.redirect('/admin/plataformas?ok=Plataforma creada correctamente');
  } catch (err) {
    console.error('❌ Error al crear plataforma:', err);
    res.redirect('/admin/plataformas?error=Error al crear la plataforma');
  }
};

// 🔁 Actualizar logo o estado
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

    await platform.save();
    res.redirect('/admin/plataformas?ok=Logo actualizado');
  } catch (err) {
    console.error('❌ Error al actualizar plataforma:', err);
    res.redirect('/admin/plataformas?error=Error al actualizar');
  }
};

// ❌ Eliminar plataforma
export const remove = async (req, res) => {
  try {
    const platform = await Platform.findById(req.params.id);
    if (!platform) return res.redirect('/admin/plataformas?error=No encontrada');

    // Eliminar logo físico si existe
    if (platform.logoUrl) {
      const filePath = path.join(process.cwd(), platform.logoUrl.replace('/public/', 'public/'));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await Platform.deleteOne({ _id: req.params.id });
    res.redirect('/admin/plataformas?ok=Plataforma eliminada');
  } catch (err) {
    console.error('❌ Error al eliminar plataforma:', err);
    res.redirect('/admin/plataformas?error=Error al eliminar');
  }
};
