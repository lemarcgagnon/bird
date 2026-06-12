<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/db.php';
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/pages.php';
require_once __DIR__ . '/../src/response.php';
require_once __DIR__ . '/../src/stripe_webhook.php';

run_migrations();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

emit_security_headers();

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = array_values(array_filter(array_map(
    static fn (string $value): string => trim($value),
    explode(',', (string) (getenv('NICHOIR_CORS_ORIGINS') ?: 'http://127.0.0.1:8016'))
)));
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
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

if ($method === 'GET' && $path === '/account') {
    render_account_page();
    exit;
}

if ($method === 'GET' && $path === '/admin') {
    render_admin_page();
    exit;
}

if ($method === 'POST' && $path === '/admin') {
    handle_admin_post();
    exit;
}

if ($method === 'POST' && $path === '/stripe/webhook') {
    handle_stripe_webhook();
    exit;
}

function export_cost(string $type): ?int
{
    return match ($type) {
        'svg', 'png' => 1,
        'pdf' => 2,
        'stl' => 3,
        'zip' => 5,
        default => null,
    };
}

if ($method === 'GET' && $path === '/api/health') {
    json_response(['ok' => true, 'service' => 'nichoir-php', 'db' => file_exists(db_path())]);
    exit;
}

if ($method === 'POST' && $path === '/api/auth/register') {
    $data = read_json_body();
    require_fields($data, ['email', 'password']);
    $email = strtolower(trim((string) $data['email']));
    $password = (string) $data['password'];
    $name = trim((string) ($data['display_name'] ?? ''));

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

    try {
        $stmt = db()->prepare('INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)');
        $stmt->execute([$email, password_hash($password, PASSWORD_DEFAULT), $name]);
        $userId = (int) db()->lastInsertId();
        db()->prepare('INSERT INTO credit_ledger (user_id, delta, reason, reference) VALUES (?, ?, ?, ?)')
            ->execute([$userId, 10, 'welcome_credits', 'register']);
        $token = create_session($userId);
        $user = db()->query('SELECT * FROM users WHERE id = ' . $userId)->fetch();
        json_response(['ok' => true, 'token' => $token, 'user' => public_user($user)], 201);
    } catch (PDOException $e) {
        json_response(['ok' => false, 'error' => 'email_exists'], 409);
    }
    exit;
}

if ($method === 'POST' && $path === '/api/auth/login') {
    $data = read_json_body();
    require_fields($data, ['email', 'password']);
    $stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([strtolower(trim((string) $data['email']))]);
    $user = $stmt->fetch();
    if (!is_array($user) || !password_verify((string) $data['password'], $user['password_hash'])) {
        json_response(['ok' => false, 'error' => 'invalid_credentials'], 401);
        exit;
    }
    $token = create_session((int) $user['id']);
    json_response(['ok' => true, 'token' => $token, 'user' => public_user($user)]);
    exit;
}

if ($method === 'POST' && $path === '/api/auth/logout') {
    $token = bearer_token();
    if ($token !== null) {
        $stmt = db()->prepare('DELETE FROM sessions WHERE token_hash = ?');
        $stmt->execute([token_hash($token)]);
    }
    json_response(['ok' => true]);
    exit;
}

if ($method === 'GET' && $path === '/api/me') {
    $user = require_user();
    json_response(['ok' => true, 'user' => public_user($user)]);
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
    $payments = $pdo->prepare('SELECT id, amount_cents, currency, status, description, created_at FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 20');
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
    if (!in_array($offer, ['credits', 'atelier', 'pro'], true)) {
        json_response(['ok' => false, 'error' => 'invalid_offer'], 400);
        exit;
    }
    json_response([
        'ok' => true,
        'checkout_url' => 'https://checkout.stripe.com/c/pay/cs_test_placeholder',
        'mode' => 'placeholder',
        'offer' => $offer,
        'user' => public_user($user),
    ]);
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
    $cost = export_cost($type);
    if ($cost === null) {
        json_response(['ok' => false, 'error' => 'invalid_export_type'], 400);
        exit;
    }
    if ((int) $user['credits'] < $cost) {
        json_response(['ok' => false, 'error' => 'insufficient_credits', 'credits' => (int) $user['credits'], 'cost' => $cost], 402);
        exit;
    }

    $authToken = random_token();
    $expires = (new DateTimeImmutable('+10 minutes'))->format(DATE_ATOM);
    $stmt = db()->prepare('INSERT INTO export_authorizations (user_id, export_type, credit_cost, auth_token_hash, expires_at) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([(int) $user['id'], $type, $cost, token_hash($authToken), $expires]);
    json_response(['ok' => true, 'authorization' => $authToken, 'export_type' => $type, 'cost' => $cost, 'expires_at' => $expires]);
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
        $stmt->execute([token_hash((string) $data['authorization']), (int) $user['id'], 'authorized', (new DateTimeImmutable())->format(DATE_ATOM)]);
        $auth = $stmt->fetch();
        if (!is_array($auth)) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'invalid_authorization'], 400);
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
        if ((int) $freshUser['credits'] < $cost) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'insufficient_credits'], 402);
            exit;
        }
        $debit = $pdo->prepare('UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?');
        $debit->execute([$cost, (int) $user['id'], $cost]);
        if ($debit->rowCount() !== 1) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'insufficient_credits'], 402);
            exit;
        }
        $pdo->prepare('UPDATE export_authorizations SET status = ?, consumed_at = CURRENT_TIMESTAMP WHERE id = ?')->execute(['consumed', (int) $auth['id']]);
        $pdo->prepare('INSERT INTO credit_ledger (user_id, delta, reason, reference) VALUES (?, ?, ?, ?)')->execute([(int) $user['id'], -$cost, 'export_' . $auth['export_type'], (string) $auth['id']]);
        $pdo->commit();
        $fresh = $pdo->query('SELECT * FROM users WHERE id = ' . (int) $user['id'])->fetch();
        json_response(['ok' => true, 'user' => public_user($fresh), 'cost' => $cost]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_response(['ok' => false, 'error' => 'consume_failed'], 500);
    }
    exit;
}

if ($method === 'GET' && $path === '/api/tickets') {
    $user = require_user();
    $stmt = db()->prepare('SELECT id, subject, status, created_at, updated_at FROM tickets WHERE user_id = ? ORDER BY id DESC');
    $stmt->execute([(int) $user['id']]);
    json_response(['ok' => true, 'tickets' => $stmt->fetchAll()]);
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
    $stmt = db()->prepare('INSERT INTO tickets (user_id, subject) VALUES (?, ?)');
    $stmt->execute([(int) $user['id'], $subject]);
    $ticketId = (int) db()->lastInsertId();
    db()->prepare('INSERT INTO ticket_messages (ticket_id, user_id, body) VALUES (?, ?, ?)')
        ->execute([$ticketId, (int) $user['id'], $body]);
    json_response(['ok' => true, 'ticket_id' => $ticketId], 201);
    exit;
}

json_response(['ok' => false, 'error' => 'not_found', 'path' => $path], 404);
