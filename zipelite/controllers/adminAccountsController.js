// ✅ controllers/adminAccountsController.js (versión ESM lista para Render)
import Account from '../models/Account.js';
import Platform from '../models/Platform.js';

/**
 * Muestra la vista principal de gestión de cuentas
 */
export const view = async (req, res) => {
  try {
    // Trae todas las plataformas para el menú desplegable
    const platforms = await Platform.find({}).sort({ name: 1 }).lean();

    // Filtros (opcional)
    const { platform: platformId, q } = req.query;
    const filter = {};
    if (platformId && platformId !== 'all') filter.platform = platformId;
    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      filter.$or = [{ email: regex }];
    }

    // Trae las cuentas de la base de datos
    const accounts = await Account.find(filter)
      .populate('platform', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Renderiza la vista admin-accounts.ejs
    res.render('admin/admin-accounts', {
      title: 'Gestión de Cuentas',
      platforms,
      accounts,
      filters: { platformId: platformId || 'all', q: q || '' }
    });
  } catch (err) {
    console.error('❌ Error al mostrar gestión de cuentas:', err);
    res.status(500).send('Error cargando gestión de cuentas');
  }
};

/**
 * Crea una nueva cuenta
 */
export const create = async (req, res) => {
  try {
    const { platform, email, password, slots } = req.body;
    if (!platform || !email || !password || !slots) {
      return res.status(400).send('Todos los campos son obligatorios');
    }

    await Account.create({
      platform,
      email,
      password,
      slots: Number(slots),
      active: true
    });

    res.redirect('/admin/cuentas');
  } catch (err) {
    console.error('❌ Error al crear cuenta:', err);
    res.status(500).send('No se pudo crear la cuenta');
  }
};

/**
 * Actualiza una cuenta existente
 */
export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, slots, active } = req.body;

    await Account.findByIdAndUpdate(id, {
      ...(email ? { email } : {}),
      ...(password ? { password } : {}),
      ...(slots ? { slots: Number(slots) } : {}),
      active: active === 'true' || active === true
    });

    res.redirect('/admin/cuentas');
  } catch (err) {
    console.error('❌ Error al actualizar cuenta:', err);
    res.status(500).send('No se pudo actualizar la cuenta');
  }
};

/**
 * Elimina una cuenta
 */
export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await Account.findByIdAndDelete(id);
    res.redirect('/admin/cuentas');
  } catch (err) {
    console.error('❌ Error al eliminar cuenta:', err);
    res.status(500).send('No se pudo eliminar la cuenta');
  }
};

/**
 * Función auxiliar: Selecciona cuentas aleatorias sin repetir
 */
export const pickRandomAccounts = async (platformId, count = 1) => {
  try {
    const pool = await Account.find({
      platform: platformId,
      active: true,
      slots: { $gt: 0 }
    }).lean();

    if (!pool.length) return [];

    // Mezcla aleatoria (Fisher-Yates)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const selected = pool.slice(0, Math.min(count, pool.length));

    // Resta cupos
    await Promise.all(
      selected.map(acc =>
        Account.updateOne({ _id: acc._id, slots: { $gt: 0 } }, { $inc: { slots: -1 } })
      )
    );

    return selected;
  } catch (err) {
    console.error('❌ Error al seleccionar cuentas aleatorias:', err);
    return [];
  }
};
