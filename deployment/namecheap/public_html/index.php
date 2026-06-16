<?php

declare(strict_types=1);

if (!is_string(getenv('NICHOIR_ENV')) || getenv('NICHOIR_ENV') === '') {
    putenv('NICHOIR_ENV=production');
}

$privateRoot = getenv('NICHOIR_PRIVATE_ROOT');
if (!is_string($privateRoot) || $privateRoot === '') {
    $privateRoot = dirname(__DIR__) . '/nichoir_private';
}
$privateRoot = rtrim($privateRoot, '/');

$configFile = getenv('NICHOIR_CONFIG_FILE');
if ((!is_string($configFile) || $configFile === '') && is_file($privateRoot . '/config/production.php')) {
    putenv('NICHOIR_CONFIG_FILE=' . $privateRoot . '/config/production.php');
}

require $privateRoot . '/server-php/public/index.php';
