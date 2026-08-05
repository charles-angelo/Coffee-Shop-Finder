<?php

// 1. Ensure Vercel /tmp directory structures exist for read-only filesystem
$tmpDirs = [
    '/tmp/storage/framework/views',
    '/tmp/storage/framework/cache/data',
    '/tmp/storage/framework/sessions',
    '/tmp/storage/logs',
    '/tmp/bootstrap/cache'
];

foreach ($tmpDirs as $dir) {
    if (!is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }
}

// 2. Set environment fallbacks to prevent 500 error crashes
$defaultKey = 'base64:7vE8vB9m+7Y8xK9Z3pL0Q1w2e3r4t5y6u7i8o9p0a1s=';
$appKey = getenv('APP_KEY') ?: ($_ENV['APP_KEY'] ?? $defaultKey);

putenv('APP_ENV=production');
putenv('APP_DEBUG=false');
putenv('APP_KEY=' . $appKey);
putenv('DB_CONNECTION=sqlite');
putenv('DB_DATABASE=:memory:');

// Override storage & cache paths for serverless execution
putenv('VIEW_COMPILED_PATH=/tmp/storage/framework/views');
putenv('APP_SERVICES_CACHE=/tmp/bootstrap/cache/services.php');
putenv('APP_PACKAGES_CACHE=/tmp/bootstrap/cache/packages.php');
putenv('APP_CONFIG_CACHE=/tmp/bootstrap/cache/config.php');
putenv('APP_ROUTES_CACHE=/tmp/bootstrap/cache/routes.php');

$_ENV['APP_ENV'] = 'production';
$_ENV['APP_DEBUG'] = 'false';
$_ENV['APP_KEY'] = $appKey;
$_ENV['DB_CONNECTION'] = 'sqlite';
$_ENV['DB_DATABASE'] = ':memory:';

// 3. Forward request to Laravel entrypoint
require __DIR__ . '/../public/index.php';
