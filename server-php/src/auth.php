<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';

const SESSION_DAYS = 14;

function random_token(): string
{
    return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

function token_hash(string $token): string
{
    return hash('sha256', $token);
}

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
        return trim($matches[1]);
    }
    return null;
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
    ];
}

function create_session(int $userId): string
{
    $token = random_token();
    $expires = (new DateTimeImmutable('+' . SESSION_DAYS . ' days'))->format(DATE_ATOM);
    $stmt = db()->prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([$userId, token_hash($token), $expires]);
    return $token;
}

function current_user(): ?array
{
    $token = bearer_token();
    if ($token === null) {
        return null;
    }

    $stmt = db()->prepare(
        'SELECT users.* FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = ? AND sessions.expires_at > ?'
    );
    $stmt->execute([token_hash($token), (new DateTimeImmutable())->format(DATE_ATOM)]);
    $user = $stmt->fetch();
    return is_array($user) ? $user : null;
}

function require_user(): array
{
    $user = current_user();
    if ($user === null) {
        json_response(['ok' => false, 'error' => 'unauthorized'], 401);
        exit;
    }
    return $user;
}
