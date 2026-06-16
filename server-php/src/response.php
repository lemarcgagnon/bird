<?php

declare(strict_types=1);

const MAX_JSON_BODY_BYTES = 262144;

function emit_security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:* http://localhost:*; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    if (strlen($raw) > MAX_JSON_BODY_BYTES) {
        json_response(['ok' => false, 'error' => 'payload_too_large'], 413);
        exit;
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_response(['ok' => false, 'error' => 'invalid_json'], 400);
        exit;
    }

    return $data;
}

function string_length_between(string $value, int $min, int $max): bool
{
    $length = strlen($value);
    return $length >= $min && $length <= $max;
}

function require_fields(array $data, array $fields): void
{
    foreach ($fields as $field) {
        if (!isset($data[$field]) || trim((string) $data[$field]) === '') {
            json_response(['ok' => false, 'error' => 'missing_field', 'field' => $field], 400);
            exit;
        }
    }
}
