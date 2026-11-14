<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo json_encode(['error' => 'Bu uç nokta yalnızca POST isteği kabul eder.']);
    return;
}

$contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
if ($contentType !== 'application/json') {
    http_response_code(415);
    echo json_encode(['error' => 'İstek gövdesi application/json olmalıdır.']);
    return;
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false || strlen($rawBody) > 262_144) {
    http_response_code(413);
    echo json_encode(['error' => 'İstek gövdesi boş veya izin verilen boyuttan büyük.']);
    return;
}

try {
    $payload = json_decode($rawBody, true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($payload)) {
        throw new InvalidArgumentException('İstek gövdesi bir JSON nesnesi olmalıdır.');
    }

    require_once __DIR__ . '/../src/HesaplamaEngine.php';
    $engine = new HesaplamaEngine();
    echo json_encode(
        $engine->calculate($payload),
        JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION,
    );
} catch (JsonException) {
    http_response_code(400);
    echo json_encode(['error' => 'Geçerli bir JSON gövdesi gönderin.']);
} catch (InvalidArgumentException $error) {
    http_response_code(422);
    echo json_encode(['error' => $error->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['error' => 'Hesaplama sırasında beklenmeyen bir hata oluştu.'], JSON_UNESCAPED_UNICODE);
}
