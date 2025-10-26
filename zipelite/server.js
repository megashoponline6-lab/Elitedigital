// ✅ server.js — versión final lista para Render (sirve /img, /css, /uploads y corrige /public/uploads)
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

import User from './models/User.js';
import Admin from './models/Admin.js';
import Account from './models/Account.js';
import Platform from './models/Platform.js';

import adminAccountsRoutes from './routes/adminAccounts.js';
import adminPlatformsRoutes from './routes/adminPlatforms.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);

// 📁 Carpetas necesarias
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const upload = multer({ dest: UPLOADS_DIR });

// ⚙️ Motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// 🛡️ Seguridad y middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// ✅ sirve archivos estáticos:
// - /img, /css, /js, /uploads
// - además corrige rutas antiguas /public/uploads/...
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// 🔄 Redirige /public/uploads/... → /uploads/...
app.get('/public/uploads/:file', (req, res) => {
  res.redirect(`/uploads/${req.params.file}`);
});

// 💾 MongoDB
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

// 🧠 Sesión
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'clave-insegura',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
  })
);

const csrfProtection = csrf({ cookie: true });

// 🧩 Middlewares de autenticación
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (req.session.user) return res.redirect('/panel?error=No tienes permiso para entrar aquí');
  if (!req.session.admin) return res.redirect('/admin');
  next();
}

// 🌍 Variables globales
app.locals.appName = process.env.APP_NAME || 'Eliteflix';
app.locals.dayjs = dayjs;

// 🧑‍💻 Crear admin por defecto si no existe
const adminExists = await Admin.findOne({ usuario: 'ml3838761@gmail.com' }).lean();
if (!adminExists) {
  const passhash = await bcrypt.hash('07141512', 12);
  await Admin.create({ usuario: 'ml3838761@gmail.com', passhash });
  console.log('✅ Admin por defecto creado: ml3838761@gmail.com / 07141512');
}

// 🧭 Vars globales para layout
app.use((req, res, next) => {
  res.locals.sess = req.session;
  res.locals.ok = req.query.ok;
  res.locals.error = req.query.error;
  next();
});

// 🏠 Catálogo público desde Platform
app.get('/', async (req, res, next) => {
  try {
    const platforms = await Platform.find({ available: true }).sort({ name: 1 }).lean();
    const productos = platforms.map((p) => ({
      nombre: p.name,
      etiqueta: 'Streaming',
      precio: 0,
      logo: p.logoUrl,
      activo: p.available ? 1 : 0,
      disponible: p.available ? 1 : 0,
    }));
    res.render('home', { productos, etiquetas: [], filtro: '' });
  } catch (e) {
    next(e);
  }
});

app.get('/catalogo', async (req, res, next) => {
  try {
    const platforms = await Platform.find({ available: true }).sort({ name: 1 }).lean();
    const productos = platforms.map((p) => ({
      nombre: p.name,
      etiqueta: 'Streaming',
      precio: 0,
      logo: p.logoUrl,
      activo: p.available ? 1 : 0,
      disponible: p.available ? 1 : 0,
    }));
    res.render('catalogo', { productos, etiquetas: [], filtro: '' });
  } catch (e) {
    next(e);
  }
});

// 🧍 Registro de usuarios
app.get('/registro', csrfProtection, (req, res) =>
  res.render('registro', { csrfToken: req.csrfToken(), errores: [] })
);

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
      return res.status(400).render('registro', { csrfToken: req.csrfToken(), errores: errores.array() });
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
      res.redirect('/login?ok=Registro completado');
    } catch (err) {
      console.error('❌ Error en registro:', err);
      res.status(500).render('registro', {
        csrfToken: req.csrfToken(),
        errores: [{ msg: 'Error interno del servidor.' }],
      });
    }
  }
);

// 🔐 Login de usuarios
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
      res.redirect('/panel?ok=Bienvenido');
    } catch (err) {
      console.error('❌ Error en login:', err);
      res.status(500).render('login', {
        csrfToken: req.csrfToken(),
        errores: [{ msg: 'Error interno del servidor.' }],
      });
    }
  }
);

// 🧑‍💼 Login de admin (Mongo)
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
      res.redirect('/admin/panel?ok=Bienvenido');
    } catch (err) {
      console.error('❌ Error en login admin:', err);
      res.status(500).render('admin/login', {
        csrfToken: req.csrfToken(),
        errores: [{ msg: 'Error interno del servidor.' }],
      });
    }
  }
);

// 🧩 Rutas de administración
app.use(adminAccountsRoutes);
app.use(adminPlatformsRoutes);

// 👤 Panel usuario
app.get('/panel', csrfProtection, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id).lean();
    res.render('panel', { csrfToken: req.csrfToken(), user, sub: null, dias: null, tickets: [] });
  } catch (err) {
    console.error('❌ Error en panel usuario:', err);
    res.redirect('/login?error=Reinicia tu sesión');
  }
});

// 🧮 Panel admin
app.get('/admin/panel', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const usuarios = await User.find({}).sort({ created_at: -1 }).lean();
    const totalAccounts = await Account.countDocuments();
    const totalPlatforms = await Platform.countDocuments();

    const totalUsuarios = usuarios.length;
    const activos = usuarios.filter((u) => u.activo).length;
    const inactivos = totalUsuarios - activos;
    const totalSaldo = usuarios.reduce((sum, u) => sum + (u.saldo || 0), 0);

    res.render('admin/panel', {
      csrfToken: req.csrfToken(),
      usuarios,
      productos: [],
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

// 💰 Recargar saldo
app.post('/admin/recargar', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const { correo, monto, nota } = req.body;
    const user = await User.findOne({ correo: correo.toLowerCase() });
    if (!user) return res.redirect('/admin/panel?error=Usuario no encontrado');

    const nuevoSaldo = (user.saldo || 0) + parseInt(monto);
    await User.updateOne({ _id: user._id }, { $set: { saldo: nuevoSaldo } });

    console.log(`✅ Saldo actualizado para ${correo}: ${nuevoSaldo} (${nota || 'Recarga manual'})`);
    res.redirect(`/admin/panel?ok=Saldo recargado a ${correo}`);
  } catch (err) {
    console.error('❌ Error al recargar saldo:', err);
    res.redirect('/admin/panel?error=Error al recargar saldo');
  }
});

// 🚪 Logout
app.get(['/logout', '/admin/salir'], (req, res) => {
  req.session.destroy(() => res.redirect('/login?ok=Sesión cerrada correctamente'));
});

// ⚠️ Errores 404 y 500
app.use((req, res) => res.status(404).render('404'));
app.use((err, req, res) => {
  console.error('❌ Error interno:', err);
  res.status(500).send('Error Interno del Servidor');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));
