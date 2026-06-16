<?php

declare(strict_types=1);

const STRIPE_OFFERS = ['credits', 'atelier', 'pro'];

function stripe_settings(PDO $pdo): array
{
    $envSecret = app_config_value('NICHOIR_STRIPE_SECRET_KEY');
    $envWebhookSecret = app_config_value('NICHOIR_STRIPE_WEBHOOK_SECRET');
    return [
        'enabled' => setting_get($pdo, 'stripe_enabled', '0') === '1',
        'secret_key' => $envSecret !== '' ? $envSecret : setting_get($pdo, 'stripe_secret_key', ''),
        'webhook_secret' => $envWebhookSecret !== '' ? $envWebhookSecret : setting_get($pdo, 'stripe_webhook_secret', ''),
        'currency' => strtolower(setting_get($pdo, 'stripe_currency', 'cad')),
        'price_credits' => setting_get($pdo, 'stripe_price_credits', ''),
        'price_atelier' => setting_get($pdo, 'stripe_price_atelier', ''),
        'price_pro' => setting_get($pdo, 'stripe_price_pro', ''),
        'credits_quantity' => max(1, (int) setting_get($pdo, 'stripe_credits_quantity', '50')),
    ];
}

function stripe_setting_secret_is_env(string $name): bool
{
    return app_config_value($name) !== '';
}

function app_normalize_public_base_url(string $value): string
{
    $value = rtrim(trim($value), '/');
    if ($value === '') {
        return '';
    }
    $parts = parse_url($value);
    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $host = (string) ($parts['host'] ?? '');
    if (!in_array($scheme, ['http', 'https'], true)
        || $host === ''
        || isset($parts['user'], $parts['pass'], $parts['query'], $parts['fragment'])) {
        throw new RuntimeException('public_base_url_invalid');
    }
    $port = isset($parts['port']) ? ':' . (int) $parts['port'] : '';
    $path = rtrim((string) ($parts['path'] ?? ''), '/');
    return $scheme . '://' . $host . $port . $path;
}

function app_public_base_url(): string
{
    $configured = app_normalize_public_base_url(app_config_value('NICHOIR_PUBLIC_BASE_URL'));
    if ($configured !== '') {
        return $configured;
    }

    $remoteAddr = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if (in_array($remoteAddr, ['127.0.0.1', '::1'], true)) {
        return 'http://127.0.0.1:8021';
    }

    throw new RuntimeException('public_base_url_missing');
}

function app_absolute_url(string $path): string
{
    if (!str_starts_with($path, '/')) {
        throw new RuntimeException('public_url_path_invalid');
    }
    return app_public_base_url() . $path;
}

function stripe_form_value(array $params, string $prefix = ''): array
{
    $out = [];
    foreach ($params as $key => $value) {
        $name = $prefix === '' ? (string) $key : $prefix . '[' . $key . ']';
        if (is_array($value)) {
            $out += stripe_form_value($value, $name);
        } elseif ($value !== null) {
            $out[$name] = (string) $value;
        }
    }
    return $out;
}

function stripe_api_request(PDO $pdo, string $method, string $path, array $params = []): array
{
    $settings = stripe_settings($pdo);
    if (!$settings['enabled'] || $settings['secret_key'] === '') {
        throw new RuntimeException('stripe_not_configured');
    }
    if (!function_exists('curl_init')) {
        throw new RuntimeException('curl_missing');
    }

    $method = strtoupper($method);
    $url = 'https://api.stripe.com' . $path;
    $ch = curl_init();
    if ($ch === false) {
        throw new RuntimeException('curl_init_failed');
    }
    $headers = [
        'Authorization: Bearer ' . $settings['secret_key'],
        'Content-Type: application/x-www-form-urlencoded',
    ];
    $body = http_build_query(stripe_form_value($params), '', '&');
    if ($method === 'GET' && $body !== '') {
        $url .= '?' . $body;
    } elseif ($method !== 'GET') {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($raw === false || $raw === '') {
        throw new RuntimeException('stripe_request_failed: ' . $error);
    }
    $payload = json_decode((string) $raw, true);
    if (!is_array($payload)) {
        throw new RuntimeException('stripe_invalid_response');
    }
    if ($status < 200 || $status >= 300) {
        $message = $payload['error']['message'] ?? ('stripe_http_' . $status);
        throw new RuntimeException(is_scalar($message) ? (string) $message : ('stripe_http_' . $status));
    }
    return $payload;
}

function stripe_offer_config(PDO $pdo, string $offer): array
{
    $settings = stripe_settings($pdo);
    return match ($offer) {
        'credits' => [
            'mode' => 'payment',
            'price' => $settings['price_credits'],
            'plan' => 'credits',
            'credits' => $settings['credits_quantity'],
        ],
        'atelier' => [
            'mode' => 'subscription',
            'price' => $settings['price_atelier'],
            'plan' => 'atelier',
            'credits' => 0,
        ],
        'pro' => [
            'mode' => 'subscription',
            'price' => $settings['price_pro'],
            'plan' => 'pro',
            'credits' => 0,
        ],
        default => throw new InvalidArgumentException('invalid_offer'),
    };
}

function stripe_get_or_create_customer(PDO $pdo, array $user): string
{
    $customerId = trim((string) ($user['stripe_customer_id'] ?? ''));
    if ($customerId !== '') {
        return $customerId;
    }
    $customer = stripe_api_request($pdo, 'POST', '/v1/customers', [
        'email' => (string) $user['email'],
        'name' => (string) ($user['display_name'] ?? ''),
        'metadata' => [
            'user_id' => (string) $user['id'],
            'email' => (string) $user['email'],
        ],
    ]);
    $customerId = (string) ($customer['id'] ?? '');
    if ($customerId === '') {
        throw new RuntimeException('stripe_customer_missing');
    }
    $pdo->prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?')->execute([$customerId, (int) $user['id']]);
    return $customerId;
}

function stripe_create_checkout_session(PDO $pdo, array $user, string $offer): array
{
    $config = stripe_offer_config($pdo, $offer);
    if ($config['price'] === '') {
        throw new RuntimeException('stripe_price_missing');
    }
    $customerId = stripe_get_or_create_customer($pdo, $user);
    $metadata = [
        'user_id' => (string) $user['id'],
        'email' => (string) $user['email'],
        'offer' => $offer,
        'plan' => $config['plan'],
        'credits' => (string) $config['credits'],
    ];
    $params = [
        'mode' => $config['mode'],
        'customer' => $customerId,
        'client_reference_id' => (string) $user['id'],
        'success_url' => app_absolute_url('/account?checkout=success'),
        'cancel_url' => app_absolute_url('/account?checkout=cancel'),
        'line_items' => [
            ['price' => $config['price'], 'quantity' => 1],
        ],
        'metadata' => $metadata,
    ];
    if ($config['mode'] === 'payment') {
        $params['invoice_creation'] = ['enabled' => 'true'];
    } else {
        $params['subscription_data'] = ['metadata' => $metadata];
    }
    return stripe_api_request($pdo, 'POST', '/v1/checkout/sessions', $params);
}

function stripe_create_portal_session(PDO $pdo, array $user): array
{
    $customerId = stripe_get_or_create_customer($pdo, $user);
    return stripe_api_request($pdo, 'POST', '/v1/billing_portal/sessions', [
        'customer' => $customerId,
        'return_url' => app_absolute_url('/account'),
    ]);
}

function stripe_verify_webhook_signature(string $raw, string $signatureHeader, string $secret): bool
{
    if ($secret === '' || $signatureHeader === '') {
        return false;
    }
    $timestamp = null;
    $signatures = [];
    foreach (explode(',', $signatureHeader) as $part) {
        [$key, $value] = array_pad(explode('=', trim($part), 2), 2, '');
        if ($key === 't' && ctype_digit($value)) {
            $timestamp = (int) $value;
        } elseif ($key === 'v1' && $value !== '') {
            $signatures[] = $value;
        }
    }
    if ($timestamp === null || abs(time() - $timestamp) > 300 || !$signatures) {
        return false;
    }
    $expected = hash_hmac('sha256', $timestamp . '.' . $raw, $secret);
    foreach ($signatures as $signature) {
        if (hash_equals($expected, $signature)) {
            return true;
        }
    }
    return false;
}
