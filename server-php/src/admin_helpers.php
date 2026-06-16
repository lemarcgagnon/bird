<?php

declare(strict_types=1);

require_once __DIR__ . '/admin_core.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/logger.php';
require_once __DIR__ . '/mail.php';

function admin_status_options(string $current): string
{
    $html = '';
    foreach (ADMIN_USER_STATUSES as $value => $label) {
        $selected = $current === $value ? ' selected' : '';
        $html .= '<option value="' . h($value) . '"' . $selected . '>' . h($label) . '</option>';
    }
    return $html;
}

function admin_plan_options(string $current): string
{
    $html = '';
    foreach (ADMIN_PLANS as $option) {
        $selected = $current === $option ? ' selected' : '';
        $html .= '<option value="' . h($option) . '"' . $selected . '>' . h($option) . '</option>';
    }
    return $html;
}

function admin_subscription_status_options(string $current): string
{
    $html = '';
    foreach (ADMIN_SUBSCRIPTION_STATUSES as $option) {
        $selected = $current === $option ? ' selected' : '';
        $html .= '<option value="' . h($option) . '"' . $selected . '>' . h($option) . '</option>';
    }
    return $html;
}

function ticket_status_options(string $current): string
{
    $html = '';
    foreach (TICKET_STATUSES as $value => $label) {
        $selected = $current === $value ? ' selected' : '';
        $html .= '<option value="' . h($value) . '"' . $selected . '>' . h($label) . '</option>';
    }
    return $html;
}

function ticket_priority_options(string $current): string
{
    $html = '';
    foreach (TICKET_PRIORITIES as $value => $label) {
        $selected = $current === $value ? ' selected' : '';
        $html .= '<option value="' . h($value) . '"' . $selected . '>' . h($label) . '</option>';
    }
    return $html;
}

function admin_valid_ticket_status(string $status): bool
{
    return array_key_exists($status, TICKET_STATUSES);
}

function admin_valid_ticket_priority(string $priority): bool
{
    return array_key_exists($priority, TICKET_PRIORITIES);
}

function audit_admin_action(PDO $pdo, ?int $userId, string $action, ?int $delta, string $note): void
{
    $key = (string) ($_POST['key'] ?? ($_GET['key'] ?? 'local-dev'));
    $hash = $key === '' ? '' : hash('sha256', $key);
    $stmt = $pdo->prepare('INSERT INTO admin_audit_log (admin_key_hash, user_id, action, delta, note) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$hash, $userId, $action, $delta, $note]);
    if (function_exists('audit_log')) {
        audit_log($pdo, null, 'admin', $action, $userId === null ? '' : 'user', $userId === null ? '' : (string) $userId, 'success', '', [
            'delta' => $delta,
            'note' => $note,
        ]);
    }
}

function admin_load_user(PDO $pdo, int $userId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    return is_array($user) ? $user : null;
}

function admin_load_ticket(PDO $pdo, int $ticketId, int $userId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM tickets WHERE id = ? AND user_id = ?');
    $stmt->execute([$ticketId, $userId]);
    $ticket = $stmt->fetch();
    return is_array($ticket) ? $ticket : null;
}

function admin_load_ticket_with_user(PDO $pdo, int $ticketId): ?array
{
    $stmt = $pdo->prepare(
        'SELECT tickets.*, users.email, users.display_name, users.credits, users.status AS user_status
         FROM tickets
         JOIN users ON users.id = tickets.user_id
         WHERE tickets.id = ?'
    );
    $stmt->execute([$ticketId]);
    $ticket = $stmt->fetch();
    return is_array($ticket) ? $ticket : null;
}

function admin_create_ticket_notification(PDO $pdo, array $ticket, array $user, string $subject, string $body): int
{
    $email = trim((string) ($user['email'] ?? ''));
    if ($email === '') {
        return 0;
    }
    return ticket_notification_create($pdo, (int) $ticket['id'], (int) $user['id'], $email, $subject, $body);
}

function admin_valid_user_status(string $status): bool
{
    return array_key_exists($status, ADMIN_USER_STATUSES);
}

function admin_valid_email(string $email): bool
{
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false && strlen($email) <= 254;
}

function admin_valid_display_name(string $name): bool
{
    return strlen($name) <= 120;
}

function admin_valid_password(string $password): bool
{
    return string_length_between($password, 8, 200);
}
