// ✅ server.js (versión final con manejo de plataformas de streaming)
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

// 🛡 Seguridad, logs, middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// 📝 Sesiones
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

// 🔒 Middlewares
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

// 🧱 Tablas
await run(`CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT UNIQUE, passhash TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, apellido TEXT, pais TEXT, telefono TEXT, correo TEXT UNIQUE, passhash TEXT, saldo INTEGER DEFAULT 0, activo INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, etiqueta TEXT, precio INTEGER, logo TEXT, activo INTEGER DEFAULT 1, disponible INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, product_id INTEGER, vence_en TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS topups (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, monto INTEGER, nota TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS manual_sales (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, descripcion TEXT, monto INTEGER, fecha TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, estado TEXT DEFAULT 'abierto', created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS ticket_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER, autor TEXT, mensaje TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);

// 👑 Admin por defecto
const adminCount = await get(`SELECT COUNT(*) as c FROM admins;`);
if (adminCount.c === 0) {
  const defaultUser = 'ml3838761@gmail.com';
  const defaultPass = '07141512';
  const passhash = await bcrypt.hash(defaultPass, 12);
  await run(`INSERT INTO admins (usuario, passhash) VALUES (?,?);`, [defaultUser, passhash]);
  console.log(`✅ Admin por defecto creado: ${defaultUser} / ${defaultPass}`);
}

// 🌱 Seed productos
const c = await get(`SELECT COUNT(*) as c FROM products;`);
if (c.c === 0) {
  const seedPath = path.join(process.cwd(), 'seed', 'products.json');
  if (fs.existsSync(seedPath)) {
    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    for (const [nombre, etiqueta, precio, logo] of seed) {
      await run(`INSERT INTO products(nombre, etiqueta, precio, logo) VALUES (?,?,?,?);`, [nombre, etiqueta, precio, logo]);
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

// 🏠 Página principal
app.get('/', async (req, res, next) => {
  try {
    const productos = await all(`SELECT * FROM products WHERE activo=1 ORDER BY nombre;`);
    res.render('home', { productos, etiquetas: [], filtro: '' });
  } catch (e) { next(e); }
});

// 🛍 Catálogo
app.get('/catalogo', async (req, res, next) => {
  try {
    const productos = await all(`SELECT * FROM products WHERE activo=1 ORDER BY nombre;`);
    res.render('catalogo', { productos, etiquetas: [], filtro: '' });
  } catch (e) { next(e); }
});

// 📝 Registro
app.get('/registro', csrfProtection, (req, res) =>
  res.render('registro', { csrfToken: req.csrfToken(), errores: [] })
);
function normalizeEmail(correo) {
  correo = (correo || '').trim().toLowerCase();
  const m = correo.match(/^([^@+]+)(\+[^@]+)?(@gmail\.com)$/);
  if (m) return m[1] + m[3];
  return correo;
}
app.post('/registro',
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
    const existe = await get(`SELECT id FROM users WHERE lower(correo)=?;`, [correo]);
    if (existe)
      return res.status(400).render('registro', { csrfToken: req.csrfToken(), errores: [{ msg: 'Ese correo ya está registrado.' }] });
    const passhash = await bcrypt.hash(password, 10);
    await run(`INSERT INTO users (nombre, apellido, pais, telefono, correo, passhash) VALUES (?,?,?,?,?,?);`,
      [nombre, apellido, pais, telefono || '', correo, passhash]);
    res.redirect('/login?ok=Registro completado');
  }
);

// 👤 Login clientes
app.get('/login', csrfProtection, (req, res) => {
  delete req.session.admin;
  res.render('login', { csrfToken: req.csrfToken(), errores: [], ok: req.query.ok });
});
app.post('/login',
  csrfProtection,
  body('correo').isEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const correo = normalizeEmail(req.body.correo);
    const u = await get(`SELECT * FROM users WHERE lower(correo)=? AND activo=1;`, [correo]);
    if (!u)
      return res.status(400).render('login', { csrfToken: req.csrfToken(), errores: [{ msg: 'Credenciales inválidas o cuenta desactivada' }] });
    const ok = await bcrypt.compare(req.body.password, u.passhash);
    if (!ok)
      return res.status(400).render('login', { csrfToken: req.csrfToken(), errores: [{ msg: 'Credenciales inválidas' }] });
    req.session.user = { id: u.id, nombre: u.nombre, correo: u.correo };
    res.redirect('/panel?ok=Bienvenido');
  }
);

// 👤 Panel usuario
app.get('/panel', csrfProtection, requireAuth, async (req, res) => {
  const user = await get(`SELECT * FROM users WHERE id=?;`, [req.session.user.id]);
  const sub = await get(
    `SELECT s.*, p.nombre as prod_nombre FROM subscriptions s
     LEFT JOIN products p ON p.id=s.product_id
     WHERE s.user_id=? ORDER BY s.id DESC LIMIT 1;`,
    [user.id]
  );
  const dias = sub ? Math.ceil((new Date(sub.vence_en) - new Date()) / (1000 * 60 * 60 * 24)) : null;
  const tickets = await all(`SELECT * FROM tickets WHERE user_id=? ORDER BY id DESC;`, [user.id]);
  res.render('panel', { csrfToken: req.csrfToken(), user, sub, dias, tickets });
});

// 💬 Tickets
app.post('/ticket', csrfProtection, requireAuth, body('mensaje').notEmpty(), async (req, res) => {
  let ticketId = req.body.ticket_id;
  if (!ticketId) {
    const t = await run(`INSERT INTO tickets (user_id) VALUES (?);`, [req.session.user.id]);
    ticketId = t.lastID;
  }
  await run(`INSERT INTO ticket_messages (ticket_id, autor, mensaje) VALUES (?,?,?);`, [ticketId, 'cliente', req.body.mensaje]);
  res.redirect('/panel?ok=Mensaje enviado#soporte');
});

// 🔑 Admin
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
app.get('/admin/salir', (req, res) => { delete req.session.admin; res.redirect('/admin?ok=Sesión cerrada'); });

// 📊 Panel admin
app.get('/admin/panel', requireAdmin, csrfProtection, async (req, res, next) => {
  try {
    const usuarios = await all(`SELECT id,nombre,apellido,correo,saldo,activo FROM users ORDER BY id DESC LIMIT 15;`);
    const productos = await all(`SELECT * FROM products ORDER BY id DESC;`);
    const totSaldo = await get(`SELECT SUM(saldo) as s FROM users;`);
    const totManualMes = await get(`SELECT SUM(monto) as s FROM manual_sales WHERE strftime('%Y-%m', fecha)=strftime('%Y-%m','now');`);
    const totSubsAct = await get(`SELECT COUNT(*) as c FROM subscriptions WHERE date(vence_en) >= date('now');`);
    res.render('admin/panel', { csrfToken: req.csrfToken(), usuarios, productos, totSaldo, totManualMes, totSubsAct });
  } catch (err) {
    console.error('❌ Error cargando admin/panel:', err);
    next(err);
  }
});

// 💰 Recargar saldo (por correo)
app.post('/admin/recargar', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const { correo, monto, nota } = req.body;
    const user = await get(`SELECT id, saldo FROM users WHERE lower(correo)=?;`, [correo.toLowerCase()]);
    if (!user) return res.redirect('/admin/panel?error=Usuario no encontrado');
    const nuevoSaldo = user.saldo + parseInt(monto);
    await run(`UPDATE users SET saldo=? WHERE id=?;`, [nuevoSaldo, user.id]);
    await run(`INSERT INTO topups (user_id, monto, nota) VALUES (?,?,?);`, [user.id, monto, nota || 'Recarga manual']);
    res.redirect(`/admin/panel?ok=Saldo recargado a ${correo}`);
  } catch (err) {
    console.error('❌ Error al recargar saldo:', err);
    res.redirect('/admin/panel?error=Error al recargar saldo');
  }
});

// 🎬 Añadir nueva plataforma
app.post('/admin/plataforma', requireAdmin, upload.single('logoimg'), csrfProtection, async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || !req.file) return res.redirect('/admin/panel?error=Faltan datos');
    const logoPath = `/public/uploads/${req.file.filename}`;
    await run(`INSERT INTO products (nombre, logo, activo, disponible) VALUES (?,?,1,1);`, [nombre, logoPath]);
    res.redirect('/admin/panel?ok=Plataforma añadida');
  } catch (err) {
    console.error('❌ Error al añadir plataforma:', err);
    res.redirect('/admin/panel?error=Error al añadir');
  }
});

// 🖼️ Cambiar logo de plataforma
app.post('/admin/plataforma/:id/logo', requireAdmin, upload.single('logoimg'), csrfProtection, async (req, res) => {
  try {
    if (!req.file) return res.redirect('/admin/panel?error=Sin archivo');
    const logoPath = `/public/uploads/${req.file.filename}`;
    await run(`UPDATE products SET logo=? WHERE id=?;`, [logoPath, parseInt(req.params.id)]);
    res.redirect('/admin/panel?ok=Logo actualizado');
  } catch (err) {
    console.error('❌ Error al actualizar logo:', err);
    res.redirect('/admin/panel?error=Error al cambiar logo');
  }
});

// ❌ Eliminar plataforma
app.post('/admin/plataforma/:id/eliminar', requireAdmin, csrfProtection, async (req, res) => {
  try {
    await run(`DELETE FROM products WHERE id=?;`, [parseInt(req.params.id)]);
    res.redirect('/admin/panel?ok=Plataforma eliminada');
  } catch (err) {
    console.error('❌ Error al eliminar plataforma:', err);
    res.redirect('/admin/panel?error=Error al eliminar');
  }
});

// 404
app.use((req, res) => res.status(404).render('404'));

// 500
app.use((err, req, res, next) => {
  console.error('❌ Error interno:', err);
  res.status(500).send('Error Interno del Servidor');
});

// 🚀 Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));
