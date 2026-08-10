<?php
/**
 * bold-signature.php
 * -------------------
 * Este archivo calcula el monto a pagar y genera la firma de integridad de Bold
 * EN EL SERVIDOR, para que el precio nunca dependa de lo que llegue desde el navegador.
 *
 * IMPORTANTE:
 *  - Sube este archivo a la MISMA carpeta donde está tu index.html (public_html).
 *  - Reemplaza BOLD_SECRET_KEY por tu llave SECRETA de Bold (nunca la de identidad).
 *  - Nunca compartas este archivo ni la llave secreta con nadie.
 */

header('Content-Type: application/json; charset=utf-8');

// ⚠️ Reemplaza esto con tu llave SECRETA de Bold (Panel Bold -> Llaves de integración)
const BOLD_SECRET_KEY = 'TU_LLAVE_SECRETA_BOLD';

// Catálogo de precios: la ÚNICA fuente de verdad. El navegador solo puede
// decir "quiero 2 de este producto", nunca "este producto cuesta tanto".
const PRODUCTS = [
    'kit-flora-anual'       => ['name' => 'Kit Flora anual',            'price' => 280000],
    'kit-electrodos-anual'  => ['name' => 'Kit de electrodos (anual)',  'price' => 80000],
];

// ---- Leer el carrito enviado desde el navegador ----
$input = json_decode(file_get_contents('php://input'), true);
$items = is_array($input['items'] ?? null) ? $input['items'] : [];

if (empty($items)) {
    http_response_code(400);
    echo json_encode(['error' => 'El carrito está vacío o no es válido.']);
    exit;
}

// ---- Recalcular el total SIEMPRE desde el catálogo del servidor ----
$amount = 0;
$descriptionParts = [];

foreach ($items as $productId => $qty) {
    $qty = (int) $qty;

    if ($qty <= 0 || $qty > 50 || !isset(PRODUCTS[$productId])) {
        http_response_code(400);
        echo json_encode(['error' => 'Producto o cantidad inválida.']);
        exit;
    }

    $product = PRODUCTS[$productId];
    $amount += $product['price'] * $qty;
    $descriptionParts[] = $product['name'] . ' x' . $qty;
}

if ($amount < 1000) { // mínimo permitido por Bold
    http_response_code(400);
    echo json_encode(['error' => 'El monto mínimo de compra es $1.000 COP.']);
    exit;
}

$currency = 'COP';
$orderId  = 'FLORA-' . time() . '-' . bin2hex(random_bytes(3));

$description = implode(', ', $descriptionParts);
if (strlen($description) > 100) {
    $description = substr($description, 0, 97) . '...';
}

// ---- Generar el hash de integridad (formato exigido por Bold) ----
// {Identificador}{Monto}{Divisa}{LlaveSecreta}
$concatenated = $orderId . $amount . $currency . BOLD_SECRET_KEY;
$signature = hash('sha256', $concatenated);

// ---- Responder al navegador con los datos ya validados ----
echo json_encode([
    'orderId'     => $orderId,
    'amount'      => $amount,
    'currency'    => $currency,
    'description' => $description,
    'signature'   => $signature,
]);
