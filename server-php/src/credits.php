<?php

declare(strict_types=1);

const EXPORT_TYPES = ['svg', 'png', 'pdf', 'stl', 'zip'];

function credit_policy_settings(PDO $pdo): array
{
    return [
        'export_cost' => max(1, (int) setting_get($pdo, 'export_credit_cost', '3')),
        'partial_bonus_enabled' => setting_get($pdo, 'partial_credit_bonus_enabled', '1') === '1',
    ];
}

function export_credit_cost(PDO $pdo, string $type): ?int
{
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
