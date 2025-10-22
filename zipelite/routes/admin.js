// ✅ routes/admin.js — versión final lista para Render (ESM)
import express from 'express';
import csrf from 'csurf';

const router = express.Router();
const csrfProtection = csrf({ cookie: true });

/**
 * 📋 Página de login del administrador
 */
router.get('/admin', csrfProtection, (req, res) => {
  res.render('admin/admin-login', {
    title: 'Login de Administrador',
    csrfToken: req.csrfToken(),
    errores: []
  });
});

/**
 * 🔐 Procesar login
 * (Simula autenticación hasta que conectes con Mongo o bcrypt)
 */
router.post('/admin', csrfProtection, (req, res) => {
  const { email, password } = req.body;

  // ⚙️ Datos del admin por defecto (ya los creas en MongoDB al inicio)
  if (email === 'ml3838761@gmail.com' && password === '07141512') {
    req.session.admin = { email };
    return res.redirect('/admin/panel?ok=Bienvenido');
  }

  res.redirect('/admin?error=Credenciales incorrectas');
});

/**
 * 🧭 Panel principal del administrador
 */
router.get('/admin/panel', csrfProtection, (req, res) => {
  if (!req.session?.admin) {
    return res.redirect('/admin?error=Debes iniciar sesión');
  }

  res.render('admin/admin-panel', {
    title: 'Panel de Control',
    csrfToken: req.csrfToken(),
    errores: []
  });
});

/**
 * 🚪 Cerrar sesión del administrador
 */
router.get('/admin/salir', (req, res) => {
  try {
    if (req.session) {
      req.session.destroy(() => {});
    }
    res.redirect('/admin?ok=Sesión cerrada correctamente');
  } catch (err) {
    console.error('❌ Error al cerrar sesión:', err);
    res.redirect('/admin?error=Error al cerrar sesión');
  }
});

export default router;
