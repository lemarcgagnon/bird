<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';

const SESSION_DAYS = 14;
const ACCOUNT_SESSION_COOKIE = 'nichoir_account_session';
const WELCOME_CREDITS = 10;
const EMAIL_VERIFICATION_CODE_DIGITS = 6;
const EMAIL_VERIFICATION_TTL = '+24 hours';
const EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;
const EMAIL_VERIFICATION_BLOCK_TTL = '+15 minutes';
const PENDING_ACCOUNT_CLEANUP_GRACE = '-48 hours';
const AUTH_RATE_LIMIT_CLEANUP_GRACE = '-2 days';
const AUTH_EMAIL_DAILY_IP_LIMIT = 40;
const AUTH_EMAIL_DAILY_EMAIL_LIMIT = 5;

const AUTH_RATE_LIMITS = [
    'register' => [
        'ip' => [8, 3600],
        'email' => [3, 3600],
    ],
    'login' => [
        'ip' => [30, 900],
        'email' => [10, 900],
    ],
    'activate' => [
        'ip' => [30, 900],
        'email' => [10, 900],
    ],
    'resend_activation' => [
        'ip' => [8, 3600],
        'email' => [3, 3600],
    ],
];

function random_token(): string
{
    return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

function token_hash(string $token): string
{
    return hash('sha256', $token);
}

function email_verification_code(): string
{
    return (string) random_int(100000, 999999);
}

function normalize_email_verification_code(string $code): string
{
    return preg_replace('/\D+/', '', trim($code)) ?: '';
}

function email_verification_timestamp(string $modifier = 'now'): string
{
    return sql_utc_datetime($modifier);
}

function auth_client_ip(): string
{
    $ip = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    return $ip !== '' ? $ip : 'unknown';
}

function auth_rate_key(string $value): string
{
    return token_hash(strtolower(trim($value)));
}

function auth_rate_limit_hit(PDO $pdo, string $scope, string $key, int $limit, int $windowSeconds): bool
{
    $keyHash = auth_rate_key($key);
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $nowText = sql_utc_datetime($now);
    $resetAt = sql_utc_datetime($now->modify('+' . $windowSeconds . ' seconds'));

    $stmt = $pdo->prepare('SELECT id, attempts, reset_at FROM auth_rate_limits WHERE scope = ? AND key_hash = ? LIMIT 1');
    $stmt->execute([$scope, $keyHash]);
    $row = $stmt->fetch();

    if (!is_array($row) || (string) $row['reset_at'] <= $nowText) {
        if (is_array($row)) {
            $pdo->prepare('UPDATE auth_rate_limits SET attempts = 1, reset_at = ?, updated_at = ? WHERE id = ?')
                ->execute([$resetAt, $nowText, (int) $row['id']]);
            return true;
        }
        try {
            $pdo->prepare('INSERT INTO auth_rate_limits (scope, key_hash, attempts, reset_at, updated_at) VALUES (?, ?, ?, ?, ?)')
                ->execute([$scope, $keyHash, 1, $resetAt, $nowText]);
            return true;
        } catch (PDOException) {
            $pdo->prepare('UPDATE auth_rate_limits SET attempts = attempts + 1, updated_at = ? WHERE scope = ? AND key_hash = ?')
                ->execute([$nowText, $scope, $keyHash]);
            return true;
        }
    }

    if ((int) $row['attempts'] >= $limit) {
        return false;
    }
    $pdo->prepare('UPDATE auth_rate_limits SET attempts = attempts + 1, updated_at = ? WHERE id = ?')
        ->execute([$nowText, (int) $row['id']]);
    return true;
}

function auth_rate_limit_or_exit(PDO $pdo, string $action, string $email = ''): void
{
    $rules = AUTH_RATE_LIMITS[$action] ?? null;
    if (!is_array($rules)) {
        return;
    }
    [$ipLimit, $ipWindow] = $rules['ip'];
    if (!auth_rate_limit_hit($pdo, 'auth:' . $action . ':ip', auth_client_ip(), $ipLimit, $ipWindow)) {
        if (function_exists('app_log')) {
            app_log($pdo, 'security', 'auth', 'rate_limit_triggered', 'Rate limit IP auth atteint', ['action' => $action, 'scope' => 'ip'], null, 429);
        }
        json_response(['ok' => false, 'error' => 'too_many_requests'], 429);
        exit;
    }
    if ($email !== '') {
        [$emailLimit, $emailWindow] = $rules['email'];
        if (!auth_rate_limit_hit($pdo, 'auth:' . $action . ':email', $email, $emailLimit, $emailWindow)) {
            if (function_exists('app_log')) {
                app_log($pdo, 'security', 'auth', 'rate_limit_triggered', 'Rate limit email auth atteint', ['action' => $action, 'scope' => 'email', 'email_hash' => function_exists('log_hash_value') ? log_hash_value($email) : null], null, 429);
            }
            json_response(['ok' => false, 'error' => 'too_many_requests'], 429);
            exit;
        }
    }
}

function auth_email_quota_or_exit(PDO $pdo, string $email): void
{
    if (!auth_rate_limit_hit($pdo, 'email:activation:ip:daily', auth_client_ip(), AUTH_EMAIL_DAILY_IP_LIMIT, 86400)
        || !auth_rate_limit_hit($pdo, 'email:activation:email:daily', $email, AUTH_EMAIL_DAILY_EMAIL_LIMIT, 86400)) {
        if (function_exists('app_log')) {
            app_log($pdo, 'security', 'auth', 'activation_email_quota_blocked', 'Quota email activation atteint', ['email_hash' => function_exists('log_hash_value') ? log_hash_value($email) : null], null, 429);
        }
        json_response(['ok' => false, 'error' => 'too_many_requests'], 429);
        exit;
    }
}

function auth_cleanup_security_state(PDO $pdo): void
{
    static $cleaned = false;
    if ($cleaned) {
        return;
    }
    $cleaned = true;
    $pendingCutoff = email_verification_timestamp(PENDING_ACCOUNT_CLEANUP_GRACE);
    $rateCutoff = email_verification_timestamp(AUTH_RATE_LIMIT_CLEANUP_GRACE);
    $pending = $pdo->prepare("DELETE FROM users WHERE status = 'pending' AND email_verification_expires_at IS NOT NULL AND email_verification_expires_at < ?");
    $pending->execute([$pendingCutoff]);
    $rate = $pdo->prepare('DELETE FROM auth_rate_limits WHERE reset_at < ?');
    $rate->execute([$rateCutoff]);
    if (($pending->rowCount() > 0 || $rate->rowCount() > 0) && function_exists('app_log')) {
        app_log($pdo, 'info', 'cleanup', 'cleanup_completed', 'Nettoyage auth automatique', [
            'pending_accounts_deleted' => $pending->rowCount(),
            'rate_limits_deleted' => $rate->rowCount(),
        ]);
    }
}

function auth_activation_blocked(array $user): bool
{
    $blockedUntil = (string) ($user['email_verification_blocked_until'] ?? '');
    return $blockedUntil !== '' && $blockedUntil > email_verification_timestamp();
}

function auth_record_activation_failure(PDO $pdo, array $user): void
{
    $attempts = max(0, (int) ($user['email_verification_attempts'] ?? 0)) + 1;
    if ($attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
        $pdo->prepare('UPDATE users SET email_verification_attempts = 0, email_verification_blocked_until = ? WHERE id = ?')
            ->execute([email_verification_timestamp(EMAIL_VERIFICATION_BLOCK_TTL), (int) $user['id']]);
        if (function_exists('app_log')) {
            app_log($pdo, 'security', 'auth', 'account_locked', 'Activation compte bloquee temporairement', ['user_id' => (int) $user['id']], (int) $user['id'], 429);
        }
        return;
    }
    $pdo->prepare('UPDATE users SET email_verification_attempts = ?, email_verification_blocked_until = NULL WHERE id = ?')
        ->execute([$attempts, (int) $user['id']]);
}

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
        return trim($matches[1]);
    }
    return null;
}

function account_session_cookie_token(): ?string
{
    $token = trim((string) ($_COOKIE[ACCOUNT_SESSION_COOKIE] ?? ''));
    return $token !== '' ? $token : null;
}

function auth_cookie_secure(): bool
{
    return function_exists('app_is_https') && app_is_https();
}

function set_account_session_cookie(string $token): void
{
    setcookie(ACCOUNT_SESSION_COOKIE, $token, [
        'expires' => time() + (SESSION_DAYS * 86400),
        'path' => '/',
        'secure' => auth_cookie_secure(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    $_COOKIE[ACCOUNT_SESSION_COOKIE] = $token;
}

function clear_account_session_cookie(): void
{
    setcookie(ACCOUNT_SESSION_COOKIE, '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => auth_cookie_secure(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    unset($_COOKIE[ACCOUNT_SESSION_COOKIE]);
}

function account_session_token(): ?string
{
    return account_session_cookie_token() ?? bearer_token();
}

function public_user(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'email' => $user['email'],
        'display_name' => $user['display_name'],
        'credits' => (int) $user['credits'],
        'subscription_status' => $user['subscription_status'],
        'status' => $user['status'] ?? 'active',
        'email_verified' => (($user['status'] ?? 'active') !== 'pending') || ((string) ($user['email_verified_at'] ?? '') !== ''),
    ];
}

function create_session(int $userId): string
{
    $token = random_token();
    $expires = sql_utc_datetime('+' . SESSION_DAYS . ' days');
    $stmt = db()->prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([$userId, token_hash($token), $expires]);
    return $token;
}

function current_user(): ?array
{
    $token = account_session_token();
    if ($token === null) {
        return null;
    }

    $stmt = db()->prepare(
        'SELECT users.* FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = ? AND sessions.expires_at > ?'
    );
    $stmt->execute([token_hash($token), sql_utc_datetime()]);
    $user = $stmt->fetch();
    return is_array($user) ? $user : null;
}

function require_user(): array
{
    $user = current_user();
    if ($user === null) {
        if (function_exists('app_log')) {
            app_log(db(), 'security', 'auth', 'invalid_token', 'Session absente ou token invalide', [], null, 401);
        }
        json_response(['ok' => false, 'error' => 'unauthorized'], 401);
        exit;
    }
    return $user;
}
