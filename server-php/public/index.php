<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/db.php';
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/response.php';

run_migrations();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

header('Access-Control-Allow-Origin: http://127.0.0.1:8016');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function export_cost(string $type): int
{
    return match ($type) {
        'svg', 'png' => 1,
        'pdf' => 2,
        'stl' => 3,
        'zip' => 5,
        default => 1,
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

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(['ok' => false, 'error' => 'invalid_email'], 400);
        exit;
    }
    if (strlen($password) < 8) {
        json_response(['ok' => false, 'error' => 'weak_password'], 400);
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

if ($method === 'POST' && $path === '/api/checkout/stripe-link') {
    $user = require_user();
    json_response([
        'ok' => true,
        'checkout_url' => 'https://checkout.stripe.com/c/pay/cs_test_placeholder',
        'mode' => 'placeholder',
        'user' => public_user($user),
    ]);
    exit;
}

if ($method === 'POST' && $path === '/api/exports/authorize') {
    $user = require_user();
    $data = read_json_body();
    $type = strtolower(trim((string) ($data['export_type'] ?? 'stl')));
    $cost = export_cost($type);
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
        $cost = (int) $auth['credit_cost'];
        if ((int) $user['credits'] < $cost) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'insufficient_credits'], 402);
            exit;
        }
        $pdo->prepare('UPDATE users SET credits = credits - ? WHERE id = ?')->execute([$cost, (int) $user['id']]);
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
    $stmt = db()->prepare('INSERT INTO tickets (user_id, subject) VALUES (?, ?)');
    $stmt->execute([(int) $user['id'], trim((string) $data['subject'])]);
    $ticketId = (int) db()->lastInsertId();
    db()->prepare('INSERT INTO ticket_messages (ticket_id, user_id, body) VALUES (?, ?, ?)')
        ->execute([$ticketId, (int) $user['id'], trim((string) $data['body'])]);
    json_response(['ok' => true, 'ticket_id' => $ticketId], 201);
    exit;
}

json_response(['ok' => false, 'error' => 'not_found', 'path' => $path], 404);
