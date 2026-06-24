<?php

declare(strict_types=1);

const DEFAULT_EXPORT_APP_ID = 'nichoir';
const EXPORT_TYPES = ['svg', 'png', 'pdf', 'stl', 'zip'];
const EXPORT_TYPE_DEFAULT_COSTS = [
    'svg' => 1,
    'png' => 1,
    'pdf' => 2,
    'stl' => 3,
    'zip' => 5,
];
const EXPORT_PRODUCTS = [
    'house_stl' => [
        'name' => 'House STL',
        'export_type' => 'stl',
        'credit_cost' => 3,
        'billable' => true,
        'admin_only' => false,
        'entitlement_policy' => 'model_fingerprint',
    ],
    'door_stl' => [
        'name' => 'Door STL',
        'export_type' => 'stl',
        'credit_cost' => 3,
        'billable' => true,
        'admin_only' => false,
        'entitlement_policy' => 'model_fingerprint',
    ],
    'female_wall_receiver_stl' => [
        'name' => 'Female wall receiver STL',
        'export_type' => 'stl',
        'credit_cost' => 3,
        'billable' => true,
        'admin_only' => false,
        'entitlement_policy' => 'model_fingerprint',
    ],
    'panels_zip' => [
        'name' => 'Panel ZIP',
        'export_type' => 'zip',
        'credit_cost' => 5,
        'billable' => true,
        'admin_only' => false,
        'entitlement_policy' => 'model_fingerprint',
    ],
    'plan_svg' => [
        'name' => 'Cut plan SVG',
        'export_type' => 'svg',
        'credit_cost' => 1,
        'billable' => true,
        'admin_only' => false,
        'entitlement_policy' => 'model_fingerprint',
    ],
    'plan_png' => [
        'name' => 'Cut plan PNG',
        'export_type' => 'png',
        'credit_cost' => 1,
        'billable' => true,
        'admin_only' => false,
        'entitlement_policy' => 'model_fingerprint',
    ],
    'explosion_png' => [
        'name' => 'Exploded assembly PNG',
        'export_type' => 'png',
        'credit_cost' => 1,
        'billable' => true,
        'admin_only' => false,
        'entitlement_policy' => 'model_fingerprint',
    ],
    'plan_pdf' => [
        'name' => 'Cut plan PDF',
        'export_type' => 'pdf',
        'credit_cost' => 2,
        'billable' => true,
        'admin_only' => false,
        'entitlement_policy' => 'model_fingerprint',
    ],
    'calculations_pdf' => [
        'name' => 'Calculations PDF',
        'export_type' => 'pdf',
        'credit_cost' => 2,
        'billable' => true,
        'admin_only' => false,
        'entitlement_policy' => 'model_fingerprint',
    ],
];
const EXPORT_APPS = [
    'nichoir' => [
        'name' => 'Nichoir',
        'entry_path' => '/app/',
        'description' => 'Calculateur maison d oiseau Rust/WASM.',
    ],
];

function export_product_catalog_definition(): array
{
    return EXPORT_PRODUCTS;
}

function export_product(string $productCode): ?array
{
    $productCode = strtolower(trim($productCode));
    return EXPORT_PRODUCTS[$productCode] ?? null;
}

function normalize_export_product_code(mixed $value = null, mixed $legacyType = null): ?string
{
    $productCode = strtolower(trim((string) ($value ?? '')));
    if ($productCode !== '') {
        if (!preg_match('/^[a-z0-9_-]{1,80}$/', $productCode)) {
            return null;
        }
        return array_key_exists($productCode, EXPORT_PRODUCTS) ? $productCode : null;
    }

    $type = strtolower(trim((string) ($legacyType ?? '')));
    return match ($type) {
        'stl' => 'house_stl',
        'zip' => 'panels_zip',
        'svg' => 'plan_svg',
        'png' => 'plan_png',
        'pdf' => 'plan_pdf',
        default => null,
    };
}

function credit_policy_settings(PDO $pdo): array
{
    return [
        'export_cost' => max(1, (int) setting_get($pdo, 'export_credit_cost', '3')),
        'partial_bonus_enabled' => setting_get($pdo, 'partial_credit_bonus_enabled', '1') === '1',
    ];
}

function export_type_default_credit_cost(string $type): ?int
{
    $type = strtolower(trim($type));
    return EXPORT_TYPE_DEFAULT_COSTS[$type] ?? null;
}

function export_product_catalog_credit_cost(array $product): int
{
    if (!(bool) ($product['billable'] ?? false)) {
        return 0;
    }
    return max(0, (int) ($product['credit_cost'] ?? export_type_default_credit_cost((string) ($product['export_type'] ?? '')) ?? 0));
}

function normalize_export_app_id(mixed $value = null): ?string
{
    $appId = strtolower(trim((string) ($value ?? DEFAULT_EXPORT_APP_ID)));
    if ($appId === '') {
        $appId = DEFAULT_EXPORT_APP_ID;
    }
    if (!preg_match('/^[a-z0-9_-]{1,64}$/', $appId)) {
        return null;
    }
    return array_key_exists($appId, EXPORT_APPS) ? $appId : null;
}

function export_app_catalog(PDO $pdo): array
{
    $products = [];
    foreach (EXPORT_PRODUCTS as $productCode => $product) {
        $products[] = [
            'product_code' => $productCode,
            'name' => $product['name'],
            'export_type' => $product['export_type'],
            'billable' => (bool) $product['billable'],
            'admin_only' => (bool) $product['admin_only'],
            'entitlement_policy' => $product['entitlement_policy'],
            'credit_cost' => export_product_catalog_credit_cost($product),
        ];
    }
    $apps = [];
    foreach (EXPORT_APPS as $appId => $app) {
        $apps[] = [
            'app_id' => $appId,
            'name' => $app['name'],
            'entry_path' => $app['entry_path'],
            'description' => $app['description'],
            'export_types' => EXPORT_TYPES,
            'products' => $products,
            'default_export_cost' => (int) credit_policy_settings($pdo)['export_cost'],
        ];
    }
    return $apps;
}

function export_credit_cost(PDO $pdo, string $type, string $appId = DEFAULT_EXPORT_APP_ID): ?int
{
    if (normalize_export_app_id($appId) === null) {
        return null;
    }
    $type = strtolower(trim($type));
    if (!in_array($type, EXPORT_TYPES, true)) {
        return null;
    }
    return export_type_default_credit_cost($type);
}

function export_product_credit_cost(PDO $pdo, string $productCode, string $appId = DEFAULT_EXPORT_APP_ID): ?int
{
    if (normalize_export_app_id($appId) === null) {
        return null;
    }
    $product = export_product($productCode);
    if ($product === null || (bool) ($product['admin_only'] ?? false)) {
        return null;
    }
    if (!(bool) ($product['billable'] ?? false)) {
        return 0;
    }
    return export_product_catalog_credit_cost($product);
}

function export_partial_bonus_amount(PDO $pdo, int $credits, int $cost): int
{
    $settings = credit_policy_settings($pdo);
    if (!$settings['partial_bonus_enabled']) {
        return 0;
    }
    if ($credits <= 0 || $credits >= $cost) {
        return 0;
    }
    return $cost - $credits;
}

function normalize_export_fingerprint(mixed $value): string
{
    $fingerprint = strtolower(trim((string) $value));
    return preg_match('/^[a-f0-9]{64}$/', $fingerprint) ? $fingerprint : '';
}

function export_entitlement_exists(PDO $pdo, int $userId, string $appId, string $productCode, string $fingerprint): bool
{
    $fingerprint = normalize_export_fingerprint($fingerprint);
    if ($userId <= 0 || $fingerprint === '') {
        return false;
    }

    $stmt = $pdo->prepare(
        'SELECT id FROM export_entitlements
         WHERE user_id = ? AND app_id = ? AND product_code = ? AND export_fingerprint = ?
         LIMIT 1'
    );
    $stmt->execute([$userId, $appId, strtolower(trim($productCode)), $fingerprint]);
    return (bool) $stmt->fetchColumn();
}

function export_effective_credit_cost(PDO $pdo, int $userId, string $appId, string $productCode, int $baseCost, string $fingerprint): int
{
    if ($baseCost <= 0) {
        return 0;
    }
    return export_entitlement_exists($pdo, $userId, $appId, $productCode, $fingerprint) ? 0 : $baseCost;
}

function export_record_entitlement(PDO $pdo, int $userId, string $appId, string $productCode, string $type, string $fingerprint, int $authorizationId, int $creditCost): void
{
    $fingerprint = normalize_export_fingerprint($fingerprint);
    if ($userId <= 0 || $fingerprint === '') {
        return;
    }

    $productCode = strtolower(trim($productCode));
    $type = strtolower(trim($type));
    $creditCost = max(0, $creditCost);
    if (db_driver_name($pdo) === 'mysql') {
        $stmt = $pdo->prepare(
            'INSERT INTO export_entitlements
                (user_id, app_id, product_code, export_type, export_fingerprint, first_authorization_id, first_credit_cost, download_count, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE download_count = download_count + 1, updated_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([$userId, $appId, $productCode, $type, $fingerprint, $authorizationId, $creditCost]);
        return;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO export_entitlements
            (user_id, app_id, product_code, export_type, export_fingerprint, first_authorization_id, first_credit_cost, download_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, app_id, product_code, export_fingerprint)
         DO UPDATE SET download_count = download_count + 1, updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$userId, $appId, $productCode, $type, $fingerprint, $authorizationId, $creditCost]);
}
