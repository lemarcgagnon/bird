<?php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/credits.php';
require_once __DIR__ . '/i18n.php';
require_once __DIR__ . '/layout.php';
require_once __DIR__ . '/contact.php';
require_once __DIR__ . '/public_pages.php';
require_once __DIR__ . '/account_pages.php';
require_once __DIR__ . '/admin_core.php';
require_once __DIR__ . '/admin_exports.php';
require_once __DIR__ . '/admin_helpers.php';
require_once __DIR__ . '/admin_actions.php';
require_once __DIR__ . '/admin_pages.php';

const ADMIN_USER_STATUSES = [
    'pending' => 'En attente',
    'active' => 'Actif',
    'suspended' => 'Suspendu',
    'closed' => 'Ferme',
];
const ADMIN_PLANS = ['none', 'credits', 'atelier', 'pro'];
const ADMIN_SUBSCRIPTION_STATUSES = ['none', 'active', 'past_due', 'canceled'];
const TICKET_STATUSES = ['open' => 'Ouvert', 'closed' => 'Ferme'];
const TICKET_PRIORITIES = ['low' => 'Basse', 'normal' => 'Normale', 'high' => 'Haute', 'urgent' => 'Urgente'];
