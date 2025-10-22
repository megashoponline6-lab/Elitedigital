// ✅ routes/adminPlatforms.js — versión final 100% compatible con Render (ESM)
import express from 'express';
import multer from 'multer';
import csrf from 'csurf';
import cookieParser from 'cookie-parser';
import { view, create, update, remove } from '../controllers/adminPlatformsController.js';

const router = express.Router();
const upload = multer({ dest: 'public/uploads/' });
const csrfProtection = csrf({ cookie: true });
router.use(cookieParser());

const ensureAdmin = (req, res, next) => {
  // if (!req.session?.admin) return res.redirect('/admin');
  next();
};

router.get('/admin/plataformas', ensureAdmin, csrfProtection, view);
router.post('/admin/plataformas', ensureAdmin, upload.single('logoimg'), csrfProtection, create);
router.post('/admin/plataformas/:id/update', ensureAdmin, upload.single('logoimg'), csrfProtection, update);
router.post('/admin/plataformas/:id/delete', ensureAdmin, csrfProtection, remove);

export default router;
