// ✅ server.js (completo, con catálogo privado + compras + cuentas + recarga por correo)
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

// 🔒 Middlewares de autenticación
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect('/admin');
  next();
}

app.locals.appName = process.env.APP_NAME || 'Eliteflix';
app.locals.dayjs = dayjs;

// 🧱 Tablas existentes
await run(`CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT UNIQUE, passhash TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, apellido TEXT, pais TEXT, telefono TEXT, correo TEXT UNIQUE, passhash TEXT, saldo INTEGER DEFAULT 0, activo INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, etiqueta TEXT, precio INTEGER, logo TEXT, activo INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, product_id INTEGER, vence_en TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS topups (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, monto INTEGER, nota TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS manual_sales (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, descripcion TEXT, monto INTEGER, fecha TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, estado TEXT DEFAULT 'abierto', created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
await run(`CREATE TABLE IF NOT EXISTS ticket_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER, autor TEXT, mensaje TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);

// 🆕 Tablas nuevas para cuentas e asignaciones
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

// 👑 Crear admin por defecto si no existe
const adminCount = await get(`SELECT COUNT(*) as c FROM admins;`);
if (adminCount.c === 0) {
  const defaultUser = 'ml3838761@gmail.com';
  const defaultPass = '07141512';
  const passhash = await bcrypt.hash(defaultPass, 12);
  await run(`INSERT INTO admins (usuario, passhash) VALUES (?,?);`, [defaultUser, passhash]);
  console.log(`✅ Admin por defecto creado: ${defaultUser} / ${defaultPass}`);
}

// 🌱 Seed productos si está vacío
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

// 🌐 Exponer sesión + mensajes visuales en vistas
app.use((req, res, next) => {
  res.locals.sess = req.session;
  res.locals.ok = req.query.ok;
  res.locals.error = req.query.error;
  next();
});

// 🏠 Página principal (DEJAMOS TU LÓGICA ACTUAL)
app.get('/', async (req, res, next) => {
  try {
    const etiquetas = await all(`SELECT DISTINCT etiqueta FROM products WHERE activo=1 ORDER BY etiqueta;`);
    const filtro = req.query.f || '';
    const productos = filtro
      ? await all(`SELECT * FROM products WHERE activo=1 AND etiqueta=? ORDER BY nombre;`, [filtro])
      : await all(`SELECT * FROM products WHERE activo=1 ORDER BY nombre;`);
    res.render('home', { productos, etiquetas, filtro });
  } catch (e) { next(e); }
});

// 🔒 Catálogo SOLO para logueados (tu vista ya está lista para esto)
app.get('/catalogo', requireAuth, async (req, res, next) => {
  try {
    const productos = await all(`SELECT * FROM products WHERE activo=1 ORDER BY nombre;`);
    // La vista nueva ya no usa etiquetas/filtro, pero enviarlas no rompe nada
    res.render('catalogo', { productos, etiquetas: [], filtro: '' });
  } catch (e) { next(e); }
});

// 📝 Registro de clientes
app.get('/registro', csrfProtection, (req, res) => res.render('registro', { csrfToken: req.csrfToken(), errores: [] }));

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
    if (!errores.isEmpty()) return res.status(400).render('registro', { csrfToken: req.csrfToken(), errores: errores.array() });
    const { nombre, apellido, pais, telefono, password } = req.body;
    const correo = normalizeEmail(req.body.correo);
    const existe = await get(`SELECT id FROM users WHERE lower(correo)=?;`, [correo]);
    if (existe) return res.status(400).render('registro', { csrfToken: req.csrfToken(), errores: [{ msg: 'Ese correo ya está registrado.' }] });
    const passhash = await bcrypt.hash(password, 10);
    await run(`INSERT INTO users (nombre, apellido, pais, telefono, correo, passhash) VALUES (?,?,?,?,?,?);`, [nombre, apellido, pais, telefono || '', correo, passhash]);
    res.redirect('/login?ok=Registro completado');
  }
);

// 👤 Login clientes
app.get('/login', csrfProtection, (req, res) =>
  res.render('login', { csrfToken: req.csrfToken(), errores: [], ok: req.query.ok })
);

app.post('/login',
  csrfProtection,
  body('correo').isEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const correo = normalizeEmail(req.body.correo);
    const u = await get(`SELECT * FROM users WHERE lower(correo)=? AND activo=1;`, [correo]);
    if (!u) return res.status(400).render('login', { csrfToken: req.csrfToken(), errores: [{ msg: 'Credenciales inválidas o cuenta desactivada' }] });
    const ok = await bcrypt.compare(req.body.password, u.passhash);
    if (!ok) return res.status(400).render('login', { csrfToken: req.csrfToken(), errores: [{ msg: 'Credenciales inválidas' }] });
    req.session.user = { id: u.id, nombre: u.nombre, correo: u.correo };
    res.redirect('/panel?ok=Bienvenido');
  }
);

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/?ok=Sesión cerrada')));

// 👤 Panel usuario (enviamos asignaciones para credenciales)
app.get('/panel', csrfProtection, requireAuth, async (req, res) => {
  const user = await get(`SELECT * FROM users WHERE id=?;`, [req.session.user.id]);
  const sub = await get(
    `SELECT s.*, p.nombre as prod_nombre
     FROM subscriptions s
     LEFT JOIN products p ON p.id=s.product_id
     WHERE s.user_id=? ORDER BY s.id DESC LIMIT 1;`,
    [user.id]
  );
  const dias = sub ? Math.ceil((new Date(sub.vence_en) - new Date()) / (1000 * 60 * 60 * 24)) : null;

  // Nuevas: asignaciones para mostrar en panel (credenciales entregadas)
  const asignaciones = await all(
    `SELECT a.*, p.nombre AS prod_nombre, acc.correo AS acc_correo, acc.password AS acc_password
     FROM allocations a
     LEFT JOIN products p ON p.id=a.product_id
     LEFT JOIN accounts acc ON acc.id=a.account_id
     WHERE a.user_id=?
     ORDER BY a.id DESC LIMIT 50;`,
    [user.id]
  );

  res.render('panel', { csrfToken: req.csrfToken(), user, sub, dias, asignaciones, tickets: [] });
});

// 🧾 (Tickets) — lo dejamos por compatibilidad, aunque tu panel ya no lo usa
app.post('/ticket', csrfProtection, requireAuth, body('mensaje').notEmpty(), async (req, res) => {
  let ticketId = req.body.ticket_id;
  if (!ticketId) {
    const t = await run(`INSERT INTO tickets (user_id) VALUES (?);`, [req.session.user.id]);
    ticketId = t.lastID;
  }
  await run(`INSERT INTO ticket_messages (ticket_id, autor, mensaje) VALUES (?,?,?);`, [ticketId, 'cliente', req.body.mensaje]);
  res.redirect('/panel?ok=Mensaje enviado#soporte');
});

// 🛒 Páginas de compra (1, 2, 3 meses)
app.get('/comprar/:id', requireAuth, csrfProtection, async (req, res) => {
  const prod = await get(`SELECT * FROM products WHERE id=? AND activo=1;`, [parseInt(req.params.id)]);
  if (!prod) return res.redirect('/catalogo?error=Producto no disponible');
  res.render('comprar', { csrfToken: req.csrfToken(), prod });
});

app.post('/comprar/:id', requireAuth, csrfProtection, body('meses').isIn(['1','2','3']), async (req, res) => {
  const userId = req.session.user.id;
  const meses = parseInt(req.body.meses);
  const prod = await get(`SELECT * FROM products WHERE id=? AND activo=1;`, [parseInt(req.params.id)]);
  if (!prod) return res.redirect('/catalogo?error=Producto no disponible');

  const costo = (prod.precio || 0) * meses;
  const user = await get(`SELECT id, saldo FROM users WHERE id=?;`, [userId]);
  if ((user.saldo || 0) < costo) {
    return res.redirect(`/comprar/${prod.id}?error=Saldo insuficiente`);
  }

  // Descontar saldo
  const nuevoSaldo = (user.saldo || 0) - costo;
  await run(`UPDATE users SET saldo=? WHERE id=?;`, [nuevoSaldo, userId]);

  // Crear suscripción
  const vence = dayjs().add(meses, 'month').format('YYYY-MM-DD');
  await run(`INSERT INTO subscriptions (user_id, product_id, vence_en) VALUES (?,?,?);`, [userId, prod.id, vence]);

  // Buscar cuenta disponible (no repetitiva salvo cupos)
  const cuenta = await get(
    `SELECT * FROM accounts
     WHERE product_id=? AND activo=1 AND cupos_usados < cupos
     ORDER BY cupos_usados ASC, id ASC LIMIT 1;`,
    [prod.id]
  );

  if (!cuenta) {
    // Revertir saldo si no hay cuentas
    await run(`UPDATE users SET saldo=? WHERE id=?;`, [user.saldo, userId]);
    return res.redirect(`/comprar/${prod.id}?error=No hay cuentas disponibles por ahora`);
  }

  // Registrar asignación y actualizar cupos
  const endAt = dayjs().add(meses, 'month').toISOString();
  await run(
    `INSERT INTO allocations (user_id, product_id, account_id, meses, end_at) VALUES (?,?,?,?,?);`,
    [userId, prod.id, cuenta.id, meses, endAt]
  );
  await run(`UPDATE accounts SET cupos_usados = cupos_usados + 1 WHERE id=?;`, [cuenta.id]);

  // Si llegó al tope, dejarla como agotada (opcional: mantener activo=1 pero sin cupos)
  const after = await get(`SELECT cupos, cupos_usados FROM accounts WHERE id=?;`, [cuenta.id]);
  if (after && after.cupos_usados >= after.cupos) {
    // Puedes optar por desactivarla automáticamente:
    // await run(`UPDATE accounts SET activo=0 WHERE id=?;`, [cuenta.id]);
  }

  res.redirect(`/panel?ok=Compra realizada`);
});

// 🔑 Admin setup (solo primera vez)
app.get('/admin/setup', csrfProtection, async (req, res) => {
  const c = await get(`SELECT COUNT(*) as c FROM admins;`);
  if (c.c > 0) return res.redirect('/admin');
  res.render('admin/setup', { csrfToken: req.csrfToken(), errores: [] });
});
app.post('/admin/setup', csrfProtection, body('usuario').notEmpty(), body('password').isLength({ min: 8 }), async (req, res) => {
  const c = await get(`SELECT COUNT(*) as c FROM admins;`);
  if (c.c > 0) return res.redirect('/admin');
  const passhash = await bcrypt.hash(req.body.password, 12);
  await run(`INSERT INTO admins (usuario, passhash) VALUES (?,?);`, [req.body.usuario, passhash]);
  res.redirect('/admin?ok=Admin creado');
});

// 🧍‍♂️ Admin login
app.get('/admin', csrfProtection, async (req, res) => {
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

// 📊 Panel admin (ahora incluye cuentas y vendidas)
app.get('/admin/panel', requireAdmin, csrfProtection, async (req, res, next) => {
  try {
    const usuarios = await all(`SELECT id,nombre,apellido,correo,saldo,activo FROM users ORDER BY id DESC LIMIT 15;`);
    const productos = await all(`SELECT * FROM products ORDER BY id DESC LIMIT 50;`);

    const cuentas = await all(
      `SELECT a.*, p.nombre AS prod_nombre
       FROM accounts a LEFT JOIN products p ON p.id=a.product_id
       ORDER BY a.id DESC LIMIT 100;`
    );

    const vendidas = await all(
      `SELECT a.id, u.correo AS user_correo, p.nombre AS prod_nombre, acc.correo AS acc_correo, acc.password AS acc_password,
              a.meses, a.start_at, a.end_at, acc.id AS account_id
       FROM allocations a
       LEFT JOIN users u ON u.id=a.user_id
       LEFT JOIN products p ON p.id=a.product_id
       LEFT JOIN accounts acc ON acc.id=a.account_id
       ORDER BY a.id DESC LIMIT 100;`
    );

    const tickets = await all(`SELECT t.*, u.correo FROM tickets t LEFT JOIN users u ON u.id=t.user_id WHERE t.estado='abierto' ORDER BY t.id DESC LIMIT 10;`);
    const manual = await all(`SELECT m.*, u.correo FROM manual_sales m LEFT JOIN users u ON u.id=m.user_id ORDER BY m.id DESC LIMIT 10;`);
    const totSaldo = await get(`SELECT SUM(saldo) as s FROM users;`);
    const totManualMes = await get(`SELECT SUM(monto) as s FROM manual_sales WHERE strftime('%Y-%m', fecha)=strftime('%Y-%m','now');`);
    const totSubsAct = await get(`SELECT COUNT(*) as c FROM subscriptions WHERE date(vence_en) >= date('now');`);

    res.render('admin/panel', {
      csrfToken: req.csrfToken(),
      usuarios, productos, cuentas, vendidas,
      tickets, manual, totSaldo, totManualMes, totSubsAct
    });
  } catch (err) {
    console.error('❌ Error cargando admin/panel:', err);
    next(err);
  }
});

// 💰 Recargar saldo (por correo)
app.post('/admin/recargar', requireAdmin, csrfProtection, async (req, res) => {
  const { correo, monto, nota } = req.body;
  const cantidad = parseInt(monto);
  if (!correo || !cantidad || cantidad <= 0) return res.redirect('/admin/panel?error=datos');

  const user = await get(`SELECT id, saldo FROM users WHERE lower(correo)=?;`, [String(correo).trim().toLowerCase()]);
  if (!user) return res.redirect('/admin/panel?error=nouser');

  const nuevoSaldo = (user.saldo || 0) + cantidad;
  await run(`UPDATE users SET saldo=? WHERE id=?;`, [nuevoSaldo, user.id]);
  await run(`INSERT INTO topups (user_id, monto, nota) VALUES (?,?,?);`, [user.id, cantidad, nota || 'Recarga admin']);
  res.redirect('/admin/panel?ok=recarga');
});

// 🔄 Editar producto (logo, precio, activo) — tal como ya lo tenías
app.post('/admin/producto/:id/editar', requireAdmin, upload.single('logoimg'), csrfProtection, async (req, res) => {
  const { nombre, etiqueta, precio, activo, logo } = req.body;
  const activoVal = String(activo) === '1' ? 1 : 0;
  let logoField = logo;
  if (req.file) logoField = `/public/uploads/${req.file.filename}`;
  await run(`UPDATE products SET nombre=?, etiqueta=?, precio=?, logo=?, activo=? WHERE id=?;`,
    [nombre, etiqueta, parseInt(precio), logoField, activoVal, parseInt(req.params.id)]);
  res.redirect('/admin/panel?ok=Producto actualizado');
});

// 👤 Activar/Desactivar cliente — como ya estaba
app.post('/admin/cliente/:id/toggle', requireAdmin, csrfProtection, async (req, res) => {
  const user = await get(`SELECT activo FROM users WHERE id=?;`, [parseInt(req.params.id)]);
  const nuevo = user.activo ? 0 : 1;
  await run(`UPDATE users SET activo=? WHERE id=?;`, [nuevo, parseInt(req.params.id)]);
  res.redirect('/admin/panel?ok=Usuario actualizado');
});

// 🆕 Admin: crear cuenta disponible
app.post('/admin/cuenta/nueva', requireAdmin, csrfProtection, async (req, res) => {
  const { product_id, correo, password, cupos, notas, activo } = req.body;
  if (!product_id || !correo || !password) return res.redirect('/admin/panel?error=datos');
  await run(
    `INSERT INTO accounts (product_id, correo, password, notas, cupos, activo) VALUES (?,?,?,?,?,?);`,
    [parseInt(product_id), correo.trim(), password.trim(), (notas || '').trim(), parseInt(cupos || 1), String(activo) === '1' ? 1 : 0]
  );
  res.redirect('/admin/panel?ok=Cuenta creada');
});

// 🆕 Admin: activar/desactivar cuenta
app.post('/admin/cuenta/:id/toggle', requireAdmin, csrfProtection, async (req, res) => {
  const cta = await get(`SELECT activo FROM accounts WHERE id=?;`, [parseInt(req.params.id)]);
  if (!cta) return res.redirect('/admin/panel?error=nocuenta');
  const nuevo = cta.activo ? 0 : 1;
  await run(`UPDATE accounts SET activo=? WHERE id=?;`, [nuevo, parseInt(req.params.id)]);
  res.redirect('/admin/panel?ok=Cuenta actualizada');
});

// 🆕 Admin: reactivar cuenta (resetear cupos usados a 0 y activar)
app.post('/admin/cuenta/:id/reactivar', requireAdmin, csrfProtection, async (req, res) => {
  const { cupos } = req.body; // opcional: permitir ajustar cupos
  const id = parseInt(req.params.id);
  const cta = await get(`SELECT id FROM accounts WHERE id=?;`, [id]);
  if (!cta) return res.redirect('/admin/panel?error=nocuenta');

  if (cupos && parseInt(cupos) > 0) {
    await run(`UPDATE accounts SET cupos=?, cupos_usados=0, activo=1 WHERE id=?;`, [parseInt(cupos), id]);
  } else {
    await run(`UPDATE accounts SET cupos_usados=0, activo=1 WHERE id=?;`, [id]);
  }
  res.redirect('/admin/panel?ok=Cuenta reactivada');
});

// 404
app.use((req, res) => res.status(404).render('404'));

// 500
app.use((err, req, res, next) => {
  console.error('❌ Error interno:', err);
  res.status(500).send('Error Interno del Servidor');
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));
