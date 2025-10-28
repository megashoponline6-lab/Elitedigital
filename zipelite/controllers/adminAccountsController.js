// ✅ controllers/adminAccountsController.js — versión final (Mongo puro, sin liberar cupos automáticamente)
import Account from '../models/Account.js';
import Platform from '../models/Platform.js';

/**
 * 📄 Vista principal — mostrar todas las cuentas registradas
 */
export const view = async (req, res) => {
  try {
    const platforms = await Platform.find({}).sort({ name: 1 }).lean();

    const { plataformaId, q } = req.query;
    const filter = {};
    if (plataformaId && plataformaId !== 'all') filter.plataformaId = plataformaId;
    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      filter.$or = [{ correo: regex }];
    }

    const accounts = await Account.find(filter)
      .populate('plataformaId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.render('admin/admin-accounts', {
      title: 'Gestión de Cuentas',
      platforms,
      accounts,
      filters: { plataformaId: plataformaId || 'all', q: q || '' },
      csrfToken: req.csrfToken(),
      errores: [],
    });
  } catch (err) {
    console.error('❌ Error al mostrar gestión de cuentas:', err);
    res.status(500).render('admin/admin-accounts', {
      title: 'Gestión de Cuentas',
      platforms: [],
      accounts: [],
      filters: { plataformaId: 'all', q: '' },
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      errores: [{ msg: 'Error interno al cargar cuentas.' }],
    });
  }
};

/**
 * ➕ Crear una nueva cuenta compartida
 */
export const create = async (req, res) => {
  try {
    const { plataformaId, correo, password, cupos } = req.body;
    if (!plataformaId || !correo || !password || !cupos) {
      return res.redirect('/admin/cuentas?error=Faltan campos obligatorios');
    }

    await Account.create({
      plataformaId,
      correo: correo.trim().toLowerCase(),
      password: password.trim(),
      cupos: Number(cupos),
      activa: true,
    });

    console.log(`✅ Cuenta creada: ${correo}`);
    res.redirect('/admin/cuentas?ok=Cuenta creada correctamente');
  } catch (err) {
    console.error('❌ Error al crear cuenta:', err);
    res.redirect('/admin/cuentas?error=Error al crear cuenta');
  }
};

/**
 * ✏️ Actualizar una cuenta existente
 */
export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { correo, password, cupos, activa } = req.body;

    const updated = await Account.findByIdAndUpdate(id, {
      ...(correo ? { correo: correo.trim().toLowerCase() } : {}),
      ...(password ? { password: password.trim() } : {}),
      ...(cupos ? { cupos: Number(cupos) } : {}),
      activa: activa === 'true' || activa === true,
    });

    if (!updated) return res.redirect('/admin/cuentas?error=Cuenta no encontrada');

    console.log(`🟡 Cuenta actualizada: ${correo || id}`);
    res.redirect('/admin/cuentas?ok=Cuenta actualizada correctamente');
  } catch (err) {
    console.error('❌ Error al actualizar cuenta:', err);
    res.redirect('/admin/cuentas?error=Error al actualizar cuenta');
  }
};

/**
 * 🗑️ Eliminar una cuenta
 */
export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Account.findByIdAndDelete(id);
    if (!deleted) return res.redirect('/admin/cuentas?error=Cuenta no encontrada');

    console.log(`🗑️ Cuenta eliminada: ${id}`);
    res.redirect('/admin/cuentas?ok=Cuenta eliminada correctamente');
  } catch (err) {
    console.error('❌ Error al eliminar cuenta:', err);
    res.redirect('/admin/cuentas?error=Error al eliminar cuenta');
  }
};

/**
 * 🎲 Seleccionar cuenta(s) aleatoria(s) al comprar — y descontar cupos
 * ⚠️ No libera cupos automáticamente cuando vence la suscripción.
 */
export const pickRandomAccounts = async (plataformaId, count = 1) => {
  try {
    // Buscar cuentas activas con cupos disponibles
    const pool = await Account.find({
      plataformaId,
      activa: true,
      cupos: { $gt: 0 },
    }).lean();

    if (!pool.length) return [];

    // Mezclar aleatoriamente (Fisher–Yates)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Seleccionar las cuentas necesarias (según el número solicitado)
    const selected = pool.slice(0, Math.min(count, pool.length));

    // Descontar cupos inmediatamente
    await Promise.all(
      selected.map(acc =>
        Account.updateOne({ _id: acc._id, cupos: { $gt: 0 } }, { $inc: { cupos: -1 } })
      )
    );

    console.log(`🎟️ ${selected.length} cuenta(s) asignada(s) aleatoriamente`);
    return selected;
  } catch (err) {
    console.error('❌ Error al asignar cuenta aleatoria:', err);
    return [];
  }
};
