<?php

declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if ($path === '/mesai-api/calculate') {
    require __DIR__ . '/api.php';
    return true;
}

if ($path !== '/') {
    $requestedFile = realpath(__DIR__ . $path);
    $publicRoot = realpath(__DIR__);
    if (
        $requestedFile !== false
        && $publicRoot !== false
        && str_starts_with($requestedFile, $publicRoot . DIRECTORY_SEPARATOR)
        && is_file($requestedFile)
    ) {
        return false;
    }
}

require __DIR__ . '/index.php';
return true;
