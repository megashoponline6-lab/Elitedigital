// ✅ server.js — versión larga FINAL (rotación ordenada + ticket modal + admin + cron)
// ⚠️ Pega esta parte primero y luego la PARTE 2 justo al final.

import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';
import csrf from 'csurf';
import cookieParser from 'cookie-parser';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import multer from 'multer';
import dayjs from 'dayjs';
import fs from 'fs';
import expressLayouts from 'express-ejs-layouts';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';

import User from './models/User.js';
import Admin from './models/Admin.js';
import Account from './models/Account.js';
import Platform from './models/Platform.js';
import Subscription from './models/Subscription.js';

import adminAccountsRoutes from './routes/adminAccounts.js';
import adminPlatformsRoutes from './routes/adminPlatforms.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);

// ───────────────────────────────────────────────────────────────────────────────
// 📁 Archivos / uploads
// ───────────────────────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
const upload = multer({ dest: UPLOADS_DIR });

// ───────────────────────────────────────────────────────────────────────────────
// ⚙️ Vistas EJS + Layouts
// ───────────────────────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// ───────────────────────────────────────────────────────────────────────────────
// 🛡️ Seguridad y middlewares generales
// ───────────────────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// ───────────────────────────────────────────────────────────────────────────────
// 📦 Estáticos
// ───────────────────────────────────────────────────────────────────────────────
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// Compatibilidad imágenes antiguas /public/uploads → /img/plataformas
app.get('/public/uploads/:file', (req, res) => {
  const fileName = req.params.file;
  const baseDir = path.join(process.cwd(), 'public', 'img', 'plataformas');

  let finalPath = path.join(baseDir, fileName);
  if (fs.existsSync(finalPath)) return res.redirect(`/img/plataformas/${fileName}`);

  const cleanName = fileName.replace(/^\d+-/, '');
  finalPath = path.join(baseDir, cleanName);
  if (fs.existsSync(finalPath)) return res.redirect(`/img/plataformas/${cleanName}`);

  const svgAlt = cleanName.replace(/\.png$/i, '.svg');
  finalPath = path.join(baseDir, svgAlt);
  if (fs.existsSync(finalPath)) return res.redirect(`/img/plataformas/${svgAlt}`);

  console.warn(`⚠️ Imagen no encontrada: ${fileName}`);
  res.status(404).send('Imagen no encontrada');
});

// ───────────────────────────────────────────────────────────────────────────────
// 💾 Conexión MongoDB
// ───────────────────────────────────────────────────────────────────────────────
if (process.env.MONGODB_URI) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB Atlas');
  } catch (err) {
    console.error('❌ Error al conectar con MongoDB Atlas:', err);
  }
} else {
  console.warn('⚠️ No se encontró MONGODB_URI en las variables de entorno');
}

// ───────────────────────────────────────────────────────────────────────────────
// 🧠 Sesiones persistentes en Mongo
// ───────────────────────────────────────────────────────────────────────────────
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'clave-insegura',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      sameSite: 'lax',
      secure: false,
    },
  })
);

const csrfProtection = csrf({ cookie: true });

// ───────────────────────────────────────────────────────────────────────────────
// 🔐 Middlewares de autenticación
// ───────────────────────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (req.session.user) return res.redirect('/panel?error=No tienes permiso');
  if (!req.session.admin) return res.redirect('/admin');
  next();
}

// ───────────────────────────────────────────────────────────────────────────────
// 🌍 Variables globales en EJS
// ───────────────────────────────────────────────────────────────────────────────
app.locals.appName = process.env.APP_NAME || 'Eliteflix';
app.locals.dayjs = dayjs;

// ───────────────────────────────────────────────────────────────────────────────
// 👤 Crear admin por defecto
// ───────────────────────────────────────────────────────────────────────────────
try {
  const adminExists = await Admin.findOne({ usuario: 'ml3838761@gmail.com' }).lean();
  if (!adminExists) {
    const passhash = await bcrypt.hash('07141512', 12);
    await Admin.create({ usuario: 'ml3838761@gmail.com', passhash });
    console.log('✅ Admin por defecto creado: ml3838761@gmail.com / 07141512');
  }
} catch (e) {
  console.error('❌ Error creando admin por defecto:', e);
}

// ───────────────────────────────────────────────────────────────────────────────
// 🧭 Locals por request
// ───────────────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.sess = req.session;
  res.locals.ok = req.query.ok;
  res.locals.error = req.query.error;
  next();
});

// ───────────────────────────────────────────────────────────────────────────────
// 🏠 Home
// ───────────────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.render('home', { productos: [], etiquetas: [], filtro: '' });
});

// ───────────────────────────────────────────────────────────────────────────────
// 👤 Registro de usuarios
// ───────────────────────────────────────────────────────────────────────────────
app.get('/registro', csrfProtection, (req, res) => {
  res.render('registro', { csrfToken: req.csrfToken(), errores: [] });
});

function normalizeEmail(correo) {
  correo = (correo || '').trim().toLowerCase();
  const m = correo.match(/^([^@+]+)(\+[^@]+)?(@gmail\.com)$/);
  return m ? m[1] + m[3] : correo;
}

app.post(
  '/registro',
  csrfProtection,
  body('nombre').notEmpty(),
  body('apellido').notEmpty(),
  body('pais').notEmpty(),
  body('correo').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res
        .status(400)
        .render('registro', { csrfToken: req.csrfToken(), errores: errores.array() });
    }

    const { nombre, apellido, pais, telefono, password } = req.body;
    const correo = normalizeEmail(req.body.correo);

    try {
      const existe = await User.findOne({ correo: correo.toLowerCase() });
      if (existe) {
        return res.status(400).render('registro', {
          csrfToken: req.csrfToken(),
          errores: [{ msg: 'Ese correo ya está registrado.' }],
        });
      }

      const passhash = await bcrypt.hash(password, 10);
      await User.create({ nombre, apellido, pais, telefono: telefono || '', correo, passhash });
      return res.redirect('/login?ok=Registro completado');
    } catch (err) {
      console.error('❌ Error en registro:', err);
      return res.status(500).render('registro', {
        csrfToken: req.csrfToken(),
        errores: [{ msg: 'Error interno del servidor.' }],
      });
    }
  }
);

// ───────────────────────────────────────────────────────────────────────────────
// 🔐 Login usuario
// ───────────────────────────────────────────────────────────────────────────────
app.get('/login', csrfProtection, (req, res) => {
  delete req.session.admin;
  res.render('login', { csrfToken: req.csrfToken(), errores: [], ok: req.query.ok });
});

app.post(
  '/login',
  csrfProtection,
  body('correo').isEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const correo = normalizeEmail(req.body.correo);
    try {
      const u = await User.findOne({ correo, activo: true }).lean();
      if (!u) {
        return res.status(400).render('login', {
          csrfToken: req.csrfToken(),
          errores: [{ msg: 'Credenciales inválidas o cuenta desactivada.' }],
        });
      }

      const ok = await bcrypt.compare(req.body.password, u.passhash);
      if (!ok) {
        return res.status(400).render('login', {
          csrfToken: req.csrfToken(),
          errores: [{ msg: 'Contraseña incorrecta.' }],
        });
      }

      req.session.user = { id: u._id.toString(), nombre: u.nombre, correo: u.correo };
      await User.updateOne({ _id: u._id }, { last_login: new Date() });
      return res.redirect('/panel?ok=Bienvenido');
    } catch (err) {
      console.error('❌ Error en login:', err);
      return res.status(500).render('login', {
        csrfToken: req.csrfToken(),
        errores: [{ msg: 'Error interno del servidor.' }],
      });
    }
  }
);
// ───────────────────────────────────────────────────────────────────────────────
// 🧑‍💼 Login admin
// ───────────────────────────────────────────────────────────────────────────────
app.get('/admin', csrfProtection, (req, res) => {
  delete req.session.user;
  res.render('admin/login', { csrfToken: req.csrfToken(), errores: [] });
});

app.post(
  '/admin',
  csrfProtection,
  body('usuario').notEmpty(),
  body('password').notEmpty(),
  async (req, res) => {
    try {
      const { usuario, password } = req.body;
      const admin = await Admin.findOne({ usuario }).lean();
      if (!admin) {
        return res.status(400).render('admin/login', {
          csrfToken: req.csrfToken(),
          errores: [{ msg: 'Usuario no encontrado.' }],
        });
      }
      const ok = await bcrypt.compare(password, admin.passhash);
      if (!ok) {
        return res.status(400).render('admin/login', {
          csrfToken: req.csrfToken(),
          errores: [{ msg: 'Contraseña incorrecta.' }],
        });
      }
      req.session.admin = { id: admin._id.toString(), usuario: admin.usuario };
      return res.redirect('/admin/panel?ok=Bienvenido');
    } catch (err) {
      console.error('❌ Error en login admin:', err);
      return res.status(500).render('admin/login', {
        csrfToken: req.csrfToken(),
        errores: [{ msg: 'Error interno del servidor.' }],
      });
    }
  }
);

// ───────────────────────────────────────────────────────────────────────────────
// 🧩 Rutas de administración
// ───────────────────────────────────────────────────────────────────────────────
app.use(adminAccountsRoutes);
app.use(adminPlatformsRoutes);

// ───────────────────────────────────────────────────────────────────────────────
// 👤 Panel de usuario
// ───────────────────────────────────────────────────────────────────────────────
app.get('/panel', csrfProtection, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id).lean();
    const platforms = await Platform.find({ available: true }).sort({ name: 1 }).lean();

    const ahora = new Date();
    const todasSubs = await Subscription.find({ userId: user._id }).lean();

    // marcar vencidas
    for (const s of todasSubs) {
      if (s.activa && s.fechaFin && s.fechaFin < ahora) {
        await Subscription.updateOne({ _id: s._id }, { $set: { activa: false } });
      }
    }

    const subsActivas = await Subscription.find({ userId: user._id, activa: true })
      .populate('platformId')
      .sort({ fechaFin: -1 })
      .lean();

    const subsInactivas = await Subscription.find({ userId: user._id, activa: false })
      .populate('platformId')
      .sort({ fechaFin: -1 })
      .lean();

    const productos = platforms.map(p => ({
      _id: p._id,
      nombre: p.name,
      logo: p.logoUrl,
      precios: p.precios || {},
    }));

    res.render('panel', {
      csrfToken: req.csrfToken(),
      user,
      subsActivas,
      subsInactivas,
      productos,
      dias: null,
      tickets: [],
    });
  } catch (err) {
    console.error('❌ Error en panel usuario:', err);
    res.redirect('/login?error=Reinicia tu sesión');
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// 🎬 Detalle de plataforma
// ───────────────────────────────────────────────────────────────────────────────
app.get('/plataforma/:id', requireAuth, async (req, res) => {
  try {
    const plataforma = await Platform.findById(req.params.id).lean();
    if (!plataforma) return res.status(404).send('Plataforma no encontrada');

    const precios = [
      { meses: 1,  precio: plataforma.precios?.[1]  || 0 },
      { meses: 3,  precio: plataforma.precios?.[3]  || 0 },
      { meses: 6,  precio: plataforma.precios?.[6]  || 0 },
      { meses: 12, precio: plataforma.precios?.[12] || 0 },
    ];

    res.render('plataforma', { plataforma, precios });
  } catch (err) {
    console.error('❌ Error cargando plataforma:', err);
    res.status(500).send('Error interno del servidor');
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// 💳 Adquirir plan (rotación ordenada + ticket modal)
// ───────────────────────────────────────────────────────────────────────────────
app.post('/plataforma/:id/adquirir', requireAuth, async (req, res) => {
  try {
    const { meses, precio } = req.body;
    const plataforma = await Platform.findById(req.params.id).lean();
    const user = await User.findById(req.session.user.id);
    const costo = parseFloat(precio);
    const mesesInt = parseInt(meses);

    if (!plataforma || !user) return res.redirect('/panel?error=Datos inválidos');
    if (Number.isNaN(costo) || Number.isNaN(mesesInt))
      return res.redirect(`/plataforma/${req.params.id}?error=Datos inválidos`);
    if ((user.saldo || 0) < costo)
      return res.redirect(`/plataforma/${plataforma._id}?error=Saldo insuficiente`);

    // 🔁 round-robin
    const cuenta = await Account.findOneAndUpdate(
      { plataformaId: plataforma._id, cupos: { $gt: 0 }, activa: true },
      { $inc: { cupos: -1 }, $set: { lastUsed: new Date() } },
      { sort: { lastUsed: 1 }, new: true }
    );

    if (!cuenta) {
      return res.redirect(`/plataforma/${plataforma._id}?error=Sin cuentas disponibles`);
    }

    user.saldo = (user.saldo || 0) - costo;
    await user.save();

    const fechaInicio = new Date();
    const fechaFin = dayjs(fechaInicio).add(mesesInt, 'month').toDate();

    const nuevaSuscripcion = await Subscription.create({
      userId: user._id,
      platformId: plataforma._id,
      meses: mesesInt,
      precio: costo,
      fechaInicio,
      fechaFin,
      activa: true,
      datosCuenta: { correo: cuenta.correo, password: cuenta.password },
    });

    console.log(`✅ Cupo descontado y rotado en ${cuenta.correo}`);

    // 🎟️ Respuesta JSON para abrir ticket dentro del panel (sin salir)
    return res.json({ ok: true, ticketId: nuevaSuscripcion._id });

  } catch (err) {
    console.error('❌ Error al adquirir plan (rotación):', err);
    res.redirect('/panel?error=Error al adquirir plan');
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// 🎟️ Ticket de compra (cliente o admin pueden visualizarlo)
// ───────────────────────────────────────────────────────────────────────────────
app.get('/ticket/:id', async (req, res) => {
  try {
    const suscripcion = await Subscription.findById(req.params.id)
      .populate('platformId')
      .lean();

    if (!suscripcion) return res.status(404).render('404');

    const userId = req.session.user?.id?.toString();
    const isOwner = suscripcion.userId?.toString() === userId;
    const isAdmin = !!req.session.admin;
    if (!isOwner && !isAdmin) return res.status(403).render('404');

    const plataforma =
      suscripcion.platformId || (await Platform.findById(suscripcion.platformId).lean());
    const dur = String(suscripcion.meses);
    const mensaje =
      (plataforma?.mensajes &&
        (plataforma.mensajes[dur] || plataforma.mensajes[suscripcion.meses])) ||
      plataforma?.[`mensaje_${dur}`] ||
      plataforma?.[`mensaje_${suscripcion.meses}`] ||
      'Gracias por tu compra.';

    // 🧾 Render del ticket dentro del panel
    res.render('ticket', { suscripcion, plataforma, mensaje, dayjs });
  } catch (err) {
    console.error('❌ Error mostrando ticket:', err);
    res.status(500).send('Error interno del servidor');
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// 🧮 Panel admin
// ───────────────────────────────────────────────────────────────────────────────
app.get('/admin/panel', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const usuarios = await User.find({}).sort({ createdAt: -1 }).lean();
    const totalAccounts = await Account.countDocuments();
    const totalPlatforms = await Platform.countDocuments();
    const totalUsuarios = usuarios.length;
    const activos = usuarios.filter(u => u.activo !== false).length;
    const inactivos = totalUsuarios - activos;
    const totalSaldo = usuarios.reduce((sum, u) => sum + (u.saldo || 0), 0);

    res.render('admin/panel', {
      csrfToken: req.csrfToken(),
      usuarios,
      stats: { totalUsuarios, activos, inactivos, totalSaldo, totalAccounts, totalPlatforms },
      errores: [],
      ok: req.query.ok || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error('❌ Error cargando admin/panel:', err);
    res.redirect('/admin?error=Error al cargar el panel');
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// 📊 Suscripciones admin
// ───────────────────────────────────────────────────────────────────────────────
app.get('/admin/suscripciones', requireAdmin, async (req, res) => {
  try {
    const subs = await Subscription.find({})
      .populate('userId')
      .populate('platformId')
      .sort({ fechaFin: -1 })
      .lean();

    res.render('admin/suscripciones', { subs, dayjs });
  } catch (err) {
    console.error('❌ Error cargando suscripciones admin:', err);
    res.status(500).send('Error interno del servidor');
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// 💰 Recargar saldo
// ───────────────────────────────────────────────────────────────────────────────
app.post('/admin/recargar', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const { correo, monto, nota } = req.body;
    const user = await User.findOne({ correo: (correo || '').toLowerCase() });
    if (!user) return res.redirect('/admin/panel?error=Usuario no encontrado');

    const delta = parseInt(monto);
    if (Number.isNaN(delta)) return res.redirect('/admin/panel?error=Monto inválido');

    const nuevoSaldo = (user.saldo || 0) + delta;
    await User.updateOne({ _id: user._id }, { $set: { saldo: nuevoSaldo } });

    console.log(`✅ Saldo actualizado: ${correo} -> ${nuevoSaldo} (${nota || 'Recarga manual'})`);
    res.redirect(`/admin/panel?ok=Saldo recargado a ${correo}`);
  } catch (err) {
    console.error('❌ Error al recargar saldo:', err);
    res.redirect('/admin/panel?error=Error al recargar saldo');
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// 🚪 Logout y errores
// ───────────────────────────────────────────────────────────────────────────────
app.get(['/logout', '/admin/salir'], (req, res) => {
  req.session.destroy(() => res.redirect('/login?ok=Sesión cerrada correctamente'));
});

app.use((req, res) => res.status(404).render('404'));
app.use((err, req, res, next) => {
  console.error('❌ Error interno:', err);
  res.status(500).send('Error Interno del Servidor');
});

// ───────────────────────────────────────────────────────────────────────────────
// 🕐 CRON — desactivar suscripciones vencidas cada 24h
// ───────────────────────────────────────────────────────────────────────────────
setInterval(async () => {
  const ahora = new Date();
  try {
    const vencidas = await Subscription.updateMany(
      { activa: true, fechaFin: { $lt: ahora } },
      { $set: { activa: false } }
    );
    if (vencidas.modifiedCount > 0) {
      console.log(`🕐 Cron: ${vencidas.modifiedCount} suscripciones vencidas desactivadas.`);
    }
  } catch (err) {
    console.error('❌ Error en el cron de suscripciones:', err);
  }
}, 1000 * 60 * 60 * 24);

// ───────────────────────────────────────────────────────────────────────────────
// 🚀 Listen
// ───────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));
