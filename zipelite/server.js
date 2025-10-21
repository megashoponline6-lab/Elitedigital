// ✅ server.js — versión final con MongoDB Atlas (usuarios) + SQLite (productos/tickets) + Sistema de Ventas
import express from 'express';
import session from 'express-session';
import SQLiteStoreFactory from 'connect-sqlite3';
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
import { run, all, get } from './db.js';
import expressLayouts from 'express-ejs-layouts';

// 🧩 MongoDB + rutas de gestión y ventas
import mongoose from 'mongoose';
import adminAccountsRoutes from './routes/adminAccounts.js';
import salesRoutes from './routes/sales.js'; // ✅ nueva ruta añadida
import User from './models/User.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);

// 📁 Crear carpetas necesarias
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
for (const d of [DATA_DIR, UPLOADS_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

const SQLiteStore = SQLiteStoreFactory(session);
const upload = multer({ dest: UPLOADS_DIR });

// 🧠 Vistas y layouts
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// 🛡 Seguridad, logs y middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// 🧩 Conexión a MongoDB Atlas
if (process.env.MONGODB_URI) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB Atlas');
  } catch (err) {
    console.error('❌ Error al conectar MongoDB Atlas:', err);
  }
} else {
  console.warn('⚠️ No se encontró MONGODB_URI en las variables de entorno');
}

// 🧠 Sesiones
app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: DATA_DIR }),
    secret: process.env.SESSION_SECRET || 'inseguro',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
  })
);

const csrfProtection = csrf({ cookie: true });

// 🔒 Middlewares de acceso
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (req.session.user) return res.redirect('/panel?error=No tienes permiso para entrar aquí');
  if (!req.session.admin) return res.redirect('/admin');
  next();
}

app.locals.appName = process.env.APP_NAME || 'Eliteflix';
app.locals.dayjs = dayjs;

// 🧱 Tablas SQLite
await run(`CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT UNIQUE,
  passhash TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);

await run(`CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  etiqueta TEXT,
  precio INTEGER,
  logo TEXT,
  activo INTEGER DEFAULT 1,
  disponible INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);

await run(`CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  product_id INTEGER,
  vence_en TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);

await run(`CREATE TABLE IF NOT EXISTS topups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  monto INTEGER,
  nota TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);

await run(`CREATE TABLE IF NOT EXISTS manual_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  descripcion TEXT,
  monto INTEGER,
  fecha TEXT DEFAULT CURRENT_TIMESTAMP
);`);

await run(`CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  estado TEXT DEFAULT 'abierto',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);

await run(`CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER,
  autor TEXT,
  mensaje TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);

// 👑 Admin por defecto
const adminCount = await get(`SELECT COUNT(*) as c FROM admins;`);
if (adminCount.c === 0) {
  const defaultUser = 'ml3838761@gmail.com';
  const defaultPass = '07141512';
  const passhash = await bcrypt.hash(defaultPass, 12);
  await run(`INSERT INTO admins (usuario, passhash) VALUES (?,?);`, [defaultUser, passhash]);
  console.log(`✅ Admin por defecto creado: ${defaultUser} / ${defaultPass}`);
}

// 🌱 Productos iniciales
const c = await get(`SELECT COUNT(*) as c FROM products;`);
if (c.c === 0) {
  const seedPath = path.join(process.cwd(), 'seed', 'products.json');
  if (fs.existsSync(seedPath)) {
    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    for (const [nombre, etiqueta, precio, logo] of seed) {
      await run(
        `INSERT INTO products(nombre, etiqueta, precio, logo) VALUES (?,?,?,?);`,
        [nombre, etiqueta, precio, logo]
      );
    }
  }
}

// 🌐 Sesión + mensajes
app.use((req, res, next) => {
  res.locals.sess = req.session;
  res.locals.ok = req.query.ok;
  res.locals.error = req.query.error;
  next();
});

// 🏠 Home
app.get('/', async (req, res, next) => {
  try {
    const productos = await all(`SELECT * FROM products WHERE activo=1 ORDER BY nombre;`);
    res.render('home', { productos, etiquetas: [], filtro: '' });
  } catch (e) {
    next(e);
  }
});

// 🛍 Catálogo
app.get('/catalogo', async (req, res, next) => {
  try {
    const productos = await all(`SELECT * FROM products WHERE activo=1 ORDER BY nombre;`);
    res.render('catalogo', { productos, etiquetas: [], filtro: '' });
  } catch (e) {
    next(e);
  }
});

// 📝 Registro (MongoDB)
app.get('/registro', csrfProtection, (req, res) =>
  res.render('registro', { csrfToken: req.csrfToken(), errores: [] })
);

function normalizeEmail(correo) {
  correo = (correo || '').trim().toLowerCase();
  const m = correo.match(/^([^@+]+)(\+[^@]+)?(@gmail\.com)$/);
  if (m) return m[1] + m[3];
  return correo;
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
    if (!errores.isEmpty())
      return res.status(400).render('registro', { csrfToken: req.csrfToken(), errores: errores.array() });

    const { nombre, apellido, pais, telefono, password } = req.body;
    const correo = normalizeEmail(req.body.correo);

    try {
      const existe = await User.findOne({ correo: correo.toLowerCase() });
      if (existe)
        return res.status(400).render('registro', {
          csrfToken: req.csrfToken(),
          errores: [{ msg: 'Ese correo ya está registrado.' }],
        });

      const passhash = await bcrypt.hash(password, 10);
      await User.create({
        nombre,
        apellido,
        pais,
        telefono: telefono || '',
        correo: correo.toLowerCase(),
        passhash,
      });

      res.redirect('/login?ok=Registro completado');
    } catch (err) {
      console.error('❌ Error en registro MongoDB:', err);
      res.status(500).render('registro', {
        csrfToken: req.csrfToken(),
        errores: [{ msg: 'Error interno del servidor.' }],
      });
    }
  }
);

// 👤 Login clientes (MongoDB)
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
      const u = await User.findOne({ correo: correo.toLowerCase(), activo: true }).lean();
      if (!u)
        return res.status(400).render('login', {
          csrfToken: req.csrfToken(),
          errores: [{ msg: 'Credenciales inválidas o cuenta desactivada' }],
        });

      const ok = await bcrypt.compare(req.body.password, u.passhash);
      if (!ok)
        return res.status(400).render('login', {
          csrfToken: req.csrfToken(),
          errores: [{ msg: 'Credenciales inválidas' }],
        });

      req.session.user = { id: u._id.toString(), nombre: u.nombre, correo: u.correo };
      await User.updateOne({ _id: u._id }, { last_login: new Date() });

      res.redirect('/panel?ok=Bienvenido');
    } catch (err) {
      console.error('❌ Error en login MongoDB:', err);
      res.status(500).render('login', {
        csrfToken: req.csrfToken(),
        errores: [{ msg: 'Error interno del servidor' }],
      });
    }
  }
);

// ⚙️ Gestión de Cuentas (MongoDB)
app.use(adminAccountsRoutes);

// 🛒 Sistema de Ventas (MongoDB)
app.use(salesRoutes); // ✅ integración añadida aquí

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

// 💬 Tickets (SQLite)
app.post('/ticket', csrfProtection, requireAuth, body('mensaje').notEmpty(), async (req, res) => {
  let ticketId = req.body.ticket_id;
  if (!ticketId) {
    const t = await run(`INSERT INTO tickets (user_id) VALUES (?);`, [req.session.user.id]);
    ticketId = t.lastID;
  }
  await run(
    `INSERT INTO ticket_messages (ticket_id, autor, mensaje) VALUES (?,?,?);`,
    [ticketId, 'cliente', req.body.mensaje]
  );
  res.redirect('/panel?ok=Mensaje enviado#soporte');
});

// 🔑 Admin (SQLite)
app.get('/admin', csrfProtection, async (req, res) => {
  delete req.session.user;
  const c = await get(`SELECT COUNT(*) as c FROM admins;`);
  if (c.c === 0) return res.redirect('/admin/setup');
  res.render('admin/login', { csrfToken: req.csrfToken(), errores: [] });
});

app.post('/admin', csrfProtection, body('usuario').notEmpty(), body('password').notEmpty(), async (req, res) => {
  const a = await get(`SELECT * FROM admins WHERE usuario=?;`, [req.body.usuario]);
  if (!a) return res.redirect('/admin?error=Credenciales');
  const ok = await bcrypt.compare(req.body.password, a.passhash);
  if (!ok) return res.redirect('/admin?error=Credenciales');
  req.session.admin = { id: a.id, usuario: a.usuario };
  res.redirect('/admin/panel?ok=Bienvenido');
});

app.get('/admin/salir', (req, res) => {
  delete req.session.admin;
  res.redirect('/admin?ok=Sesión cerrada');
});

// 📊 Panel admin (MongoDB + SQLite con resumen)
app.get('/admin/panel', requireAdmin, csrfProtection, async (req, res, next) => {
  try {
    const usuarios = await User.find({}).sort({ created_at: -1 }).lean();
    const productos = await all(`SELECT * FROM products ORDER BY id DESC;`);

    const totalUsuarios = usuarios.length;
    const activos = usuarios.filter(u => u.activo).length;
    const inactivos = totalUsuarios - activos;
    const totalSaldo = usuarios.reduce((sum, u) => sum + (u.saldo || 0), 0);

    res.render('admin/panel', {
      csrfToken: req.csrfToken(),
      usuarios,
      productos,
      stats: { totalUsuarios, activos, inactivos, totalSaldo }
    });
  } catch (err) {
    console.error('❌ Error cargando admin/panel:', err);
    next(err);
  }
});

// 💰 Recargar saldo (MongoDB + SQLite)
app.post('/admin/recargar', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const { correo, monto, nota } = req.body;
    const user = await User.findOne({ correo: correo.toLowerCase() });

    if (!user) return res.redirect('/admin/panel?error=Usuario no encontrado');

    const nuevoSaldo = (user.saldo || 0) + parseInt(monto);
    await User.updateOne({ _id: user._id }, { $set: { saldo: nuevoSaldo } });

    await run(
      `INSERT INTO topups (user_id, monto, nota) VALUES (?,?,?);`,
      [user._id.toString(), parseInt(monto), nota || 'Recarga manual']
    );

    console.log(`✅ Saldo actualizado para ${correo}: ${nuevoSaldo}`);
    res.redirect(`/admin/panel?ok=Saldo recargado a ${correo}`);
  } catch (err) {
    console.error('❌ Error al recargar saldo:', err);
    res.redirect('/admin/panel?error=Error al recargar saldo');
  }
});

// 404 y 500
app.use((req, res) => res.status(404).render('404'));
app.use((err, req, res, next) => {
  console.error('❌ Error interno:', err);
  res.status(500).send('Error Interno del Servidor');
});

// 🚀 Inicio
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));
