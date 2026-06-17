<?php

declare(strict_types=1);

const DEFAULT_EXPORT_APP_ID = 'nichoir';
const EXPORT_TYPES = ['svg', 'png', 'pdf', 'stl', 'zip'];
const EXPORT_APPS = [
    'nichoir' => [
        'name' => 'Nichoir',
        'entry_path' => '/app/',
        'description' => 'Calculateur maison d oiseau Rust/WASM.',
    ],
];

function credit_policy_settings(PDO $pdo): array
{
    return [
        'export_cost' => max(1, (int) setting_get($pdo, 'export_credit_cost', '3')),
        'partial_bonus_enabled' => setting_get($pdo, 'partial_credit_bonus_enabled', '1') === '1',
    ];
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
    $cost = (int) credit_policy_settings($pdo)['export_cost'];
    $apps = [];
    foreach (EXPORT_APPS as $appId => $app) {
        $apps[] = [
            'app_id' => $appId,
            'name' => $app['name'],
            'entry_path' => $app['entry_path'],
            'description' => $app['description'],
            'export_types' => EXPORT_TYPES,
            'default_export_cost' => $cost,
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
    return (int) credit_policy_settings($pdo)['export_cost'];
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
