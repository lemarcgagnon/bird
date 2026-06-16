<?php

declare(strict_types=1);

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function app_private_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    $path = (string) getenv('NICHOIR_CONFIG_FILE');
    if ($path === '') {
        $path = dirname(__DIR__, 2) . '/config/production.php';
    }
    if (!is_file($path)) {
        $config = [];
        return $config;
    }
    try {
        $loaded = require $path;
    } catch (Throwable) {
        $loaded = [];
    }
    $config = is_array($loaded) ? $loaded : [];
    return $config;
}

function app_environment(): string
{
    $env = strtolower(trim(app_config_value('NICHOIR_ENV', 'development')));
    if (in_array($env, ['production', 'prod'], true)) {
        return 'production';
    }
    if (in_array($env, ['development', 'dev', 'local'], true)) {
        return 'development';
    }
    throw new RuntimeException('Invalid NICHOIR_ENV. Use development or production.');
}

function app_is_production(): bool
{
    return app_environment() === 'production';
}

function app_validate_runtime_config(): void
{
    if (!app_is_production()) {
        return;
    }

    $missing = [];
    foreach (['NICHOIR_PUBLIC_BASE_URL', 'NICHOIR_ADMIN_PASSWORD_HASH', 'NICHOIR_LOG_HASH_SALT'] as $name) {
        if (app_config_value($name) === '') {
            $missing[] = $name;
        }
    }

    if ($missing !== []) {
        throw new RuntimeException('Production configuration is incomplete. Missing: ' . implode(', ', $missing));
    }

    if (app_config_value('NICHOIR_DEBUG') === '1') {
        throw new RuntimeException('NICHOIR_DEBUG must be disabled in production.');
    }
    if (app_config_value('NICHOIR_ALLOW_UNSIGNED_STRIPE_WEBHOOKS') === '1') {
        throw new RuntimeException('Unsigned Stripe webhooks are not allowed in production.');
    }
}

function app_config_value(string $name, string $default = ''): string
{
    $env = getenv($name);
    if (is_string($env) && $env !== '') {
        return $env;
    }
    $config = app_private_config();
    $value = $config[$name] ?? null;
    return is_scalar($value) && (string) $value !== '' ? (string) $value : $default;
}

function app_apply_runtime_security(): void
{
    error_reporting(E_ALL);
    ini_set('log_errors', '1');
    ini_set('display_errors', app_config_value('NICHOIR_DEBUG') === '1' ? '1' : '0');
}

function app_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function app_secure_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => app_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function money_cents(int $amountCents, string $currency): string
{
    $amount = number_format($amountCents / 100, 2, ',', ' ');
    return $amount . ' ' . strtoupper($currency);
}
