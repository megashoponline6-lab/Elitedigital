// ✅ controllers/adminAccountsController.js — Mongo puro
import Account from '../models/Account.js';
import Platform from '../models/Platform.js';

export const view = async (req, res) => {
  try {
    const platforms = await Platform.find({}).sort({ name: 1 }).lean();

    const { platform: platformId, q } = req.query;
    const filter = {};
    if (platformId && platformId !== 'all') filter.platform = platformId;
    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      filter.$or = [{ email: regex }];
    }

    const accounts = await Account.find(filter)
      .populate('platform', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.render('admin/admin-accounts', {
      title: 'Gestión de Cuentas',
      platforms,
      accounts,
      filters: { platformId: platformId || 'all', q: q || '' },
      csrfToken: req.csrfToken(),
      errores: []
    });
  } catch (err) {
    console.error('❌ Error al mostrar gestión de cuentas:', err);
    res.status(500).render('admin/admin-accounts', {
      title: 'Gestión de Cuentas',
      platforms: [],
      accounts: [],
      filters: { platformId: 'all', q: '' },
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      errores: [{ msg: 'Error interno al cargar cuentas.' }]
    });
  }
};

export const create = async (req, res) => {
  try {
    const { platform, email, password, slots } = req.body;
    if (!platform || !email || !password || !slots) {
      return res.redirect('/admin/cuentas?error=Faltan campos obligatorios');
    }

    await Account.create({
      platform,
      email: email.trim().toLowerCase(),
      password,
      slots: Number(slots),
      active: true
    });

    console.log(`✅ Cuenta creada: ${email}`);
    res.redirect('/admin/cuentas?ok=Cuenta creada correctamente');
  } catch (err) {
    console.error('❌ Error al crear cuenta:', err);
    res.redirect('/admin/cuentas?error=Error al crear cuenta');
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, slots, active } = req.body;

    const updated = await Account.findByIdAndUpdate(id, {
      ...(email ? { email: email.trim().toLowerCase() } : {}),
      ...(password ? { password } : {}),
      ...(slots ? { slots: Number(slots) } : {}),
      active: active === 'true' || active === true
    });

    if (!updated) return res.redirect('/admin/cuentas?error=Cuenta no encontrada');

    console.log(`🟡 Cuenta actualizada: ${id}`);
    res.redirect('/admin/cuentas?ok=Cuenta actualizada');
  } catch (err) {
    console.error('❌ Error al actualizar cuenta:', err);
    res.redirect('/admin/cuentas?error=Error al actualizar');
  }
};

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

export const pickRandomAccounts = async (platformId, count = 1) => {
  try {
    const pool = await Account.find({
      platform: platformId,
      active: true,
      slots: { $gt: 0 }
    }).lean();

    if (!pool.length) return [];

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const selected = pool.slice(0, Math.min(count, pool.length));

    await Promise.all(
      selected.map(acc =>
        Account.updateOne({ _id: acc._id, slots: { $gt: 0 } }, { $inc: { slots: -1 } })
      )
    );

    console.log(`🎟️ ${selected.length} cuenta(s) asignada(s) aleatoriamente`);
    return selected;
  } catch {
    return [];
  }
};
