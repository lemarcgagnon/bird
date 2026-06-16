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
    $expected = (string) getenv('NICHOIR_ADMIN_KEY');
    if ($expected === '') {
        return is_local_request();
    }
    $provided = trim((string) ($_GET['key'] ?? ($_SERVER['HTTP_X_ADMIN_KEY'] ?? '')));
    return $provided !== '' && hash_equals($expected, $provided);
}

function admin_key_input(): string
{
    $key = trim((string) ($_GET['key'] ?? ($_POST['key'] ?? '')));
    return $key === '' ? '' : '<input type="hidden" name="key" value="' . h($key) . '">';
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
    $key = trim((string) ($_POST['key'] ?? ($_GET['key'] ?? '')));
    if ($key !== '') {
        $parts[] = 'key=' . rawurlencode($key);
    }
    if ($notice !== '') {
        $parts[] = 'notice=' . rawurlencode($notice);
    }
    header('Location: /admin' . ($parts ? '?' . implode('&', $parts) : ''));
}

function admin_redirect_url(array $params = []): string
{
    $key = trim((string) ($_POST['key'] ?? ($_GET['key'] ?? '')));
    if ($key !== '' && !isset($params['key'])) {
        $params['key'] = $key;
    }
    $query = http_build_query($params);
    return '/admin' . ($query === '' ? '' : '?' . $query);
}

function admin_tab_value(string $value, string $fallback = 'admin-clients'): string
{
    $allowed = ['admin-support', 'admin-clients', 'admin-billing', 'admin-exports', 'admin-logs', 'admin-settings'];
    return in_array($value, $allowed, true) ? $value : $fallback;
}

function admin_client_panel_value(string $value): string
{
    $allowed = ['profile', 'credits', 'billing', 'exports'];
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
