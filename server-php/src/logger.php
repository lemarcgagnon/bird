<?php

declare(strict_types=1);

const LOG_LEVELS = ['debug', 'info', 'warning', 'error', 'critical', 'security'];
const AUDIT_OUTCOMES = ['success', 'failed', 'blocked'];
const STRIPE_LOG_STATUSES = ['received', 'processing', 'processed', 'failed', 'ignored'];
const LOG_EXACT_SENSITIVE_KEYS = [
    'email',
    'courriel',
    'recipient',
    'phone',
    'telephone',
];
const LOG_SENSITIVE_KEYS = [
    'password',
    'password_confirm',
    'token',
    'authorization',
    'session',
    'session_id',
    'cookie',
    'stripe_secret',
    'stripe_secret_key',
    'stripe_webhook_secret',
    'webhook_secret',
    'api_key',
    'client_secret',
    'card_number',
    'cvc',
    'mysql_password',
    'smtp_password',
];

function log_request_id(): string
{
    static $requestId = null;
    if ($requestId === null) {
        $requestId = bin2hex(random_bytes(16));
    }
    return $requestId;
}

function log_hash_salt(): string
{
    $salt = app_config_value('NICHOIR_LOG_HASH_SALT');
    if ($salt !== '') {
        return $salt;
    }
    $adminPasswordHash = app_config_value('NICHOIR_ADMIN_PASSWORD_HASH');
    return $adminPasswordHash !== '' ? $adminPasswordHash : 'nichoir-local-log-salt';
}

function log_hash_value(?string $value): ?string
{
    $value = trim((string) $value);
    return $value === '' ? null : hash('sha256', strtolower($value) . log_hash_salt());
}

function log_client_ip_hash(): ?string
{
    return log_hash_value((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
}

function log_user_agent(): string
{
    return substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
}

function log_route(): string
{
    $uri = (string) ($_SERVER['REQUEST_URI'] ?? '');
    return substr($uri, 0, 255);
}

function log_http_method(): string
{
    return substr((string) ($_SERVER['REQUEST_METHOD'] ?? ''), 0, 10);
}

function log_json(array $payload): string
{
    $json = json_encode(log_sanitize_context($payload), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    return is_string($json) ? substr($json, 0, 6000) : '{}';
}

function log_sanitize_context(mixed $value): mixed
{
    if (is_array($value)) {
        $clean = [];
        foreach ($value as $key => $item) {
            $keyString = is_string($key) ? strtolower($key) : (string) $key;
            if (in_array($keyString, LOG_EXACT_SENSITIVE_KEYS, true)) {
                $clean[$key] = '[redacted]';
                continue;
            }
            foreach (LOG_SENSITIVE_KEYS as $sensitiveKey) {
                if (str_contains($keyString, $sensitiveKey)) {
                    $clean[$key] = '[redacted]';
                    continue 2;
                }
            }
            $clean[$key] = log_sanitize_context($item);
        }
        return $clean;
    }
    if (is_string($value)) {
        return strlen($value) > 1000 ? substr($value, 0, 1000) . '...' : $value;
    }
    if (is_scalar($value) || $value === null) {
        return $value;
    }
    return '[unsupported]';
}

function app_log(PDO $pdo, string $level, string $channel, string $eventCode, string $message, array $context = [], ?int $userId = null, ?int $httpStatus = null, string $stackTrace = ''): void
{
    try {
        $level = in_array($level, LOG_LEVELS, true) ? $level : 'info';
        $stmt = $pdo->prepare(
            'INSERT INTO app_logs
             (level, channel, event_code, message, user_id, request_id, ip_hash, user_agent, route, http_method, http_status, context_json, stack_trace)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $level,
            substr($channel, 0, 50),
            substr($eventCode, 0, 100),
            substr($message, 0, 500),
            $userId,
            log_request_id(),
            log_client_ip_hash(),
            log_user_agent(),
            log_route(),
            log_http_method(),
            $httpStatus ?? http_response_code(),
            $context === [] ? null : log_json($context),
            $stackTrace === '' ? null : substr($stackTrace, 0, 12000),
        ]);
    } catch (Throwable $e) {
        error_log('Nichoir logging failed: ' . $e->getMessage());
    }
}

function audit_log(PDO $pdo, ?int $actorUserId, string $actorRole, string $action, string $targetType = '', string $targetId = '', string $outcome = 'success', string $reason = '', array $metadata = []): void
{
    try {
        $outcome = in_array($outcome, AUDIT_OUTCOMES, true) ? $outcome : 'success';
        $stmt = $pdo->prepare(
            'INSERT INTO audit_logs
             (actor_user_id, actor_role, action, target_type, target_id, outcome, reason, request_id, ip_hash, user_agent, metadata_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $actorUserId,
            substr($actorRole, 0, 50),
            substr($action, 0, 100),
            $targetType === '' ? null : substr($targetType, 0, 50),
            $targetId === '' ? null : substr($targetId, 0, 100),
            $outcome,
            $reason === '' ? null : substr($reason, 0, 255),
            log_request_id(),
            log_client_ip_hash(),
            log_user_agent(),
            $metadata === [] ? null : log_json($metadata),
        ]);
    } catch (Throwable $e) {
        error_log('Nichoir audit logging failed: ' . $e->getMessage());
    }
}

function stripe_event_log(PDO $pdo, string $eventId, string $eventType, string $stripeObjectId = '', bool $livemode = false, string $status = 'received', string $errorMessage = '', string $payloadHash = ''): void
{
    try {
        $status = in_array($status, STRIPE_LOG_STATUSES, true) ? $status : 'received';
        if (db_driver_name($pdo) === 'mysql') {
            $stmt = $pdo->prepare(
                'INSERT INTO stripe_event_logs
                 (stripe_event_id, event_type, stripe_object_id, livemode, status, error_message, payload_hash, processed_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IN ("processed", "failed", "ignored") THEN CURRENT_TIMESTAMP ELSE NULL END)
                 ON DUPLICATE KEY UPDATE
                    attempt_count = attempt_count + CASE WHEN VALUES(status) = "received" THEN 1 ELSE 0 END,
                    status = VALUES(status),
                    error_message = VALUES(error_message),
                    processed_at = CASE WHEN VALUES(status) IN ("processed", "failed", "ignored") THEN CURRENT_TIMESTAMP ELSE processed_at END'
            );
            $stmt->execute([$eventId, $eventType, $stripeObjectId, $livemode ? 1 : 0, $status, $errorMessage, $payloadHash, $status]);
            return;
        }

        $stmt = $pdo->prepare(
            'INSERT INTO stripe_event_logs
             (stripe_event_id, event_type, stripe_object_id, livemode, status, error_message, payload_hash, processed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IN ("processed", "failed", "ignored") THEN CURRENT_TIMESTAMP ELSE NULL END)
             ON CONFLICT(stripe_event_id) DO UPDATE SET
                attempt_count = attempt_count + CASE WHEN excluded.status = "received" THEN 1 ELSE 0 END,
                status = excluded.status,
                error_message = excluded.error_message,
                processed_at = CASE WHEN excluded.status IN ("processed", "failed", "ignored") THEN CURRENT_TIMESTAMP ELSE stripe_event_logs.processed_at END'
        );
        $stmt->execute([$eventId, $eventType, $stripeObjectId, $livemode ? 1 : 0, $status, $errorMessage, $payloadHash, $status]);
    } catch (Throwable $e) {
        error_log('Nichoir Stripe logging failed: ' . $e->getMessage());
    }
}

function log_register_shutdown(PDO $pdo, float $startedAt): void
{
    register_shutdown_function(static function () use ($pdo, $startedAt): void {
        $fatal = error_get_last();
        if (is_array($fatal) && in_array((int) ($fatal['type'] ?? 0), [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
            app_log($pdo, 'critical', 'php', 'php_error', (string) ($fatal['message'] ?? 'Fatal PHP error'), [
                'file' => (string) ($fatal['file'] ?? ''),
                'line' => (int) ($fatal['line'] ?? 0),
            ], null, 500);
        }

        $slowMs = (int) (app_config_value('NICHOIR_SLOW_REQUEST_MS', '1500'));
        $elapsedMs = (int) round((microtime(true) - $startedAt) * 1000);
        if ($slowMs > 0 && $elapsedMs >= $slowMs) {
            app_log($pdo, 'warning', 'api', 'slow_request', 'Requete lente', ['elapsed_ms' => $elapsedMs]);
        }
    });
}
