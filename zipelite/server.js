// ✅ server.js (catálogo administrable con imagen + precios 1/2/3 meses y compra con saldo)
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

// 📁 Directorios
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
for (const d of [DATA_DIR, PUBLIC_DIR, UPLOADS_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

const SQLiteStore = SQLiteStoreFactory(session);

// 🖼️ Subida de imágenes (productos)
const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// 🧠 Vistas y layouts
app.set('view engine', 'ejs');
app.set('views', path.join(ROOT, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// 🛡 Seguridad, logs, middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/public', express.static(PUBLIC_DIR));

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
await run(`CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT UNIQUE,
  passhash TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);

await run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  apellido TEXT,
  pais TEXT,
  telefono TEXT,
  correo TEXT UNIQUE,
  passhash TEXT,
  saldo INTEGER DEFAULT 0,
  activo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);

await run(`CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  descripcion TEXT,
  precio1 INTEGER,
  precio2 INTEGER,
  precio3 INTEGER,
  logo TEXT,
  cupos_total INTEGER DEFAULT 0,
  cupos_usados INTEGER DEFAULT 0,
  activo INTEGER DEFAULT 1,
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

await run(`CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER,
  correo TEXT,
  password TEXT,
  notas TEXT,
  cupos INTEGER DEFAULT 1,
  cupos_usados INTEGER DEFAULT 0,
  activo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);

await run(`CREATE TABLE IF NOT EXISTS allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  product_id INTEGER,
  account_id INTEGER,
  meses INTEGER,
  start_at TEXT DEFAULT CURRENT_TIMESTAMP,
  end_at TEXT
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
    const productos = await all(`SELECT id, nombre, logo FROM products WHERE activo=1 ORDER BY id DESC LIMIT 36;`);
    res.render('home', { productos, etiquetas: [], filtro: '' });
  } catch (e) {
    next(e);
  }
});

// 🔒 Catálogo
app.get('/catalogo', requireAuth, csrfProtection, async (req, res, next) => {
  try {
    const productos = await all(`
      SELECT id, nombre, descripcion, logo, precio1, precio2, precio3, cupos_total, cupos_usados, activo
      FROM products
      WHERE activo=1
      ORDER BY id DESC;
    `);
    res.render('catalogo', { productos, csrfToken: req.csrfToken() });
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
    const correo = (req.body.correo || '').trim().toLowerCase();

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

// 👤 Login / Logout usuario
app.get('/login', csrfProtection, (req, res) =>
  res.render('login', { csrfToken: req.csrfToken(), errores: [], ok: req.query.ok })
);

app.post('/login', csrfProtection, async (req, res) => {
  const correo = (req.body.correo || '').trim().toLowerCase();
  const u = await get(`SELECT * FROM users WHERE lower(correo)=? AND activo=1;`, [correo]);
  if (!u)
    return res.status(400).render('login', { csrfToken: req.csrfToken(), errores: [{ msg: 'Credenciales inválidas' }] });
  const ok = await bcrypt.compare(req.body.password, u.passhash);
  if (!ok)
    return res.status(400).render('login', { csrfToken: req.csrfToken(), errores: [{ msg: 'Credenciales inválidas' }] });
  req.session.user = { id: u.id, nombre: u.nombre, correo: u.correo };
  res.redirect('/panel?ok=Bienvenido');
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/?ok=Sesión cerrada')));

// 👤 Panel usuario
app.get('/panel', requireAuth, async (req, res, next) => {
  try {
    const user = await get(`SELECT * FROM users WHERE id=?;`, [req.session.user.id]);
    const asignaciones = await all(`
      SELECT a.id, p.nombre AS producto, acc.correo, acc.password, a.meses, a.start_at, a.end_at
      FROM allocations a
      LEFT JOIN products p ON p.id=a.product_id
      LEFT JOIN accounts acc ON acc.id=a.account_id
      WHERE a.user_id=?
      ORDER BY a.id DESC;
    `, [user.id]);
    const subs = await all(`
      SELECT s.*, p.nombre AS producto
      FROM subscriptions s
      LEFT JOIN products p ON p.id=s.product_id
      WHERE s.user_id=?
      ORDER BY s.id DESC;
    `, [user.id]);
    res.render('panel', { title: 'Mi Panel', user, asignaciones, subs, ok: req.query.ok, error: req.query.error });
  } catch (err) {
    next(err);
  }
});

// 🛒 Compra con descuento de saldo
app.post('/comprar/:id', requireAuth, csrfProtection, async (req, res) => {
  try {
    const meses = parseInt(req.body.meses, 10);
    if (![1, 2, 3].includes(meses)) return res.redirect('/catalogo?error=Meses+inválidos');
    const producto = await get(`SELECT * FROM products WHERE id=? AND activo=1;`, [req.params.id]);
    if (!producto) return res.redirect('/catalogo?error=Producto+no+disponible');
    const precio = meses === 1 ? producto.precio1 : meses === 2 ? producto.precio2 : producto.precio3;
    if (!precio || precio <= 0) return res.redirect('/catalogo?error=Precio+no+configurado');
    const disponibles = (producto.cupos_total || 0) - (producto.cupos_usados || 0);
    if (disponibles <= 0) return res.redirect('/catalogo?error=Sin+cuentas+disponibles');
    const user = await get(`SELECT id, saldo FROM users WHERE id=? AND activo=1;`, [req.session.user.id]);
    if (!user) return res.redirect('/login');
    if ((user.saldo || 0) < precio) return res.redirect('/catalogo?error=Saldo+insuficiente');

    const cuenta = await get(`
      SELECT id, correo, password, cupos, cupos_usados
      FROM accounts
      WHERE product_id=? AND activo=1 AND (cupos_usados < cupos)
      ORDER BY id ASC
      LIMIT 1;
    `, [producto.id]);

    if (!cuenta) return res.redirect('/catalogo?error=No+hay+cuentas+disponibles');

    const nuevoSaldo = (user.saldo || 0) - precio;
    await run(`UPDATE users SET saldo=? WHERE id=?;`, [nuevoSaldo, user.id]);
    await run(`INSERT INTO manual_sales (user_id, descripcion, monto) VALUES (?,?,?);`,
      [user.id, `Compra ${producto.nombre} (${meses}M)`, precio]);
    await run(`UPDATE accounts SET cupos_usados = cupos_usados + 1 WHERE id=?;`, [cuenta.id]);
    await run(`UPDATE products SET cupos_usados = cupos_usados + 1 WHERE id=?;`, [producto.id]);
    const end = dayjs().add(meses, 'month').format('YYYY-MM-DD');
    await run(`INSERT INTO allocations (user_id, product_id, account_id, meses, end_at)
               VALUES (?,?,?,?,?);`, [user.id, producto.id, cuenta.id, meses, end]);
    res.redirect('/panel?ok=Compra+confirmada');
  } catch (err) {
    console.error('❌ Error compra:', err);
    res.redirect('/catalogo?error=Error+al+procesar');
  }
});

// 👑 Admin login
app.get('/admin', (req, res) => res.redirect('/admin/login'));
app.get('/admin/login', csrfProtection, (req, res) =>
  res.render('admin/login', { csrfToken: req.csrfToken(), errores: [], ok: req.query.ok })
);
app.post('/admin/login', csrfProtection, async (req, res) => {
  const { usuario, password } = req.body;
  const admin = await get(`SELECT * FROM admins WHERE lower(usuario)=?;`, [usuario.trim().toLowerCase()]);
  if (!admin)
    return res.status(400).render('admin/login', { csrfToken: req.csrfToken(), errores: [{ msg: 'Credenciales inválidas' }] });
  const ok = await bcrypt.compare(password, admin.passhash);
  if (!ok)
    return res.status(400).render('admin/login', { csrfToken: req.csrfToken(), errores: [{ msg: 'Credenciales inválidas' }] });
  req.session.admin = { id: admin.id, usuario: admin.usuario };
  res.redirect('/admin/panel');
});
app.get('/admin/logout', (req, res) => req.session.destroy(() => res.redirect('/admin/login?ok=Sesión cerrada')));

// 📊 Panel admin
app.get('/admin/panel', requireAdmin, csrfProtection, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    let usuarios, productos, cuentas, vendidas;
    if (q) {
      usuarios = await all(`SELECT id,nombre,apellido,correo,saldo,activo FROM users 
        WHERE lower(nombre) LIKE ? OR lower(apellido) LIKE ? OR lower(correo) LIKE ? ORDER BY id DESC;`,
        [`%${q}%`, `%${q}%`, `%${q}%`]);
      productos = await all(`SELECT * FROM products WHERE lower(nombre) LIKE ? OR lower(descripcion) LIKE ? ORDER BY id DESC;`,
        [`%${q}%`, `%${q}%`]);
      cuentas = await all(`SELECT a.*, p.nombre AS prod_nombre FROM accounts a 
        LEFT JOIN products p ON p.id=a.product_id
        WHERE lower(a.correo) LIKE ? OR lower(p.nombre) LIKE ? ORDER BY a.id DESC;`,
        [`%${q}%`, `%${q}%`]);
      vendidas = await all(`SELECT a.id, u.correo AS user_correo, p.nombre AS prod_nombre, acc.correo AS acc_correo, acc.password AS acc_password,
        a.meses, a.start_at, a.end_at FROM allocations a
        LEFT JOIN users u ON u.id=a.user_id
        LEFT JOIN products p ON p.id=a.product_id
        LEFT JOIN accounts acc ON acc.id=a.account_id
        WHERE lower(u.correo) LIKE ? OR lower(p.nombre) LIKE ? ORDER BY a.id DESC;`,
        [`%${q}%`, `%${q}%`]);
    } else {
      usuarios = await all(`SELECT id,nombre,apellido,correo,saldo,activo FROM users ORDER BY id DESC LIMIT 15;`);
      productos = await all(`SELECT * FROM products ORDER BY id DESC LIMIT 50;`);
      cuentas = await all(`SELECT a.*, p.nombre AS prod_nombre FROM accounts a 
        LEFT JOIN products p ON p.id=a.product_id ORDER BY a.id DESC LIMIT 100;`);
      vendidas = await all(`SELECT a.id, u.correo AS user_correo, p.nombre AS prod_nombre, acc.correo AS acc_correo, acc.password AS acc_password,
        a.meses, a.start_at, a.end_at FROM allocations a
        LEFT JOIN users u ON u.id=a.user_id
        LEFT JOIN products p ON p.id=a.product_id
        LEFT JOIN accounts acc ON acc.id=a.account_id ORDER BY a.id DESC LIMIT 100;`);
    }
    const totSaldo = await get(`SELECT SUM(saldo) as s FROM users;`);
    const totManualMes = await get(`SELECT SUM(monto) as s FROM manual_sales WHERE strftime('%Y-%m', fecha)=strftime('%Y-%m','now');`);
    const cuentasActivas = (await get(`SELECT COUNT(*) as c FROM accounts WHERE activo=1;`)).c || 0;
    const cuentasVendidas = (await get(`SELECT COUNT(*) as c FROM allocations;`)).c || 0;
    res.render('admin/panel', {
      csrfToken: req.csrfToken(),
      q, usuarios, productos, cuentas, vendidas,
      totSaldo, totManualMes, cuentasActivas, cuentasVendidas
    });
  } catch (err) {
    next(err);
  }
});

// 🆕 Alta y edición de productos
app.get('/admin/producto/nuevo', requireAdmin, csrfProtection, async (req, res) => {
  res.render('admin/producto_nuevo', { csrfToken: req.csrfToken(), ok: req.query.ok, error: req.query.error });
});
app.post('/admin/producto/nuevo', requireAdmin, upload.single('logo'), csrfProtection, async (req, res) => {
  try {
    const { nombre, descripcion, precio1, precio2, precio3, cupos_total } = req.body;
    if (!nombre || !precio1) return res.redirect('/admin/producto/nuevo?error=Faltan+datos');
    const logoPath = req.file ? `/public/uploads/${req.file.filename}` : '';
    await run(`INSERT INTO products (nombre, descripcion, precio1, precio2, precio3, logo, cupos_total, activo)
               VALUES (?,?,?,?,?,?,?,1);`,
      [nombre, descripcion, precio1, precio2 || 0, precio3 || 0, logoPath, cupos_total || 0]);
    res.redirect('/admin/panel?ok=Producto+creado');
  } catch {
    res.redirect('/admin/producto/nuevo?error=Error+al+crear');
  }
});
app.get('/admin/producto/editar/:id', requireAdmin, csrfProtection, async (req, res, next) => {
  try {
    const producto = await get(`SELECT * FROM products WHERE id=?;`, [req.params.id]);
    if (!producto) return res.status(404).render('404');
    res.render('admin/producto_editar', { csrfToken: req.csrfToken(), producto, ok: req.query.ok, error: req.query.error });
  } catch (err) {
    next(err);
  }
});
app.post('/admin/producto/editar/:id', requireAdmin, upload.single('logo'), csrfProtection, async (req, res) => {
  try {
    const { nombre, descripcion, precio1, precio2, precio3, cupos_total, activo } = req.body;
    if (!nombre || !precio1) return res.redirect(`/admin/producto/editar/${req.params.id}?error=Faltan+campos`);
    const prev = await get(`SELECT logo FROM products WHERE id=?;`, [req.params.id]);
    const logoPath = req.file ? `/public/uploads/${req.file.filename}` : prev.logo;
    await run(`UPDATE products SET nombre=?, descripcion=?, precio1=?, precio2=?, precio3=?, logo=?, cupos_total=?, activo=? WHERE id=?;`,
      [nombre, descripcion, precio1, precio2 || 0, precio3 || 0, logoPath, cupos_total || 0, activo ? 1 : 0, req.params.id]);
    res.redirect('/admin/panel?ok=Producto+actualizado');
  } catch {
    res.redirect(`/admin/producto/editar/${req.params.id}?error=Error+al+guardar`);
  }
});

// CRUD cuentas
app.get('/admin/cuenta/nueva', requireAdmin, csrfProtection, async (req, res) => {
  const productos = await all(`SELECT id, nombre FROM products WHERE activo=1 ORDER BY nombre;`);
  res.render('admin/cuenta_nueva', { csrfToken: req.csrfToken(), productos });
});
app.post('/admin/cuenta/nueva', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const { product_id, correo, password, notas, cupos } = req.body;
    if (!product_id || !correo || !password) return res.redirect('/admin/cuenta/nueva?error=Faltan+datos');
    await run(`INSERT INTO accounts (product_id, correo, password, notas, cupos) VALUES (?,?,?,?,?);`,
      [product_id, correo, password, notas || '', parseInt(cupos || 1)]);
    res.redirect('/admin/panel?ok=Cuenta+creada');
  } catch {
    res.redirect('/admin/cuenta/nueva?error=Error+al+crear');
  }
});
app.get('/admin/cuenta/editar/:id', requireAdmin, csrfProtection, async (req, res) => {
  const cuenta = await get(`SELECT * FROM accounts WHERE id=?;`, [req.params.id]);
  const productos = await all(`SELECT id, nombre FROM products WHERE activo=1 ORDER BY nombre;`);
  res.render('admin/cuenta_editar', { csrfToken: req.csrfToken(), cuenta, productos });
});
app.post('/admin/cuenta/editar/:id', requireAdmin, csrfProtection, async (req, res) => {
  const { product_id, correo, password, notas, cupos, activo } = req.body;
  await run(`UPDATE accounts SET product_id=?, correo=?, password=?, notas=?, cupos=?, activo=? WHERE id=?;`,
    [product_id, correo, password, notas, parseInt(cupos || 1), activo ? 1 : 0, req.params.id]);
  res.redirect('/admin/panel?ok=Cuenta+actualizada');
});

// ⚠️ 404 / 500
app.use((req, res) => res.status(404).render('404'));
app.use((err, req, res) => {
  console.error('❌ Error interno:', err);
  res.status(500).send('Error Interno del Servidor');
});

// 🚀 Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));
