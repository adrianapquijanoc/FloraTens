/**
 * worker.js — Cloudflare Worker
 * ------------------------------
 * Hace exactamente lo mismo que bold-signature.php, pero corre en Cloudflare
 * en vez de en tu servidor — funciona perfecto con GitHub Pages, que es 100%
 * estático y no puede ejecutar PHP.
 *
 * El precio NUNCA se calcula en el navegador: este Worker es la única fuente
 * de verdad de los precios, y genera la firma de integridad de Bold usando
 * tu llave secreta (que solo vive aquí, nunca en el HTML).
 */

// ⚠️ Reemplaza esto con tu llave SECRETA de Bold (panel Bold -> Llaves de integración)
const BOLD_SECRET_KEY = 'TU_LLAVE_SECRETA_BOLD';

// Catálogo de precios: la ÚNICA fuente de verdad.
const PRODUCTS = {
  'kit-flora-anual':      { name: 'Kit Flora anual',            price: 280000 },
  'kit-electrodos-anual': { name: 'Kit de electrodos (anual)',  price: 80000 },
};

export default {
  async fetch(request) {
    // Preflight CORS (el navegador lo envía antes del POST real)
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== 'POST') {
      return errorResponse('Método no permitido.', 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Cuerpo de la solicitud inválido.');
    }

    const items = body && typeof body.items === 'object' ? body.items : {};
    const entries = Object.entries(items);

    if (entries.length === 0) {
      return errorResponse('El carrito está vacío o no es válido.');
    }

    let amount = 0;
    const descriptionParts = [];

    for (const [productId, qtyRaw] of entries) {
      const qty = parseInt(qtyRaw, 10);
      const product = PRODUCTS[productId];

      if (!product || !Number.isInteger(qty) || qty <= 0 || qty > 50) {
        return errorResponse('Producto o cantidad inválida.');
      }

      amount += product.price * qty;
      descriptionParts.push(`${product.name} x${qty}`);
    }

    if (amount < 1000) {
      return errorResponse('El monto mínimo de compra es $1.000 COP.');
    }

    const currency = 'COP';
    const orderId = 'FLORA-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8);

    let description = descriptionParts.join(', ');
    if (description.length > 100) description = description.slice(0, 97) + '...';

    // Formato exigido por Bold: {orderId}{amount}{currency}{llaveSecreta}
    const concatenated = orderId + amount + currency + BOLD_SECRET_KEY;
    const signature = await sha256Hex(concatenated);

    return new Response(
      JSON.stringify({ orderId, amount, currency, description, signature }),
      { headers: corsHeaders() }
    );
  },
};

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // puedes cambiarlo a 'https://floratens.com' para restringirlo
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: corsHeaders(),
  });
}

async function sha256Hex(message) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
