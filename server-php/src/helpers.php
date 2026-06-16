<?php

declare(strict_types=1);

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function money_cents(int $amountCents, string $currency): string
{
    $amount = number_format($amountCents / 100, 2, ',', ' ');
    return $amount . ' ' . strtoupper($currency);
}
