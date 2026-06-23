<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

function admin_summary(): array
{
    $pdo = db();
    return [
        'users' => (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn(),
        'credits' => (int) $pdo->query('SELECT COALESCE(SUM(credits), 0) FROM users')->fetchColumn(),
        'exports' => (int) $pdo->query('SELECT COUNT(*) FROM export_authorizations')->fetchColumn(),
        'tickets' => (int) $pdo->query('SELECT COUNT(*) FROM tickets WHERE status = "open"')->fetchColumn(),
        'subscriptions' => (int) $pdo->query('SELECT COUNT(*) FROM subscriptions WHERE status = "active"')->fetchColumn(),
        'payments' => (int) $pdo->query('SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE status IN ("paid", "succeeded")')->fetchColumn(),
    ];
}

function is_local_request(): bool
{
    $addr = $_SERVER['REMOTE_ADDR'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    return in_array($addr, ['127.0.0.1', '::1'], true)
        || str_starts_with($host, '127.0.0.1:')
        || str_starts_with($host, 'localhost:');
}

function admin_allowed(): bool
{
    return admin_logged_in();
}

function admin_base_path(): string
{
    static $path = null;
    if ($path !== null) {
        return $path;
    }

    $configured = trim(app_config_value('NICHOIR_ADMIN_PATH', '/gestion-nichoir'));
    if ($configured === '') {
        $configured = '/gestion-nichoir';
    }
    if (!str_starts_with($configured, '/')) {
        $configured = '/' . $configured;
    }
    $configured = '/' . trim($configured, '/');
    $lower = strtolower($configured);

    if (in_array($lower, ['/admin', '/administration'], true)) {
        throw new RuntimeException('Reserved NICHOIR_ADMIN_PATH.');
    }
    if (!preg_match('/^\/[A-Za-z0-9][A-Za-z0-9_-]{2,60}$/', $configured)) {
        throw new RuntimeException('Invalid NICHOIR_ADMIN_PATH.');
    }

    $path = $configured;
    return $path;
}

function admin_login_path(): string
{
    return admin_base_path() . '/login';
}

function admin_logout_path(): string
{
    return admin_base_path() . '/logout';
}

function admin_exports_path(): string
{
    return admin_base_path() . '/exports/download';
}

function admin_path_is_admin(string $path): bool
{
    return $path === admin_base_path() || str_starts_with($path, admin_base_path() . '/');
}

function admin_logged_in(): bool
{
    app_secure_session_start();
    return !empty($_SESSION['nichoir_admin_authenticated']);
}

function admin_password_hash_value(): string
{
    return trim(app_config_value('NICHOIR_ADMIN_PASSWORD_HASH'));
}

function admin_password_configured(): bool
{
    return admin_password_hash_value() !== '';
}

function admin_verify_password(string $password): bool
{
    $hash = admin_password_hash_value();
    return $hash !== '' && password_verify($password, $hash);
}

function admin_mark_logged_in(): void
{
    app_secure_session_start();
    session_regenerate_id(true);
    $_SESSION['nichoir_admin_authenticated'] = true;
    $_SESSION['nichoir_admin_login_at'] = time();
}

function admin_mark_logged_out(): void
{
    app_secure_session_start();
    unset($_SESSION['nichoir_admin_authenticated'], $_SESSION['nichoir_admin_login_at'], $_SESSION['admin_csrf']);
    session_regenerate_id(true);
}

function admin_require_login_redirect(): void
{
    if (!admin_allowed()) {
        header('Location: ' . admin_login_path());
    }
}

function admin_csrf_input(): string
{
    return '<input type="hidden" name="csrf_token" value="' . h(admin_csrf_token()) . '">';
}

function admin_csrf_token(): string
{
    app_secure_session_start();
    if (!isset($_SESSION['admin_csrf']) || !is_string($_SESSION['admin_csrf']) || $_SESSION['admin_csrf'] === '') {
        $_SESSION['admin_csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['admin_csrf'];
}

function admin_csrf_valid(string $token): bool
{
    app_secure_session_start();
    $expected = (string) ($_SESSION['admin_csrf'] ?? '');
    return $token !== '' && $expected !== '' && hash_equals($expected, $token);
}

function redirect_admin(int $userId = 0, string $notice = '', int $ticketId = 0): void
{
    $parts = [];
    if ($userId > 0) {
        $parts[] = 'user_id=' . $userId;
    }
    if ($ticketId > 0) {
        $parts[] = 'ticket_id=' . $ticketId;
    }
    if ($notice !== '') {
        $parts[] = 'notice=' . rawurlencode($notice);
    }
    header('Location: ' . admin_base_path() . ($parts ? '?' . implode('&', $parts) : ''));
}

function admin_redirect_url(array $params = []): string
{
    $query = http_build_query($params);
    return admin_base_path() . ($query === '' ? '' : '?' . $query);
}

function admin_tab_value(string $value, string $fallback = 'admin-clients'): string
{
    $allowed = ['admin-support', 'admin-clients', 'admin-library', 'admin-billing', 'admin-exports', 'admin-logs', 'admin-settings'];
    return in_array($value, $allowed, true) ? $value : $fallback;
}

function admin_client_panel_value(string $value): string
{
    $allowed = ['profile', 'credits', 'billing', 'exports', 'library'];
    return in_array($value, $allowed, true) ? $value : 'profile';
}

function admin_client_modal_url(int $userId, string $returnTab = 'admin-clients', string $panel = 'profile'): string
{
    $returnTab = admin_tab_value($returnTab);
    return admin_redirect_url([
        'user_id' => $userId,
        'return_tab' => $returnTab,
        'client_panel' => admin_client_panel_value($panel),
    ]) . '#' . $returnTab;
}
