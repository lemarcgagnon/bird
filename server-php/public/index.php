<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/helpers.php';

app_apply_runtime_security();

require_once __DIR__ . '/../src/db.php';
require_once __DIR__ . '/../src/logger.php';
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/credits.php';
require_once __DIR__ . '/../src/mail.php';
require_once __DIR__ . '/../src/stripe.php';
require_once __DIR__ . '/../src/pages.php';
require_once __DIR__ . '/../src/response.php';
require_once __DIR__ . '/../src/stripe_webhook.php';

$requestStartedAt = microtime(true);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

emit_security_headers();

try {
    app_validate_runtime_config();
    run_migrations();
    log_register_shutdown(db(), $requestStartedAt);
} catch (Throwable $e) {
    error_log('Nichoir bootstrap failed: ' . $e->getMessage());
    $env = 'unknown';
    try {
        $env = app_environment();
    } catch (Throwable) {
        $env = 'invalid';
    }
    if ($path === '/api/health') {
        json_response([
            'ok' => false,
            'service' => 'nichoir-php',
            'env' => $env,
            'db' => false,
            'error' => 'configuration_error',
        ], 500);
        exit;
    }
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Nichoir production configuration is incomplete.\n";
    exit;
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = array_values(array_filter(array_map(
    static fn (string $value): string => trim($value),
    explode(',', app_config_value('NICHOIR_CORS_ORIGINS', 'http://127.0.0.1:8016'))
)));
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($method === 'GET' && $path === '/') {
    render_landing_page();
    exit;
}

if ($method === 'GET' && $path === '/pricing') {
    render_pricing_page();
    exit;
}

if ($method === 'GET' && $path === '/about') {
    render_about_page();
    exit;
}

if ($method === 'GET' && $path === '/contact') {
    render_contact_page();
    exit;
}

if ($method === 'GET' && $path === '/terms') {
    render_terms_page();
    exit;
}

if ($method === 'GET' && $path === '/legal') {
    render_legal_page();
    exit;
}

if ($method === 'GET' && $path === '/account') {
    render_account_page();
    exit;
}

$adminPath = admin_base_path();
$adminLoginPath = admin_login_path();
$adminLogoutPath = admin_logout_path();
$adminExportsPath = admin_exports_path();

if ($method === 'GET' && $path === $adminLoginPath) {
    render_admin_login_page();
    exit;
}

if ($method === 'POST' && $path === $adminLoginPath) {
    handle_admin_login();
    exit;
}

if ($method === 'POST' && $path === $adminLogoutPath) {
    handle_admin_logout();
    exit;
}

if ($method === 'GET' && $path === $adminPath) {
    if (!admin_allowed()) {
        header('Location: ' . $adminLoginPath);
        exit;
    }
    render_admin_page();
    exit;
}

if ($method === 'GET' && $path === $adminExportsPath) {
    if (!admin_allowed()) {
        header('Location: ' . $adminLoginPath);
        exit;
    }
    handle_admin_exports_download();
    exit;
}

if ($method === 'POST' && $path === $adminPath) {
    handle_admin_post();
    exit;
}

if ($method === 'POST' && $path === '/contact') {
    handle_contact_post();
    exit;
}

if ($method === 'POST' && $path === '/stripe/webhook') {
    handle_stripe_webhook();
    exit;
}

function valid_ticket_status(string $status): bool
{
    return in_array($status, ['open', 'closed'], true);
}

function account_activation_email_body(string $displayName, string $code): string
{
    $name = $displayName !== '' ? $displayName : 'Client Nichoir';
    return "Bonjour " . $name . ",\n\n"
        . "Voici ton code d'autorisation Nichoir: " . $code . "\n\n"
        . "Entre ce code dans la section Activation du compte pour activer ton compte. "
        . "Le code expire dans 24 heures.\n\n"
        . "Si tu n'as pas cree ce compte, ignore ce message.";
}

function send_account_activation_email(PDO $pdo, string $email, string $displayName, string $code): void
{
    smtp_send_email(
        $pdo,
        $email,
        'Code d activation Nichoir',
        account_activation_email_body($displayName, $code)
    );
}

function auth_activation_response(string $email, int $status = 202): void
{
    json_response(['ok' => true, 'requires_activation' => true, 'email' => $email], $status);
}

function auth_activation_failed_response(): void
{
    json_response(['ok' => false, 'error' => 'activation_failed'], 400);
}

function load_user_ticket(PDO $pdo, int $ticketId, int $userId): ?array
{
    $stmt = $pdo->prepare('SELECT id, user_id, subject, status, priority, assigned_to, created_at, updated_at, closed_at FROM tickets WHERE id = ? AND user_id = ?');
    $stmt->execute([$ticketId, $userId]);
    $ticket = $stmt->fetch();
    return is_array($ticket) ? $ticket : null;
}

function ticket_detail_payload(PDO $pdo, array $ticket): array
{
    $messages = $pdo->prepare('SELECT id, user_id, author_role, body, created_at FROM ticket_messages WHERE ticket_id = ? ORDER BY id ASC');
    $messages->execute([(int) $ticket['id']]);
    return [
        'ticket' => $ticket,
        'messages' => $messages->fetchAll(),
    ];
}

if ($method === 'GET' && $path === '/api/health') {
    $driver = db_driver();
    $env = app_environment();
    $dbOk = false;
    try {
        db()->query('SELECT 1')->fetchColumn();
        $dbOk = $driver === 'sqlite' ? file_exists(db_path()) : true;
    } catch (Throwable) {
        $dbOk = false;
    }
    $ok = $dbOk && ($env !== 'production' || $driver === 'mysql');
    json_response([
        'ok' => $ok,
        'service' => 'nichoir-php',
        'env' => $env,
        'db' => $dbOk,
        'db_driver' => $driver,
    ], $ok ? 200 : 500);
    exit;
}

if ($method === 'GET' && $path === '/api/admin/session') {
    json_response(['ok' => true, 'admin' => admin_logged_in()]);
    exit;
}

if ($method === 'POST' && $path === '/api/exports/quote') {
    $user = require_user();
    if (($user['status'] ?? 'active') !== 'active') {
        json_response(['ok' => false, 'error' => 'account_suspended'], 403);
        exit;
    }
    $data = read_json_body();
    $type = strtolower(trim((string) ($data['export_type'] ?? 'stl')));
    $cost = export_credit_cost(db(), $type);
    if ($cost === null) {
        json_response(['ok' => false, 'error' => 'invalid_export_type'], 400);
        exit;
    }
    $credits = (int) $user['credits'];
    $bonusCredits = export_partial_bonus_amount(db(), $credits, $cost);
    if ($credits + $bonusCredits < $cost) {
        json_response(['ok' => false, 'error' => 'insufficient_credits', 'credits' => $credits, 'cost' => $cost], 402);
        exit;
    }
    json_response([
        'ok' => true,
        'export_type' => $type,
        'credits' => $credits,
        'cost' => $cost,
        'bonus_credits' => $bonusCredits,
    ]);
    exit;
}

if ($method === 'POST' && $path === '/api/client-log') {
    $pdo = db();
    $user = current_user();
    $key = $user ? 'user:' . (int) $user['id'] : 'ip:' . auth_client_ip();
    if (!auth_rate_limit_hit($pdo, 'client_log', $key, 10, 60)) {
        app_log($pdo, 'security', 'client', 'rate_limit_triggered', 'Rate limit client-log atteint', ['scope' => $user ? 'user' : 'ip'], $user ? (int) $user['id'] : null, 429);
        json_response(['ok' => false, 'error' => 'too_many_requests'], 429);
        exit;
    }
    $data = read_json_body();
    $level = (string) ($data['level'] ?? 'error');
    $eventCode = preg_replace('/[^a-zA-Z0-9_.-]+/', '_', (string) ($data['event_code'] ?? 'client_error')) ?: 'client_error';
    $message = trim((string) ($data['message'] ?? 'Client log'));
    $context = $data['context'] ?? [];
    app_log(
        $pdo,
        in_array($level, ['debug', 'info', 'warning', 'error', 'critical'], true) ? $level : 'error',
        'client',
        substr($eventCode, 0, 100),
        $message === '' ? 'Client log' : substr($message, 0, 500),
        is_array($context) ? $context : [],
        $user ? (int) $user['id'] : null,
        202
    );
    json_response(['ok' => true], 202);
    exit;
}

if ($method === 'POST' && $path === '/api/auth/register') {
    $data = read_json_body();
    require_fields($data, ['email', 'password']);
    $email = strtolower(trim((string) $data['email']));
    $password = (string) $data['password'];
    $name = trim((string) ($data['display_name'] ?? ''));
    $pdo = db();
    auth_cleanup_security_state($pdo);
    auth_rate_limit_or_exit($pdo, 'register', $email);

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
        json_response(['ok' => false, 'error' => 'invalid_email'], 400);
        exit;
    }
    if (!string_length_between($password, 8, 200)) {
        json_response(['ok' => false, 'error' => 'weak_password'], 400);
        exit;
    }
    if (strlen($name) > 120) {
        json_response(['ok' => false, 'error' => 'invalid_display_name'], 400);
        exit;
    }

    $existing = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $existing->execute([$email]);
    if ($existing->fetchColumn()) {
        app_log($pdo, 'security', 'auth', 'register_existing_hidden', 'Inscription masquee pour courriel existant', ['email_hash' => log_hash_value($email)], null, 202);
        auth_activation_response($email);
        exit;
    }

    auth_email_quota_or_exit($pdo, $email);
    $code = email_verification_code();
    $now = email_verification_timestamp();
    $expires = email_verification_timestamp(EMAIL_VERIFICATION_TTL);

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare(
            'INSERT INTO users (email, password_hash, display_name, credits, status, email_verification_code_hash, email_verification_expires_at, email_verification_sent_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$email, password_hash($password, PASSWORD_DEFAULT), $name, 0, 'pending', token_hash($code), $expires, $now]);
        $userId = (int) $pdo->lastInsertId();
        send_account_activation_email($pdo, $email, $name, $code);
        app_log($pdo, 'security', 'auth', 'email_verification_sent', 'Code activation envoye', ['email_hash' => log_hash_value($email)], $userId, 202);
        audit_log($pdo, $userId, 'client', 'account_registered', 'user', (string) $userId, 'success', 'pending_activation', ['email_hash' => log_hash_value($email)]);
        $pdo->commit();
        auth_activation_response($email);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        app_log($pdo, 'security', 'auth', 'register_existing_hidden', 'Inscription masquee apres collision unique', ['email_hash' => log_hash_value($email)], null, 202);
        auth_activation_response($email);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        app_log($pdo, 'error', 'email', 'email_failed', 'Echec envoi code activation', ['email_hash' => log_hash_value($email), 'error' => $e->getMessage()], null, 503);
        json_response(['ok' => false, 'error' => 'activation_unavailable'], 503);
    }
    exit;
}

if ($method === 'POST' && $path === '/api/auth/activate') {
    $data = read_json_body();
    require_fields($data, ['email', 'code']);
    $email = strtolower(trim((string) $data['email']));
    $code = normalize_email_verification_code((string) $data['code']);
    $pdo = db();
    auth_cleanup_security_state($pdo);
    auth_rate_limit_or_exit($pdo, 'activate', $email);

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
        auth_activation_failed_response();
        exit;
    }
    if (strlen($code) !== EMAIL_VERIFICATION_CODE_DIGITS) {
        auth_activation_failed_response();
        exit;
    }

    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!is_array($user) || (string) ($user['status'] ?? '') !== 'pending') {
        app_log($pdo, 'security', 'auth', 'email_verification_failed', 'Activation refusee', ['email_hash' => log_hash_value($email), 'reason' => 'not_pending_or_missing'], null, 400);
        auth_activation_failed_response();
        exit;
    }
    if (auth_activation_blocked($user)) {
        app_log($pdo, 'security', 'auth', 'rate_limit_triggered', 'Activation bloquee temporairement', ['user_id' => (int) $user['id']], (int) $user['id'], 429);
        json_response(['ok' => false, 'error' => 'too_many_requests'], 429);
        exit;
    }
    if ((string) ($user['email_verification_code_hash'] ?? '') === '' || !hash_equals((string) $user['email_verification_code_hash'], token_hash($code))) {
        auth_record_activation_failure($pdo, $user);
        app_log($pdo, 'security', 'auth', 'email_verification_failed', 'Code activation invalide', ['user_id' => (int) $user['id']], (int) $user['id'], 400);
        auth_activation_failed_response();
        exit;
    }
    $expiresAt = (string) ($user['email_verification_expires_at'] ?? '');
    if ($expiresAt === '' || $expiresAt < email_verification_timestamp()) {
        auth_record_activation_failure($pdo, $user);
        app_log($pdo, 'security', 'auth', 'email_verification_failed', 'Code activation expire', ['user_id' => (int) $user['id']], (int) $user['id'], 400);
        auth_activation_failed_response();
        exit;
    }

    $userId = (int) $user['id'];
    $pdo->beginTransaction();
    try {
        $updated = $pdo->prepare(
            "UPDATE users
             SET status = 'active',
                 credits = credits + ?,
                 email_verified_at = CURRENT_TIMESTAMP,
                 email_verification_code_hash = '',
                 email_verification_expires_at = NULL,
                 email_verification_sent_at = NULL,
                 email_verification_attempts = 0,
                 email_verification_blocked_until = NULL
             WHERE id = ? AND status = 'pending'"
        );
        $updated->execute([WELCOME_CREDITS, $userId]);
        if ($updated->rowCount() !== 1) {
            throw new RuntimeException('activation_already_used');
        }
        $pdo->prepare('INSERT INTO credit_ledger (user_id, delta, reason, reference) VALUES (?, ?, ?, ?)')
            ->execute([$userId, WELCOME_CREDITS, 'welcome_credits', 'email_activation']);
        app_log($pdo, 'security', 'auth', 'email_verified', 'Compte active par code email', ['user_id' => $userId], $userId);
        audit_log($pdo, $userId, 'client', 'email_verified', 'user', (string) $userId);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_response(['ok' => false, 'error' => 'activation_failed'], 500);
        exit;
    }

    $token = create_session($userId);
    $fresh = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $fresh->execute([$userId]);
    json_response(['ok' => true, 'token' => $token, 'user' => public_user($fresh->fetch())]);
    exit;
}

if ($method === 'POST' && $path === '/api/auth/resend-activation') {
    $data = read_json_body();
    require_fields($data, ['email']);
    $email = strtolower(trim((string) $data['email']));
    $pdo = db();
    auth_cleanup_security_state($pdo);
    auth_rate_limit_or_exit($pdo, 'resend_activation', $email);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
        json_response(['ok' => false, 'error' => 'invalid_email'], 400);
        exit;
    }

    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!is_array($user) || (string) ($user['status'] ?? '') !== 'pending') {
        auth_activation_response($email);
        exit;
    }
    if (auth_activation_blocked($user)) {
        auth_activation_response($email);
        exit;
    }
    $sentAt = (string) ($user['email_verification_sent_at'] ?? '');
    if ($sentAt !== '' && $sentAt > sql_utc_datetime('-60 seconds')) {
        auth_activation_response($email);
        exit;
    }

    auth_email_quota_or_exit($pdo, $email);
    $code = email_verification_code();
    $now = email_verification_timestamp();
    $expires = email_verification_timestamp(EMAIL_VERIFICATION_TTL);
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE users SET email_verification_code_hash = ?, email_verification_expires_at = ?, email_verification_sent_at = ?, email_verification_attempts = 0, email_verification_blocked_until = NULL WHERE id = ?')
            ->execute([token_hash($code), $expires, $now, (int) $user['id']]);
        send_account_activation_email($pdo, $email, (string) ($user['display_name'] ?? ''), $code);
        app_log($pdo, 'security', 'auth', 'email_verification_sent', 'Code activation renvoye', ['user_id' => (int) $user['id']], (int) $user['id'], 202);
        $pdo->commit();
        auth_activation_response($email);
    } catch (Throwable $e) {
        $pdo->rollBack();
        app_log($pdo, 'error', 'email', 'email_failed', 'Echec renvoi code activation', ['email_hash' => log_hash_value($email), 'error' => $e->getMessage()], null, 503);
        json_response(['ok' => false, 'error' => 'activation_unavailable'], 503);
    }
    exit;
}

if ($method === 'POST' && $path === '/api/auth/login') {
    $data = read_json_body();
    require_fields($data, ['email', 'password']);
    $email = strtolower(trim((string) $data['email']));
    $pdo = db();
    auth_cleanup_security_state($pdo);
    auth_rate_limit_or_exit($pdo, 'login', $email);
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!is_array($user) || !password_verify((string) $data['password'], $user['password_hash'])) {
        app_log($pdo, 'security', 'auth', 'login_failed', 'Connexion refusee', ['email_hash' => log_hash_value($email), 'reason' => 'invalid_credentials'], null, 401);
        json_response(['ok' => false, 'error' => 'invalid_credentials'], 401);
        exit;
    }
    if ((string) ($user['status'] ?? '') === 'pending') {
        app_log($pdo, 'security', 'auth', 'login_failed', 'Connexion refusee pour compte non active', ['user_id' => (int) $user['id'], 'reason' => 'pending'], (int) $user['id'], 401);
        json_response(['ok' => false, 'error' => 'invalid_credentials'], 401);
        exit;
    }
    $token = create_session((int) $user['id']);
    app_log($pdo, 'security', 'auth', 'login_success', 'Connexion reussie', ['user_id' => (int) $user['id']], (int) $user['id']);
    audit_log($pdo, (int) $user['id'], 'client', 'login_success', 'user', (string) $user['id']);
    json_response(['ok' => true, 'token' => $token, 'user' => public_user($user)]);
    exit;
}

if ($method === 'POST' && $path === '/api/auth/logout') {
    $token = bearer_token();
    $user = current_user();
    if ($token !== null) {
        $stmt = db()->prepare('DELETE FROM sessions WHERE token_hash = ?');
        $stmt->execute([token_hash($token)]);
    }
    if ($user !== null) {
        app_log(db(), 'info', 'auth', 'logout', 'Deconnexion', ['user_id' => (int) $user['id']], (int) $user['id']);
        audit_log(db(), (int) $user['id'], 'client', 'logout', 'user', (string) $user['id']);
    }
    json_response(['ok' => true]);
    exit;
}

if ($method === 'GET' && $path === '/api/me') {
    $user = require_user();
    json_response(['ok' => true, 'user' => public_user($user)]);
    exit;
}

if ($method === 'POST' && $path === '/api/profile') {
    $user = require_user();
    $data = read_json_body();
    $email = strtolower(trim((string) ($data['email'] ?? $user['email'])));
    $name = trim((string) ($data['display_name'] ?? $user['display_name']));
    $password = (string) ($data['password'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254 || strlen($name) > 120) {
        json_response(['ok' => false, 'error' => 'invalid_profile'], 400);
        exit;
    }
    if ($password !== '' && !string_length_between($password, 8, 200)) {
        json_response(['ok' => false, 'error' => 'weak_password'], 400);
        exit;
    }
    $pdo = db();
    try {
        if ($password !== '') {
            $stmt = $pdo->prepare('UPDATE users SET email = ?, display_name = ?, password_hash = ? WHERE id = ?');
            $stmt->execute([$email, $name, password_hash($password, PASSWORD_DEFAULT), (int) $user['id']]);
            app_log($pdo, 'security', 'auth', 'password_changed', 'Mot de passe modifie', ['user_id' => (int) $user['id']], (int) $user['id']);
            audit_log($pdo, (int) $user['id'], 'client', 'password_changed', 'user', (string) $user['id']);
        } else {
            $stmt = $pdo->prepare('UPDATE users SET email = ?, display_name = ? WHERE id = ?');
            $stmt->execute([$email, $name, (int) $user['id']]);
        }
        if ($email !== (string) $user['email']) {
            app_log($pdo, 'security', 'auth', 'email_changed', 'Courriel modifie', ['user_id' => (int) $user['id'], 'email_hash' => log_hash_value($email)], (int) $user['id']);
            audit_log($pdo, (int) $user['id'], 'client', 'email_changed', 'user', (string) $user['id'], 'success', '', ['email_hash' => log_hash_value($email)]);
        }
        $fresh = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $fresh->execute([(int) $user['id']]);
        json_response(['ok' => true, 'user' => public_user($fresh->fetch())]);
    } catch (PDOException $e) {
        json_response(['ok' => false, 'error' => 'email_exists'], 409);
    }
    exit;
}

if ($method === 'GET' && $path === '/api/credits/ledger') {
    $user = require_user();
    $stmt = db()->prepare('SELECT delta, reason, reference, created_at FROM credit_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 50');
    $stmt->execute([(int) $user['id']]);
    json_response(['ok' => true, 'ledger' => $stmt->fetchAll()]);
    exit;
}

if ($method === 'GET' && $path === '/api/billing/summary') {
    $user = require_user();
    $pdo = db();
    $subscription = $pdo->prepare('SELECT provider, plan, status, current_period_end, cancel_at_period_end, updated_at FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1');
    $subscription->execute([(int) $user['id']]);
    $payments = $pdo->prepare('SELECT id, amount_cents, currency, status, description, stripe_invoice_id, invoice_url, invoice_pdf, created_at FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 20');
    $payments->execute([(int) $user['id']]);
    json_response([
        'ok' => true,
        'subscription' => $subscription->fetch() ?: [
            'provider' => 'stripe',
            'plan' => 'none',
            'status' => (string) ($user['subscription_status'] ?? 'none'),
            'current_period_end' => null,
            'cancel_at_period_end' => 0,
            'updated_at' => null,
        ],
        'payments' => $payments->fetchAll(),
    ]);
    exit;
}

if ($method === 'POST' && $path === '/api/checkout/stripe-link') {
    $user = require_user();
    $data = read_json_body();
    $offer = strtolower(trim((string) ($data['offer'] ?? 'credits')));
    if (!in_array($offer, STRIPE_OFFERS, true)) {
        json_response(['ok' => false, 'error' => 'invalid_offer'], 400);
        exit;
    }
    try {
        $session = stripe_create_checkout_session(db(), $user, $offer);
        app_log(db(), 'info', 'stripe', 'checkout_session_created', 'Session Checkout creee', [
            'offer' => $offer,
            'session_id' => (string) ($session['id'] ?? ''),
            'mode' => (string) ($session['mode'] ?? ''),
        ], (int) $user['id']);
        json_response([
            'ok' => true,
            'checkout_url' => (string) ($session['url'] ?? ''),
            'session_id' => (string) ($session['id'] ?? ''),
            'mode' => (string) ($session['mode'] ?? ''),
            'offer' => $offer,
        ]);
    } catch (Throwable $e) {
        app_log(db(), 'error', 'stripe', 'checkout_session_failed', 'Session Checkout refusee', [
            'offer' => $offer,
            'error' => $e->getMessage(),
        ], (int) $user['id'], 502);
        json_response(['ok' => false, 'error' => 'stripe_checkout_failed'], 502);
    }
    exit;
}

if ($method === 'POST' && $path === '/api/billing/portal') {
    $user = require_user();
    try {
        $session = stripe_create_portal_session(db(), $user);
        json_response([
            'ok' => true,
            'portal_url' => (string) ($session['url'] ?? ''),
            'session_id' => (string) ($session['id'] ?? ''),
        ]);
    } catch (Throwable $e) {
        app_log(db(), 'error', 'stripe', 'portal_session_failed', 'Session portail Stripe refusee', [
            'error' => $e->getMessage(),
        ], (int) $user['id'], 502);
        json_response(['ok' => false, 'error' => 'stripe_portal_failed'], 502);
    }
    exit;
}

if ($method === 'POST' && $path === '/api/exports/authorize') {
    $user = require_user();
    if (($user['status'] ?? 'active') !== 'active') {
        json_response(['ok' => false, 'error' => 'account_suspended'], 403);
        exit;
    }
    $data = read_json_body();
    $type = strtolower(trim((string) ($data['export_type'] ?? 'stl')));
    $cost = export_credit_cost(db(), $type);
    if ($cost === null) {
        json_response(['ok' => false, 'error' => 'invalid_export_type'], 400);
        exit;
    }
    $bonusCredits = export_partial_bonus_amount(db(), (int) $user['credits'], $cost);
    if ((int) $user['credits'] + $bonusCredits < $cost) {
        json_response(['ok' => false, 'error' => 'insufficient_credits', 'credits' => (int) $user['credits'], 'cost' => $cost], 402);
        exit;
    }

    $authToken = random_token();
    $expires = sql_utc_datetime('+10 minutes');
    $stmt = db()->prepare('INSERT INTO export_authorizations (user_id, export_type, credit_cost, auth_token_hash, expires_at) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([(int) $user['id'], $type, $cost, token_hash($authToken), $expires]);
    app_log(db(), 'info', 'api', 'export_authorized', 'Export autorise', ['export_type' => $type, 'cost' => $cost, 'bonus_credits' => $bonusCredits], (int) $user['id']);
    json_response(['ok' => true, 'authorization' => $authToken, 'export_type' => $type, 'cost' => $cost, 'bonus_credits' => $bonusCredits, 'expires_at' => $expires]);
    exit;
}

if ($method === 'POST' && $path === '/api/exports/consume') {
    $user = require_user();
    $data = read_json_body();
    require_fields($data, ['authorization']);
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT * FROM export_authorizations WHERE auth_token_hash = ? AND user_id = ? AND status = ? AND expires_at > ?');
        $stmt->execute([token_hash((string) $data['authorization']), (int) $user['id'], 'authorized', sql_utc_datetime()]);
        $auth = $stmt->fetch();
        if (!is_array($auth)) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'invalid_authorization'], 400);
            exit;
        }
        $claim = $pdo->prepare('UPDATE export_authorizations SET status = ? WHERE id = ? AND status = ?');
        $claim->execute(['processing', (int) $auth['id'], 'authorized']);
        if ($claim->rowCount() !== 1) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'invalid_authorization'], 409);
            exit;
        }
        $freshUserStmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $freshUserStmt->execute([(int) $user['id']]);
        $freshUser = $freshUserStmt->fetch();
        if (!is_array($freshUser) || ($freshUser['status'] ?? 'active') !== 'active') {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'account_suspended'], 403);
            exit;
        }
        $cost = (int) $auth['credit_cost'];
        $currentCredits = (int) $freshUser['credits'];
        $bonusCredits = export_partial_bonus_amount($pdo, $currentCredits, $cost);
        if ($currentCredits + $bonusCredits < $cost) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'insufficient_credits'], 402);
            exit;
        }
        if ($bonusCredits > 0) {
            $pdo->prepare('UPDATE users SET credits = credits + ? WHERE id = ?')->execute([$bonusCredits, (int) $user['id']]);
            $pdo->prepare('INSERT INTO credit_ledger (user_id, delta, reason, reference) VALUES (?, ?, ?, ?)')
                ->execute([(int) $user['id'], $bonusCredits, 'bonus_export_topup', (string) $auth['id']]);
            app_log($pdo, 'info', 'api', 'bonus_credits_granted', 'Bonus credits accordes pour solde partiel', ['bonus_credits' => $bonusCredits, 'authorization_id' => (int) $auth['id']], (int) $user['id']);
            audit_log($pdo, (int) $user['id'], 'client', 'bonus_export_topup', 'export_authorization', (string) $auth['id'], 'success', '', ['bonus_credits' => $bonusCredits]);
        }
        $debit = $pdo->prepare('UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?');
        $debit->execute([$cost, (int) $user['id'], $cost]);
        if ($debit->rowCount() !== 1) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'insufficient_credits'], 402);
            exit;
        }
        $pdo->prepare('UPDATE export_authorizations SET status = ?, consumed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?')->execute(['consumed', (int) $auth['id'], 'processing']);
        $pdo->prepare('INSERT INTO credit_ledger (user_id, delta, reason, reference) VALUES (?, ?, ?, ?)')->execute([(int) $user['id'], -$cost, 'export_' . $auth['export_type'], (string) $auth['id']]);
        app_log($pdo, 'info', 'api', 'export_consumed', 'Export consomme', ['export_type' => (string) $auth['export_type'], 'cost' => $cost, 'bonus_credits' => $bonusCredits, 'authorization_id' => (int) $auth['id']], (int) $user['id']);
        audit_log($pdo, (int) $user['id'], 'client', 'export_consumed', 'export_authorization', (string) $auth['id'], 'success', '', ['export_type' => (string) $auth['export_type'], 'cost' => $cost, 'bonus_credits' => $bonusCredits]);
        $pdo->commit();
        $freshStmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $freshStmt->execute([(int) $user['id']]);
        $fresh = $freshStmt->fetch();
        json_response(['ok' => true, 'user' => public_user($fresh), 'cost' => $cost, 'bonus_credits' => $bonusCredits]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_response(['ok' => false, 'error' => 'consume_failed'], 500);
    }
    exit;
}

if ($method === 'GET' && $path === '/api/tickets') {
    $user = require_user();
    $stmt = db()->prepare('SELECT id, subject, status, priority, assigned_to, created_at, updated_at, closed_at FROM tickets WHERE user_id = ? ORDER BY id DESC');
    $stmt->execute([(int) $user['id']]);
    json_response(['ok' => true, 'tickets' => $stmt->fetchAll()]);
    exit;
}

if ($method === 'GET' && preg_match('#^/api/tickets/(\d+)$#', $path, $matches)) {
    $user = require_user();
    $pdo = db();
    $ticket = load_user_ticket($pdo, (int) $matches[1], (int) $user['id']);
    if ($ticket === null) {
        json_response(['ok' => false, 'error' => 'ticket_not_found'], 404);
        exit;
    }
    json_response(['ok' => true] + ticket_detail_payload($pdo, $ticket));
    exit;
}

if ($method === 'POST' && $path === '/api/tickets') {
    $user = require_user();
    $data = read_json_body();
    require_fields($data, ['subject', 'body']);
    $subject = trim((string) $data['subject']);
    $body = trim((string) $data['body']);
    if (!string_length_between($subject, 1, 140) || !string_length_between($body, 1, 5000)) {
        json_response(['ok' => false, 'error' => 'invalid_ticket'], 400);
        exit;
    }
    $pdo = db();
    $notificationId = 0;
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO tickets (user_id, subject) VALUES (?, ?)');
        $stmt->execute([(int) $user['id'], $subject]);
        $ticketId = (int) $pdo->lastInsertId();
        $pdo->prepare('INSERT INTO ticket_messages (ticket_id, user_id, author_role, body) VALUES (?, ?, ?, ?)')
            ->execute([$ticketId, (int) $user['id'], 'client', $body]);
        $notificationId = ticket_notification_create(
            $pdo,
            $ticketId,
            (int) $user['id'],
            mail_settings($pdo)['support_email'],
            'Nouveau ticket #' . $ticketId . ': ' . $subject,
            "Client: " . (string) $user['email'] . "\n\n" . $body
        );
        app_log($pdo, 'info', 'ticket', 'ticket_created', 'Ticket client cree', ['ticket_id' => $ticketId], (int) $user['id']);
        audit_log($pdo, (int) $user['id'], 'client', 'ticket_created', 'ticket', (string) $ticketId);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_response(['ok' => false, 'error' => 'ticket_create_failed'], 500);
        exit;
    }
    ticket_notification_send($pdo, $notificationId);
    json_response(['ok' => true, 'ticket_id' => $ticketId], 201);
    exit;
}

if ($method === 'POST' && preg_match('#^/api/tickets/(\d+)/messages$#', $path, $matches)) {
    $user = require_user();
    $pdo = db();
    $ticket = load_user_ticket($pdo, (int) $matches[1], (int) $user['id']);
    if ($ticket === null) {
        json_response(['ok' => false, 'error' => 'ticket_not_found'], 404);
        exit;
    }
    if (($ticket['status'] ?? 'open') !== 'open') {
        json_response(['ok' => false, 'error' => 'ticket_closed'], 409);
        exit;
    }
    $data = read_json_body();
    require_fields($data, ['body']);
    $body = trim((string) $data['body']);
    if (!string_length_between($body, 1, 5000)) {
        json_response(['ok' => false, 'error' => 'invalid_ticket_message'], 400);
        exit;
    }
    $notificationId = 0;
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO ticket_messages (ticket_id, user_id, author_role, body) VALUES (?, ?, ?, ?)')
            ->execute([(int) $ticket['id'], (int) $user['id'], 'client', $body]);
        $pdo->prepare('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([(int) $ticket['id']]);
        $notificationId = ticket_notification_create(
            $pdo,
            (int) $ticket['id'],
            (int) $user['id'],
            mail_settings($pdo)['support_email'],
            'Reponse client ticket #' . (int) $ticket['id'],
            "Client: " . (string) $user['email'] . "\nTicket: #" . (int) $ticket['id'] . ' - ' . (string) $ticket['subject'] . "\n\n" . $body
        );
        app_log($pdo, 'info', 'ticket', 'ticket_replied', 'Reponse client ticket', ['ticket_id' => (int) $ticket['id']], (int) $user['id']);
        audit_log($pdo, (int) $user['id'], 'client', 'ticket_replied', 'ticket', (string) $ticket['id']);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_response(['ok' => false, 'error' => 'ticket_reply_failed'], 500);
        exit;
    }
    ticket_notification_send($pdo, $notificationId);
    $fresh = load_user_ticket($pdo, (int) $ticket['id'], (int) $user['id']);
    json_response(['ok' => true] + ticket_detail_payload($pdo, $fresh ?: $ticket));
    exit;
}

if ($method === 'POST' && preg_match('#^/api/tickets/(\d+)/status$#', $path, $matches)) {
    $user = require_user();
    $pdo = db();
    $ticket = load_user_ticket($pdo, (int) $matches[1], (int) $user['id']);
    if ($ticket === null) {
        json_response(['ok' => false, 'error' => 'ticket_not_found'], 404);
        exit;
    }
    $data = read_json_body();
    $status = strtolower(trim((string) ($data['status'] ?? '')));
    if (!valid_ticket_status($status)) {
        json_response(['ok' => false, 'error' => 'invalid_ticket_status'], 400);
        exit;
    }
    $closedAt = $status === 'closed' ? 'CURRENT_TIMESTAMP' : 'NULL';
    $notificationId = 0;
    $pdo->beginTransaction();
    try {
        $updateTicket = $pdo->prepare('UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP, closed_at = ' . $closedAt . ' WHERE id = ?');
        $updateTicket->execute([$status, (int) $ticket['id']]);
        $notificationId = ticket_notification_create(
            $pdo,
            (int) $ticket['id'],
            (int) $user['id'],
            mail_settings($pdo)['support_email'],
            'Statut ticket #' . (int) $ticket['id'] . ': ' . $status,
            "Client: " . (string) $user['email'] . "\nTicket: #" . (int) $ticket['id'] . ' - ' . (string) $ticket['subject'] . "\nNouveau statut: " . $status
        );
        $eventCode = $status === 'closed' ? 'ticket_closed' : 'ticket_reopened';
        app_log($pdo, 'info', 'ticket', $eventCode, 'Statut ticket client modifie', ['ticket_id' => (int) $ticket['id'], 'status' => $status], (int) $user['id']);
        audit_log($pdo, (int) $user['id'], 'client', $eventCode, 'ticket', (string) $ticket['id'], 'success', '', ['status' => $status]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_response(['ok' => false, 'error' => 'ticket_status_failed'], 500);
        exit;
    }
    ticket_notification_send($pdo, $notificationId);
    $fresh = load_user_ticket($pdo, (int) $ticket['id'], (int) $user['id']);
    json_response(['ok' => true] + ticket_detail_payload($pdo, $fresh ?: $ticket));
    exit;
}

json_response(['ok' => false, 'error' => 'not_found', 'path' => $path], 404);
