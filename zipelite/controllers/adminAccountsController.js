// ✅ controllers/adminAccountsController.js — versión final (compatible con cupos individuales tipo “Pantalla 1, Pantalla 2…”)
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
 * Genera automáticamente pantallas numeradas (Pantalla 1, Pantalla 2, etc.)
 */
export const create = async (req, res) => {
  try {
    const { plataformaId, correo, password, cupos } = req.body;
    if (!plataformaId || !correo || !password || !cupos) {
      return res.redirect('/admin/cuentas?error=Faltan campos obligatorios');
    }

    const total = Number(cupos);
    if (Number.isNaN(total) || total <= 0) {
      return res.redirect('/admin/cuentas?error=El número de pantallas no es válido');
    }

    // 🔁 Crear array de pantallas (cupos)
    const listaCupos = [];
    for (let i = 1; i <= total; i++) {
      listaCupos.push({
        numero: i,
        disponible: true,
        mensaje: `Pantalla ${i}`,
      });
    }

    await Account.create({
      plataformaId,
      correo: correo.trim().toLowerCase(),
      password: password.trim(),
      cupos: listaCupos,
      activa: true,
    });

    console.log(`✅ Cuenta creada con ${total} pantallas: ${correo}`);
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

    const cuenta = await Account.findById(id);
    if (!cuenta) return res.redirect('/admin/cuentas?error=Cuenta no encontrada');

    if (correo) cuenta.correo = correo.trim().toLowerCase();
    if (password) cuenta.password = password.trim();
    cuenta.activa = activa === 'true' || activa === true;

    // Si el admin cambia el número total de pantallas:
    if (cupos) {
      const total = Number(cupos);
      if (!Number.isNaN(total) && total > 0) {
        const nuevosCupos = [];
        for (let i = 1; i <= total; i++) {
          // Mantener los existentes si ya había cupos definidos
          const existente = cuenta.cupos.find(c => c.numero === i);
          nuevosCupos.push(
            existente || { numero: i, disponible: true, mensaje: `Pantalla ${i}` }
          );
        }
        cuenta.cupos = nuevosCupos;
      }
    }

    await cuenta.save();
    console.log(`🟡 Cuenta actualizada: ${cuenta.correo}`);
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
 * ⚙️ Adaptado al nuevo modelo: busca cupos individuales disponibles
 */
export const pickRandomAccounts = async (plataformaId, count = 1) => {
  try {
    // Buscar cuentas activas que tengan al menos un cupo disponible
    const pool = await Account.find({
      plataformaId,
      activa: true,
      'cupos.disponible': true,
    }).lean();

    if (!pool.length) return [];

    // Mezclar aleatoriamente (Fisher–Yates)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const selected = [];
    for (const acc of pool) {
      if (selected.length >= count) break;

      // Buscar el primer cupo disponible
      const cupoLibre = acc.cupos.find(c => c.disponible);
      if (cupoLibre) {
        // Marcarlo como ocupado
        await Account.updateOne(
          { _id: acc._id, 'cupos.numero': cupoLibre.numero },
          { $set: { 'cupos.$.disponible': false } }
        );

        selected.push({
          ...acc,
          cupoAsignado: cupoLibre,
        });
      }
    }

    console.log(`🎟️ ${selected.length} cupo(s) asignado(s) correctamente`);
    return selected;
  } catch (err) {
    console.error('❌ Error al asignar cuenta aleatoria:', err);
    return [];
  }
};
