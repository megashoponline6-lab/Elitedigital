// ✅ controllers/adminPlatformsController.js — versión final lista para Render (MongoDB + ESM)
import Platform from '../models/Platform.js';
import path from 'path';
import fs from 'fs';

/**
 * 📄 Vista principal de gestión de plataformas
 */
export const view = async (req, res) => {
  try {
    const platforms = await Platform.find({}).sort({ createdAt: -1 }).lean();
    res.render('admin/admin-platforms', {
      title: 'Gestión de Plataformas',
      platforms
    });
  } catch (err) {
    console.error('❌ Error al mostrar plataformas:', err);
    res.status(500).send('Error cargando plataformas');
  }
};

/**
 * ➕ Crear nueva plataforma
 */
export const create = async (req, res) => {
  try {
    const { name } = req.body;
    let logoUrl = '';

    if (!name) return res.status(400).send('El nombre es obligatorio');

    // Subir imagen si existe
    if (req.file) {
      const fileName = `logo_${Date.now()}_${req.file.originalname}`;
      const destPath = path.join('public', 'uploads', fileName);
      fs.renameSync(req.file.path, destPath);
      logoUrl = `/public/uploads/${fileName}`;
    }

    await Platform.create({ name, logoUrl });
    console.log(`✅ Plataforma creada: ${name}`);
    res.redirect('/admin/plataformas');
  } catch (err) {
    console.error('❌ Error al crear plataforma:', err);
    res.status(500).send('No se pudo crear la plataforma');
  }
};

/**
 * ✏️ Actualizar logo o estado
 */
export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { available } = req.body;
    const updateData = {};

    if (req.file) {
      const fileName = `logo_${Date.now()}_${req.file.originalname}`;
      const destPath = path.join('public', 'uploads', fileName);
      fs.renameSync(req.file.path, destPath);
      updateData.logoUrl = `/public/uploads/${fileName}`;
    }

    if (available !== undefined) updateData.available = available === 'true';

    await Platform.findByIdAndUpdate(id, updateData);
    console.log(`🟡 Plataforma actualizada: ${id}`);
    res.redirect('/admin/plataformas');
  } catch (err) {
    console.error('❌ Error al actualizar plataforma:', err);
    res.status(500).send('No se pudo actualizar la plataforma');
  }
};

/**
 * 🗑️ Eliminar plataforma
 */
export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await Platform.findByIdAndDelete(id);
    console.log(`🗑️ Plataforma eliminada: ${id}`);
    res.redirect('/admin/plataformas');
  } catch (err) {
    console.error('❌ Error al eliminar plataforma:', err);
    res.status(500).send('No se pudo eliminar la plataforma');
  }
};
