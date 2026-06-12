<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/db.php';

run_migrations();

$pdo = db();
$passwordHash = password_hash('password123', PASSWORD_DEFAULT);

$demoUsers = [
    [
        'email' => 'demo@nichoir.local',
        'name' => 'Demo Nichoir',
        'credits' => 42,
        'subscription_status' => 'active',
        'status' => 'active',
        'plan' => 'atelier',
        'subscription_id' => 'sub_demo_atelier',
        'price_id' => 'price_demo_atelier',
        'period' => '+28 days',
    ],
    [
        'email' => 'lea.client@nichoir.local',
        'name' => 'Lea Tremblay',
        'credits' => 18,
        'subscription_status' => 'active',
        'status' => 'active',
        'plan' => 'pro',
        'subscription_id' => 'sub_demo_lea_pro',
        'price_id' => 'price_demo_pro',
        'period' => '+42 days',
    ],
    [
        'email' => 'bob.client@nichoir.local',
        'name' => 'Bob Gagnon',
        'credits' => 6,
        'subscription_status' => 'none',
        'status' => 'active',
        'plan' => 'none',
        'subscription_id' => '',
        'price_id' => '',
        'period' => '',
    ],
    [
        'email' => 'noemie.suspendue@nichoir.local',
        'name' => 'Noemie Pelletier',
        'credits' => 0,
        'subscription_status' => 'canceled',
        'status' => 'suspended',
        'plan' => 'atelier',
        'subscription_id' => 'sub_demo_noemie_canceled',
        'price_id' => 'price_demo_atelier',
        'period' => '-8 days',
    ],
    [
        'email' => 'atelier@nichoir.local',
        'name' => 'Atelier Bois Nord',
        'credits' => 120,
        'subscription_status' => 'active',
        'status' => 'active',
        'plan' => 'pro',
        'subscription_id' => 'sub_demo_atelier_booster',
        'price_id' => 'price_demo_pro',
        'period' => '+55 days',
    ],
];

function demo_date(string $modifier = 'now'): string
{
    return (new DateTimeImmutable($modifier))->format('Y-m-d H:i:s');
}

function demo_insert_user(PDO $pdo, array $user, string $passwordHash): int
{
    $stmt = $pdo->prepare(
        'INSERT INTO users (email, password_hash, display_name, credits, subscription_status, status, email_verified_at, stripe_customer_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $customerId = 'cus_demo_' . preg_replace('/[^a-z0-9]+/', '_', strtolower((string) $user['email']));
    $createdAt = demo_date('-18 days');
    $stmt->execute([
        $user['email'],
        $passwordHash,
        $user['name'],
        $user['credits'],
        $user['subscription_status'],
        $user['status'],
        $user['status'] === 'pending' ? null : $createdAt,
        $customerId,
        $createdAt,
    ]);
    return (int) $pdo->lastInsertId();
}

function demo_insert_subscription(PDO $pdo, int $userId, array $user): void
{
    $period = $user['period'] !== '' ? (new DateTimeImmutable((string) $user['period']))->format('Y-m-d') : null;
    $pdo->prepare(
        'INSERT INTO subscriptions (user_id, provider, plan, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_end, cancel_at_period_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $userId,
        'stripe',
        $user['plan'],
        $user['subscription_status'],
        'cus_demo_' . preg_replace('/[^a-z0-9]+/', '_', strtolower((string) $user['email'])),
        $user['subscription_id'],
        $user['price_id'],
        $period,
        $user['subscription_status'] === 'canceled' ? 1 : 0,
        demo_date('-14 days'),
        demo_date('-2 days'),
    ]);
}

function demo_insert_payment(PDO $pdo, int $userId, string $email, int $amountCents, string $status, string $description, string $modifier): void
{
    $safe = preg_replace('/[^a-z0-9]+/', '_', strtolower($email));
    $invoice = 'in_demo_' . $safe . '_' . abs(crc32($description));
    $pdo->prepare(
        'INSERT INTO payments (user_id, provider, amount_cents, currency, status, description, stripe_customer_id, stripe_checkout_session_id, stripe_payment_intent_id, stripe_invoice_id, invoice_url, invoice_pdf, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $userId,
        'stripe',
        $amountCents,
        'cad',
        $status,
        $description,
        'cus_demo_' . $safe,
        'cs_demo_' . $safe . '_' . abs(crc32($description)),
        'pi_demo_' . $safe . '_' . abs(crc32($description)),
        $invoice,
        'https://pay.stripe.com/invoice/demo/' . $invoice,
        'https://pay.stripe.com/invoice/demo/' . $invoice . '/pdf',
        demo_date($modifier),
    ]);
}

function demo_insert_ledger(PDO $pdo, int $userId, int $delta, string $reason, string $reference, string $modifier): void
{
    $pdo->prepare('INSERT INTO credit_ledger (user_id, delta, reason, reference, created_at) VALUES (?, ?, ?, ?, ?)')
        ->execute([$userId, $delta, $reason, $reference, demo_date($modifier)]);
}

function demo_insert_export(PDO $pdo, int $userId, string $type, int $cost, string $status, string $modifier): void
{
    $consumedAt = $status === 'consumed' ? demo_date($modifier . ' +20 minutes') : null;
    $pdo->prepare(
        'INSERT INTO export_authorizations (user_id, export_type, credit_cost, auth_token_hash, status, expires_at, created_at, consumed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $userId,
        $type,
        $cost,
        hash('sha256', $userId . ':' . $type . ':' . $modifier . ':' . random_int(1, PHP_INT_MAX)),
        $status,
        demo_date('+2 hours'),
        demo_date($modifier),
        $consumedAt,
    ]);
}

function demo_insert_ticket(PDO $pdo, int $userId, array $ticket): int
{
    $closedAt = $ticket['status'] === 'closed' ? demo_date((string) ($ticket['closed_at'] ?? '-1 day')) : null;
    $pdo->prepare(
        'INSERT INTO tickets (user_id, subject, status, priority, assigned_to, created_at, updated_at, closed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $userId,
        $ticket['subject'],
        $ticket['status'],
        $ticket['priority'],
        $ticket['assigned_to'] ?? '',
        demo_date((string) $ticket['created_at']),
        demo_date((string) $ticket['updated_at']),
        $closedAt,
    ]);
    $ticketId = (int) $pdo->lastInsertId();
    foreach ($ticket['messages'] as $message) {
        $pdo->prepare(
            'INSERT INTO ticket_messages (ticket_id, user_id, author_role, body, created_at)
             VALUES (?, ?, ?, ?, ?)'
        )->execute([
            $ticketId,
            $userId,
            $message['role'],
            $message['body'],
            demo_date((string) $message['created_at']),
        ]);
    }
    return $ticketId;
}

function demo_insert_notification(PDO $pdo, int $ticketId, int $userId, string $recipient, string $subject, string $status, string $modifier): void
{
    $pdo->prepare(
        'INSERT INTO ticket_notifications (ticket_id, user_id, channel, recipient, subject, body, status, error, created_at, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $ticketId,
        $userId,
        'email',
        $recipient,
        $subject,
        'Notification demo pour tester la file email ticket.',
        $status,
        $status === 'failed' ? 'smtp_demo_failure' : '',
        demo_date($modifier),
        $status === 'sent' ? demo_date($modifier . ' +1 minute') : null,
    ]);
}

$pdo->beginTransaction();
try {
    $emails = array_column($demoUsers, 'email');
    $placeholders = implode(',', array_fill(0, count($emails), '?'));
    $pdo->exec("DELETE FROM admin_audit_log WHERE action = 'seed_demo_dataset' OR note = 'Dataset demo admin/app'");
    $delete = $pdo->prepare('DELETE FROM users WHERE email IN (' . $placeholders . ')');
    $delete->execute($emails);

    $ids = [];
    foreach ($demoUsers as $user) {
        $id = demo_insert_user($pdo, $user, $passwordHash);
        $ids[$user['email']] = $id;
        demo_insert_subscription($pdo, $id, $user);
        demo_insert_ledger($pdo, $id, 10, 'initial_grant', 'demo_seed', '-18 days');
    }

    demo_insert_payment($pdo, $ids['demo@nichoir.local'], 'demo@nichoir.local', 2900, 'paid', 'Achat credits demo', '-10 days');
    demo_insert_payment($pdo, $ids['demo@nichoir.local'], 'demo@nichoir.local', 1900, 'paid', 'Abonnement Atelier demo', '-4 days');
    demo_insert_payment($pdo, $ids['lea.client@nichoir.local'], 'lea.client@nichoir.local', 4900, 'paid', 'Abonnement Pro demo', '-7 days');
    demo_insert_payment($pdo, $ids['bob.client@nichoir.local'], 'bob.client@nichoir.local', 2900, 'pending', 'Checkout credits abandonne', '-2 days');
    demo_insert_payment($pdo, $ids['noemie.suspendue@nichoir.local'], 'noemie.suspendue@nichoir.local', 1900, 'failed', 'Paiement Atelier refuse', '-9 days');
    demo_insert_payment($pdo, $ids['atelier@nichoir.local'], 'atelier@nichoir.local', 9900, 'paid', 'Pack atelier pro', '-1 day');

    demo_insert_ledger($pdo, $ids['demo@nichoir.local'], 50, 'stripe_checkout', 'cs_demo_credit_pack', '-10 days');
    demo_insert_ledger($pdo, $ids['demo@nichoir.local'], -3, 'export_stl', 'auth_demo_stl', '-8 days');
    demo_insert_ledger($pdo, $ids['demo@nichoir.local'], -5, 'export_zip', 'auth_demo_zip', '-3 days');
    demo_insert_ledger($pdo, $ids['lea.client@nichoir.local'], -2, 'export_pdf', 'auth_lea_pdf', '-5 days');
    demo_insert_ledger($pdo, $ids['atelier@nichoir.local'], 100, 'admin_adjustment', 'demo_bulk_credit', '-2 days');

    demo_insert_export($pdo, $ids['demo@nichoir.local'], 'stl', 3, 'consumed', '-8 days');
    demo_insert_export($pdo, $ids['demo@nichoir.local'], 'zip', 5, 'consumed', '-3 days');
    demo_insert_export($pdo, $ids['lea.client@nichoir.local'], 'pdf', 2, 'consumed', '-5 days');
    demo_insert_export($pdo, $ids['bob.client@nichoir.local'], 'png', 1, 'authorized', '-40 minutes');
    demo_insert_export($pdo, $ids['atelier@nichoir.local'], 'svg', 1, 'authorized', '-15 minutes');

    $tickets = [
        'demo@nichoir.local' => [
            [
                'subject' => 'Export STL incomplet sur le toit',
                'status' => 'open',
                'priority' => 'high',
                'assigned_to' => 'Marc',
                'created_at' => '-3 days',
                'updated_at' => '-2 hours',
                'messages' => [
                    ['role' => 'client', 'body' => "Le STL du toit semble coupe sur un cote.\nPreset: largeur 180, toit pente 18.", 'created_at' => '-3 days'],
                    ['role' => 'admin', 'body' => 'Merci, je regarde le preset et je te reviens avec un export corrige.', 'created_at' => '-2 days'],
                    ['role' => 'client', 'body' => 'Je peux reproduire avec le ZIP aussi.', 'created_at' => '-2 hours'],
                ],
            ],
            [
                'subject' => 'Facture du pack credits',
                'status' => 'closed',
                'priority' => 'normal',
                'assigned_to' => 'Support',
                'created_at' => '-9 days',
                'updated_at' => '-8 days',
                'closed_at' => '-8 days',
                'messages' => [
                    ['role' => 'client', 'body' => 'Je ne vois pas ma facture apres paiement.', 'created_at' => '-9 days'],
                    ['role' => 'admin', 'body' => 'La facture demo est maintenant visible dans Billing.', 'created_at' => '-8 days'],
                ],
            ],
        ],
        'lea.client@nichoir.local' => [
            [
                'subject' => 'Impossible de telecharger le ZIP panneaux',
                'status' => 'open',
                'priority' => 'urgent',
                'assigned_to' => 'Marc',
                'created_at' => '-1 day',
                'updated_at' => '-35 minutes',
                'messages' => [
                    ['role' => 'client', 'body' => 'Le debit credits passe, mais le ZIP ne se telecharge pas.', 'created_at' => '-1 day'],
                    ['role' => 'admin', 'body' => 'Je vois une autorisation consommee. Peux-tu reessayer depuis Chrome?', 'created_at' => '-12 hours'],
                    ['role' => 'client', 'body' => 'Meme resultat sur Firefox.', 'created_at' => '-35 minutes'],
                ],
            ],
        ],
        'bob.client@nichoir.local' => [
            [
                'subject' => 'Credits non ajoutes apres checkout',
                'status' => 'open',
                'priority' => 'normal',
                'assigned_to' => '',
                'created_at' => '-18 hours',
                'updated_at' => '-18 hours',
                'messages' => [
                    ['role' => 'client', 'body' => 'J ai lance un checkout mais mes credits sont encore bas.', 'created_at' => '-18 hours'],
                ],
            ],
        ],
        'noemie.suspendue@nichoir.local' => [
            [
                'subject' => 'Pourquoi mon compte est suspendu',
                'status' => 'closed',
                'priority' => 'low',
                'assigned_to' => 'Support',
                'created_at' => '-6 days',
                'updated_at' => '-5 days',
                'closed_at' => '-5 days',
                'messages' => [
                    ['role' => 'client', 'body' => 'Je ne peux plus exporter.', 'created_at' => '-6 days'],
                    ['role' => 'admin', 'body' => 'Le paiement a echoue. Le compte sera reactive apres paiement.', 'created_at' => '-5 days'],
                ],
            ],
        ],
        'atelier@nichoir.local' => [
            [
                'subject' => 'Demande limite export pro',
                'status' => 'open',
                'priority' => 'high',
                'assigned_to' => 'Commercial',
                'created_at' => '-7 hours',
                'updated_at' => '-1 hour',
                'messages' => [
                    ['role' => 'client', 'body' => 'On veut exporter plusieurs variantes pour un atelier.', 'created_at' => '-7 hours'],
                    ['role' => 'admin', 'body' => 'Je prepare une proposition avec limites plus hautes.', 'created_at' => '-1 hour'],
                ],
            ],
        ],
    ];

    $firstTicketId = null;
    foreach ($tickets as $email => $items) {
        foreach ($items as $ticket) {
            $ticketId = demo_insert_ticket($pdo, $ids[$email], $ticket);
            $firstTicketId ??= $ticketId;
            demo_insert_notification(
                $pdo,
                $ticketId,
                $ids[$email],
                $email,
                'Ticket #' . $ticketId . ' - ' . $ticket['subject'],
                $ticket['status'] === 'open' ? 'sent' : 'skipped',
                (string) $ticket['updated_at']
            );
        }
    }
    if ($firstTicketId !== null) {
        demo_insert_notification($pdo, $firstTicketId, $ids['demo@nichoir.local'], 'support@nichoir.local', 'Notification SMTP demo echouee', 'failed', '-30 minutes');
    }

    $pdo->prepare('INSERT INTO admin_audit_log (user_id, action, delta, note, created_at) VALUES (?, ?, ?, ?, ?)')
        ->execute([$ids['atelier@nichoir.local'], 'seed_demo_dataset', 100, 'Dataset demo admin/app', demo_date('now')]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    fwrite(STDERR, 'Seed failed: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

echo "Demo dataset ready.\n";
echo "Password for all demo users: password123\n";
foreach ($demoUsers as $user) {
    echo '- ' . $user['email'] . ' (' . $user['name'] . ")\n";
}
