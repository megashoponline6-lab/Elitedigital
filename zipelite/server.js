// ✅ server.js — versión final completa y funcional con adquisición de planes

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

// ✅ Archivos estáticos
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// 🔄 Redirección imágenes antiguas
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

  res.status(404).send('Imagen no encontrada');
});

// 💾 Conexión MongoDB
if (process.env.MONGODB_URI) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB Atlas');
  } catch (err) {
    console.error('❌ Error al conectar con MongoDB Atlas:', err);
  }
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
  if (req.session.user) return res.redirect('/panel?error=No tienes permiso');
  if (!req.session.admin) return res.redirect('/admin');
  next();
}

// 🌍 Variables globales
app.locals.appName = process.env.APP_NAME || 'Eliteflix';
app.locals.dayjs = dayjs;

// 🧑‍💻 Crear admin por defecto
const adminExists = await Admin.findOne({ usuario: 'ml3838761@gmail.com' }).lean();
if (!adminExists) {
  const passhash = await bcrypt.hash('07141512', 12);
  await Admin.create({ usuario: 'ml3838761@gmail.com', passhash });
  console.log('✅ Admin por defecto creado');
}

// 🧭 Layout global
app.use((req, res, next) => {
  res.locals.sess = req.session;
  res.locals.ok = req.query.ok;
  res.locals.error = req.query.error;
  next();
});

// 🏠 Inicio
app.get('/', (req, res) => res.render('home', { productos: [] }));

// 🧍 Registro
app.get('/registro', csrfProtection, (req, res) => res.render('registro', { csrfToken: req.csrfToken(), errores: [] }));

function normalizeEmail(correo) {
  correo = (correo || '').trim().toLowerCase();
  const m = correo.match(/^([^@+]+)(\+[^@]+)?(@gmail\.com)$/);
  return m ? m[1] + m[3] : correo;
}

app.post('/registro', csrfProtection, body('correo').isEmail(), body('password').isLength({ min: 6 }), async (req, res) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) return res.status(400).render('registro', { csrfToken: req.csrfToken(), errores: errores.array() });
  const { nombre, apellido, pais, telefono, password } = req.body;
  const correo = normalizeEmail(req.body.correo);
  const existe = await User.findOne({ correo });
  if (existe) return res.redirect('/registro?error=Correo ya registrado');
  const passhash = await bcrypt.hash(password, 10);
  await User.create({ nombre, apellido, pais, telefono, correo, passhash });
  res.redirect('/login?ok=Registro completado');
});

// 🔐 Login usuario
app.get('/login', csrfProtection, (req, res) => res.render('login', { csrfToken: req.csrfToken(), errores: [], ok: req.query.ok }));
app.post('/login', csrfProtection, async (req, res) => {
  const correo = normalizeEmail(req.body.correo);
  const u = await User.findOne({ correo }).lean();
  if (!u) return res.redirect('/login?error=Usuario no encontrado');
  const ok = await bcrypt.compare(req.body.password, u.passhash);
  if (!ok) return res.redirect('/login?error=Contraseña incorrecta');
  req.session.user = { id: u._id, nombre: u.nombre, correo: u.correo };
  res.redirect('/panel');
});

// 🧑‍💼 Login admin
app.get('/admin', csrfProtection, (req, res) => res.render('admin/login', { csrfToken: req.csrfToken(), errores: [] }));
app.post('/admin', csrfProtection, async (req, res) => {
  const admin = await Admin.findOne({ usuario: req.body.usuario }).lean();
  if (!admin) return res.redirect('/admin?error=No existe');
  const ok = await bcrypt.compare(req.body.password, admin.passhash);
  if (!ok) return res.redirect('/admin?error=Contraseña incorrecta');
  req.session.admin = { id: admin._id, usuario: admin.usuario };
  res.redirect('/admin/panel');
});

// Rutas admin
app.use(adminAccountsRoutes);
app.use(adminPlatformsRoutes);

// 👤 Panel usuario
app.get('/panel', csrfProtection, requireAuth, async (req, res) => {
  const user = await User.findById(req.session.user.id).lean();
  const platforms = await Platform.find({ available: true }).sort({ name: 1 }).lean();
  const productos = platforms.map((p) => ({ _id: p._id, nombre: p.name, logo: p.logoUrl }));

  // Trae suscripciones activas
  const subs = await Account.find({ userId: user._id, activo: true }).populate('platform').lean();

  res.render('panel', { csrfToken: req.csrfToken(), user, subs, productos });
});

// 🎬 Detalle plataforma
app.get('/plataforma/:id', requireAuth, async (req, res) => {
  const plataforma = await Platform.findById(req.params.id).lean();
  if (!plataforma) return res.status(404).send('Plataforma no encontrada');

  const precios = [];
  for (let i = 1; i <= 12; i++) precios.push({ meses: i, precio: (plataforma.precioBase || 30) * i });
  res.render('plataforma', { plataforma, precios });
});

// 💳 Adquirir plan
app.post('/plataforma/:id/adquirir', requireAuth, async (req, res) => {
  try {
    const { meses, precio } = req.body;
    const plataforma = await Platform.findById(req.params.id).lean();
    const user = await User.findById(req.session.user.id);
    const costo = parseFloat(precio);
    const mesesInt = parseInt(meses);
    if (!plataforma || !user) return res.redirect('/panel?error=Datos inválidos');
    if (user.saldo < costo) return res.redirect(`/plataforma/${plataforma._id}?error=Saldo insuficiente`);

    user.saldo -= costo;
    await user.save();

    const vence = new Date();
    vence.setMonth(vence.getMonth() + mesesInt);

    await Account.create({ userId: user._id, platform: plataforma._id, meses: mesesInt, precioPagado: costo, vence_en: vence });
    res.redirect(`/panel?ok=Adquiriste ${plataforma.name} por ${mesesInt} mes${mesesInt > 1 ? 'es' : ''}`);
  } catch (err) {
    console.error(err);
    res.redirect('/panel?error=Error al adquirir plan');
  }
});

// 🚪 Logout
app.get(['/logout', '/admin/salir'], (req, res) => req.session.destroy(() => res.redirect('/login?ok=Sesión cerrada')));

// ⚠️ Errores
app.use((req, res) => res.status(404).render('404'));
app.use((err, req, res) => res.status(500).send('Error Interno'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));
