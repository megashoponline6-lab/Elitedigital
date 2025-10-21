// ✅ routes/sales.js — Versión final lista para Render (ESM)
import express from 'express';
import { viewShop, buyPlatform } from '../controllers/salesController.js';

const router = express.Router();

/**
 * 🛒 Vista de tienda (opcional)
 * Muestra las plataformas disponibles para comprar.
 */
router.get('/tienda', viewShop);

/**
 * 💳 Endpoint para procesar la compra
 * Recibe: platformId, quantity
 */
router.post('/comprar', buyPlatform);

/**
 * 🚀 Exportación por defecto
 */
export default router;
