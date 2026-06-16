<?php

declare(strict_types=1);

const SMTP_ENCRYPTIONS = ['none', 'tls', 'ssl'];

function mail_settings(PDO $pdo): array
{
    $envPassword = app_config_value('NICHOIR_SMTP_PASSWORD');
    $password = setting_get($pdo, 'smtp_password', '');
    return [
        'enabled' => setting_get($pdo, 'smtp_enabled', '0') === '1',
        'host' => setting_get($pdo, 'smtp_host', ''),
        'port' => (int) setting_get($pdo, 'smtp_port', '587'),
        'encryption' => setting_get($pdo, 'smtp_encryption', 'tls'),
        'username' => setting_get($pdo, 'smtp_username', ''),
        'password' => $envPassword !== '' ? $envPassword : $password,
        'from_email' => setting_get($pdo, 'smtp_from_email', ''),
        'from_name' => setting_get($pdo, 'smtp_from_name', 'Nichoir support'),
        'support_email' => setting_get($pdo, 'support_email', app_config_value('NICHOIR_SUPPORT_EMAIL', 'support@nichoir.local')),
    ];
}

function smtp_header_value(string $value): string
{
    $clean = trim(str_replace(["\r", "\n"], ' ', $value));
    if ($clean === '') {
        return '';
    }
    return preg_match('/[^\x20-\x7E]/', $clean) ? '=?UTF-8?B?' . base64_encode($clean) . '?=' : $clean;
}

function smtp_address_header(string $email, string $name = ''): string
{
    $email = trim($email);
    $name = smtp_header_value($name);
    return $name === '' ? '<' . $email . '>' : $name . ' <' . $email . '>';
}

function smtp_read_response($socket): array
{
    $lines = [];
    while (($line = fgets($socket, 2048)) !== false) {
        $lines[] = rtrim($line, "\r\n");
        if (preg_match('/^\d{3}\s/', $line)) {
            break;
        }
    }
    $last = end($lines) ?: '';
    $code = (int) substr($last, 0, 3);
    return [$code, implode("\n", $lines)];
}

function smtp_command($socket, string $command, array $expected, ?string $label = null): string
{
    fwrite($socket, $command . "\r\n");
    [$code, $response] = smtp_read_response($socket);
    if (!in_array($code, $expected, true)) {
        throw new RuntimeException('SMTP ' . ($label ?? $command) . ' failed: ' . $response);
    }
    return $response;
}

function smtp_send_email(PDO $pdo, string $to, string $subject, string $body): void
{
    $settings = mail_settings($pdo);
    if (!$settings['enabled']) {
        throw new RuntimeException('smtp_disabled');
    }
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('invalid_recipient');
    }
    if (!filter_var($settings['from_email'], FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('invalid_from_email');
    }
    if ($settings['host'] === '' || $settings['port'] <= 0 || !in_array($settings['encryption'], SMTP_ENCRYPTIONS, true)) {
        throw new RuntimeException('invalid_smtp_settings');
    }

    $target = ($settings['encryption'] === 'ssl' ? 'ssl://' : '') . $settings['host'] . ':' . $settings['port'];
    $errno = 0;
    $errstr = '';
    $socket = stream_socket_client($target, $errno, $errstr, 12, STREAM_CLIENT_CONNECT);
    if (!is_resource($socket)) {
        throw new RuntimeException('smtp_connect_failed: ' . $errstr);
    }
    stream_set_timeout($socket, 12);

    try {
        [$code, $response] = smtp_read_response($socket);
        if ($code !== 220) {
            throw new RuntimeException('smtp_greeting_failed: ' . $response);
        }
        $hostName = $_SERVER['SERVER_NAME'] ?? 'localhost';
        smtp_command($socket, 'EHLO ' . $hostName, [250]);
        if ($settings['encryption'] === 'tls') {
            smtp_command($socket, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('smtp_starttls_failed');
            }
            smtp_command($socket, 'EHLO ' . $hostName, [250]);
        }
        if ($settings['username'] !== '') {
            smtp_command($socket, 'AUTH LOGIN', [334]);
            smtp_command($socket, base64_encode($settings['username']), [334], 'AUTH username');
            smtp_command($socket, base64_encode($settings['password']), [235], 'AUTH password');
        }

        $from = (string) $settings['from_email'];
        smtp_command($socket, 'MAIL FROM:<' . $from . '>', [250]);
        smtp_command($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
        smtp_command($socket, 'DATA', [354]);

        $headers = [
            'From: ' . smtp_address_header($from, (string) $settings['from_name']),
            'To: <' . $to . '>',
            'Subject: ' . smtp_header_value($subject),
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];
        $message = implode("\r\n", $headers) . "\r\n\r\n" . str_replace(["\r\n", "\r"], "\n", $body);
        $message = implode("\r\n", array_map(
            static fn (string $line): string => str_starts_with($line, '.') ? '.' . $line : $line,
            explode("\n", $message)
        ));
        fwrite($socket, $message . "\r\n.\r\n");
        [$dataCode, $dataResponse] = smtp_read_response($socket);
        if (!in_array($dataCode, [250, 251], true)) {
            throw new RuntimeException('smtp_data_failed: ' . $dataResponse);
        }
        smtp_command($socket, 'QUIT', [221]);
        if (function_exists('app_log')) {
            app_log($pdo, 'info', 'email', 'email_sent', 'Email envoye', [
                'recipient_hash' => function_exists('log_hash_value') ? log_hash_value($to) : null,
                'subject' => $subject,
            ]);
        }
    } catch (Throwable $e) {
        if (function_exists('app_log')) {
            app_log($pdo, 'error', 'email', 'email_failed', 'Echec envoi email', [
                'recipient_hash' => function_exists('log_hash_value') ? log_hash_value($to) : null,
                'subject' => $subject,
                'error' => $e->getMessage(),
            ]);
        }
        throw $e;
    } finally {
        fclose($socket);
    }
}

function ticket_notification_create(PDO $pdo, int $ticketId, int $userId, string $recipient, string $subject, string $body): int
{
    if ($recipient === '') {
        return 0;
    }
    $stmt = $pdo->prepare('INSERT INTO ticket_notifications (ticket_id, user_id, recipient, subject, body) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$ticketId, $userId, $recipient, $subject, $body]);
    return (int) $pdo->lastInsertId();
}

function ticket_notification_send(PDO $pdo, int $notificationId): bool
{
    if ($notificationId <= 0) {
        return false;
    }
    $stmt = $pdo->prepare('SELECT * FROM ticket_notifications WHERE id = ?');
    $stmt->execute([$notificationId]);
    $notification = $stmt->fetch();
    if (!is_array($notification)) {
        return false;
    }
    if (($notification['status'] ?? '') === 'sent') {
        return true;
    }
    try {
        smtp_send_email($pdo, (string) $notification['recipient'], (string) $notification['subject'], (string) $notification['body']);
        $pdo->prepare('UPDATE ticket_notifications SET status = ?, error = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?')
            ->execute(['sent', '', $notificationId]);
        return true;
    } catch (Throwable $e) {
        $status = $e->getMessage() === 'smtp_disabled' ? 'skipped' : 'failed';
        $pdo->prepare('UPDATE ticket_notifications SET status = ?, error = ? WHERE id = ?')
            ->execute([$status, substr($e->getMessage(), 0, 500), $notificationId]);
        return false;
    }
}
