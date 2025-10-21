// ✅ controllers/salesController.js — Versión final lista para Render (ESM)
import Account from '../models/Account.js';
import Platform from '../models/Platform.js';
import { pickRandomAccounts } from './adminAccountsController.js';

/**
 * 🎟️ Procesa una compra de una plataforma
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
export const buyPlatform = async (req, res) => {
  try {
    const { platformId, quantity } = req.body;
    const count = Number(quantity) || 1;

    if (!platformId) {
      return res.status(400).send('Plataforma no especificada');
    }

    // 🔹 Buscar la plataforma seleccionada
    const platform = await Platform.findById(platformId).lean();
    if (!platform) {
      return res.status(404).send('Plataforma no encontrada');
    }

    // 🔹 Seleccionar cuentas aleatorias (sin repetir)
    const selectedAccounts = await pickRandomAccounts(platformId, count);

    if (!selectedAccounts.length) {
      return res.status(400).send('No hay cuentas disponibles para esta plataforma');
    }

    // 🔹 Mostrar resultado al cliente (vista o JSON)
    // Si tienes una vista EJS de confirmación, puedes renderizarla:
    return res.render('client/purchase-success', {
      title: 'Compra completada',
      platform,
      accounts: selectedAccounts
    });

    // 🔸 Alternativamente, si lo manejas desde AJAX / API:
    // res.json({ success: true, platform, accounts: selectedAccounts });

  } catch (err) {
    console.error('❌ Error al procesar la compra:', err);
    res.status(500).send('Error interno al procesar la compra');
  }
};

/**
 * 💰 (Opcional) Vista para mostrar la página de compra
 * Si usas una interfaz donde el cliente elige qué plataforma comprar.
 */
export const viewShop = async (req, res) => {
  try {
    const platforms = await Platform.find({}).sort({ name: 1 }).lean();
    res.render('client/shop', {
      title: 'Tienda de Plataformas',
      platforms
    });
  } catch (err) {
    console.error('❌ Error al cargar la tienda:', err);
    res.status(500).send('Error al cargar la tienda');
  }
};
