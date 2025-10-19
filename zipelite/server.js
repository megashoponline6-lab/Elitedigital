// ✅ server.js (versión corregida y completa)
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
  if (!req.session.admin) return res.redirect('/admin/login');
  next();
}

app.locals.appName = process.env.APP_NAME || 'Eliteflix';
app.locals.dayjs = dayjs;

// 🧱 Tablas
await run(`CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT UNIQUE, passhash TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, apellido TEXT, pais TEXT, telefono TEXT, correo TEXT UNIQUE, passhash TEXT, saldo INTEGER DEFAULT 0, activo INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, etiqueta TEXT, precio INTEGER, logo TEXT, activo INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, product_id INTEGER, vence_en TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS topups (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, monto INTEGER, nota TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS manual_sales (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, descripcion TEXT, monto INTEGER, fecha TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, correo TEXT, password TEXT, notas TEXT, cupos INTEGER DEFAULT 1, cupos_usados INTEGER DEFAULT 0, activo INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS allocations (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, product_id INTEGER, account_id INTEGER, meses INTEGER, start_at TEXT DEFAULT CURRENT_TIMESTAMP, end_at TEXT);`);

// 👑 Admin por defecto
const adminCount = await get(`SELECT COUNT(*) as c FROM admins;`);
if (adminCount.c === 0) {
  const defaultUser = 'ml3838761@gmail.com';
  const defaultPass = '07141512';
  const passhash = await bcrypt.hash(defaultPass, 12);
  await run(`INSERT INTO admins (usuario, passhash) VALUES (?,?);`, [defaultUser, passhash]);
  console.log(`✅ Admin por defecto creado: ${defaultUser} / ${defaultPass}`);
}

// 🌱 Seed productos si vacío
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

// 🌐 Sesión y mensajes
app.use((req, res, next) => {
  res.locals.sess = req.session;
  res.locals.ok = req.query.ok;
  res.locals.error = req.query.error;
  next();
});

// 🏠 Home
app.get('/', async (req, res, next) => {
  try {
    const etiquetas = await all(`SELECT DISTINCT etiqueta FROM products WHERE activo=1 ORDER BY etiqueta;`);
    const filtro = req.query.f || '';
    const productos = filtro
      ? await all(`SELECT * FROM products WHERE activo=1 AND etiqueta=? ORDER BY nombre;`, [filtro])
      : await all(`SELECT * FROM products WHERE activo=1 ORDER BY nombre;`);
    res.render('home', { productos, etiquetas, filtro });
  } catch (e) {
    next(e);
  }
});

// 🔒 Catálogo
app.get('/catalogo', requireAuth, async (req, res, next) => {
  try {
    const productos = await all(`SELECT * FROM products WHERE activo=1 ORDER BY nombre;`);
    res.render('catalogo', { productos, etiquetas: [], filtro: '' });
  } catch (e) {
    next(e);
  }
});

// 🧍 Registro
app.get('/registro', csrfProtection, (req, res) =>
  res.render('registro', { csrfToken: req.csrfToken(), errores: [] })
);

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
    const correo = req.body.correo.trim().toLowerCase();

    const existe = await get(`SELECT id FROM users WHERE lower(correo)=?;`, [correo]);
    if (existe)
      return res.status(400).render('registro', { csrfToken: req.csrfToken(), errores: [{ msg: 'Ese correo ya está registrado.' }] });

    const passhash = await bcrypt.hash(password, 10);
    await run(
      `INSERT INTO users (nombre, apellido, pais, telefono, correo, passhash) VALUES (?,?,?,?,?,?);`,
      [nombre, apellido, pais, telefono || '', correo, passhash]
    );
    res.redirect('/login?ok=Registro completado');
  }
);

// 👤 Login
app.get('/login', csrfProtection, (req, res) =>
  res.render('login', { csrfToken: req.csrfToken(), errores: [], ok: req.query.ok })
);

app.post(
  '/login',
  csrfProtection,
  body('correo').isEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const correo = req.body.correo.trim().toLowerCase();
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

// 🚪 Logout
app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/?ok=Sesión cerrada')));

// 👤 Panel de usuario (corregido)
app.get('/panel', requireAuth, async (req, res, next) => {
  try {
    const user = await get(`SELECT * FROM users WHERE id=?;`, [req.session.user.id]);
    const subs = await all(`SELECT s.*, p.nombre AS producto FROM subscriptions s LEFT JOIN products p ON p.id=s.product_id WHERE s.user_id=?;`, [user.id]);
    res.render('panel', { user, subs });
  } catch (err) {
    next(err);
  }
});

// 🛒 Comprar producto (corregido)
app.get('/comprar/:id', requireAuth, async (req, res, next) => {
  try {
    const producto = await get(`SELECT * FROM products WHERE id=? AND activo=1;`, [req.params.id]);
    if (!producto) return res.status(404).render('404');
    res.render('comprar', { producto });
  } catch (err) {
    next(err);
  }
});

// 👑 Login de administrador (corregido)
app.get('/admin', (req, res) => res.redirect('/admin/login'));

app.get('/admin/login', csrfProtection, (req, res) =>
  res.render('admin/login', { csrfToken: req.csrfToken(), errores: [], ok: req.query.ok })
);

app.post('/admin/login', csrfProtection, async (req, res) => {
  const { usuario, password } = req.body;
  const admin = await get(`SELECT * FROM admins WHERE lower(usuario)=?;`, [usuario.trim().toLowerCase()]);
  if (!admin) return res.status(400).render('admin/login', { csrfToken: req.csrfToken(), errores: [{ msg: 'Credenciales inválidas' }] });

  const ok = await bcrypt.compare(password, admin.passhash);
  if (!ok) return res.status(400).render('admin/login', { csrfToken: req.csrfToken(), errores: [{ msg: 'Credenciales inválidas' }] });

  req.session.admin = { id: admin.id, usuario: admin.usuario };
  res.redirect('/admin/panel');
});

// 📊 Panel Admin (ya existente)
app.get('/admin/panel', requireAdmin, csrfProtection, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    let usuarios, productos, cuentas, vendidas;

    if (q) {
      usuarios = await all(`SELECT id,nombre,apellido,correo,saldo,activo FROM users 
        WHERE lower(nombre) LIKE ? OR lower(apellido) LIKE ? OR lower(correo) LIKE ? ORDER BY id DESC;`, [`%${q}%`, `%${q}%`, `%${q}%`]);
      productos = await all(`SELECT * FROM products 
        WHERE lower(nombre) LIKE ? OR lower(etiqueta) LIKE ? ORDER BY id DESC;`, [`%${q}%`, `%${q}%`]);
      cuentas = await all(`SELECT a.*, p.nombre AS prod_nombre FROM accounts a 
        LEFT JOIN products p ON p.id=a.product_id
        WHERE lower(a.correo) LIKE ? OR lower(p.nombre) LIKE ? ORDER BY a.id DESC;`, [`%${q}%`, `%${q}%`]);
      vendidas = await all(`SELECT a.id, u.correo AS user_correo, p.nombre AS prod_nombre, acc.correo AS acc_correo, acc.password AS acc_password,
        a.meses, a.start_at, a.end_at FROM allocations a
        LEFT JOIN users u ON u.id=a.user_id
        LEFT JOIN products p ON p.id=a.product_id
        LEFT JOIN accounts acc ON acc.id=a.account_id
        WHERE lower(u.correo) LIKE ? OR lower(p.nombre) LIKE ? ORDER BY a.id DESC;`, [`%${q}%`, `%${q}%`]);
    } else {
      usuarios = await all(`SELECT id,nombre,apellido,correo,saldo,activo FROM users ORDER BY id DESC LIMIT 15;`);
      productos = await all(`SELECT * FROM products ORDER BY id DESC LIMIT 50;`);
      cuentas = await all(`SELECT a.*, p.nombre AS prod_nombre FROM accounts a LEFT JOIN products p ON p.id=a.product_id ORDER BY a.id DESC LIMIT 100;`);
      vendidas = await all(`SELECT a.id, u.correo AS user_correo, p.nombre AS prod_nombre, acc.correo AS acc_correo, acc.password AS acc_password,
        a.meses, a.start_at, a.end_at FROM allocations a
        LEFT JOIN users u ON u.id=a.user_id
        LEFT JOIN products p ON p.id=a.product_id
        LEFT JOIN accounts acc ON acc.id=a.account_id ORDER BY a.id DESC LIMIT 100;`);
    }

    const totSaldo = await get(`SELECT SUM(saldo) as s FROM users;`);
    const totManualMes = await get(`SELECT SUM(monto) as s FROM manual_sales WHERE strftime('%Y-%m', fecha)=strftime('%Y-%m','now');`);
    const totSubsAct = await get(`SELECT COUNT(*) as c FROM subscriptions WHERE date(vence_en) >= date('now');`);
    const cuentasActivas = (await get(`SELECT COUNT(*) as c FROM accounts WHERE activo=1;`)).c || 0;
    const cuentasVendidas = (await get(`SELECT COUNT(*) as c FROM allocations;`)).c || 0;

    res.render('admin/panel', {
      csrfToken: req.csrfToken(),
      q,
      usuarios, productos, cuentas, vendidas,
      totSaldo, totManualMes, totSubsAct,
      cuentasActivas, cuentasVendidas
    });
  } catch (err) {
    console.error('❌ Error cargando admin/panel:', err);
    next(err);
  }
});

// 💰 Recargar saldo
app.post('/admin/recargar', requireAdmin, csrfProtection, async (req, res) => {
  const { correo, monto, nota } = req.body;
  const cantidad = parseInt(monto);
  if (!correo || !cantidad || cantidad <= 0) return res.redirect('/admin/panel?error=datos');

  const user = await get(`SELECT id, saldo FROM users WHERE lower(correo)=?;`, [correo.trim().toLowerCase()]);
  if (!user) return res.redirect('/admin/panel?error=nouser');

  const nuevoSaldo = (user.saldo || 0) + cantidad;
  await run(`UPDATE users SET saldo=? WHERE id=?;`, [nuevoSaldo, user.id]);
  await run(`INSERT INTO topups (user_id, monto, nota) VALUES (?,?,?);`, [user.id, cantidad, nota || 'Recarga admin']);
  res.redirect('/admin/panel?ok=recarga');
});

// ⚠️ 404 y 500
app.use((req, res) => res.status(404).render('404'));
app.use((err, req, res, next) => {
  console.error('❌ Error interno:', err);
  res.status(500).send('Error Interno del Servidor');
});

// 🚀 Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));
