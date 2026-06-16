<?php

declare(strict_types=1);

require_once __DIR__ . '/admin_core.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

function admin_export_scope_value(string $value): string
{
    $allowed = ['all', 'clients', 'billing', 'support', 'credits', 'exports'];
    return in_array($value, $allowed, true) ? $value : 'exports';
}

function admin_export_format_value(string $value): string
{
    $format = strtolower(trim($value));
    if ($format === 'excel') {
        return 'xls';
    }
    return in_array($format, ['csv', 'json', 'xls'], true) ? $format : 'csv';
}

function admin_exports_download_url(string $format, string $scope = 'exports'): string
{
    $params = [
        'format' => admin_export_format_value($format),
        'scope' => admin_export_scope_value($scope),
    ];
    $key = trim((string) ($_GET['key'] ?? ($_POST['key'] ?? '')));
    if ($key !== '') {
        $params['key'] = $key;
    }
    return '/admin/exports/download?' . http_build_query($params);
}

function admin_export_dataset(string $label, array $columns, array $rows): array
{
    return [
        'label' => $label,
        'columns' => $columns,
        'rows' => $rows,
    ];
}

function admin_export_data(PDO $pdo): array
{
    $clients = $pdo->query(
        'SELECT created_at AS date, id AS user_id, email, display_name, credits, subscription_status, status, stripe_customer_id, created_at
         FROM users
         ORDER BY created_at DESC, id DESC'
    )->fetchAll();

    $billing = $pdo->query(
        "SELECT 'subscription' AS billing_type, subscriptions.id AS record_id, COALESCE(subscriptions.updated_at, subscriptions.created_at) AS date,
                users.id AS user_id, users.email, subscriptions.provider, subscriptions.plan, subscriptions.status,
                subscriptions.stripe_customer_id, subscriptions.stripe_subscription_id, subscriptions.stripe_price_id,
                NULL AS amount_cents, NULL AS currency, '' AS description, '' AS stripe_checkout_session_id,
                '' AS stripe_payment_intent_id, '' AS stripe_invoice_id, '' AS invoice_url, '' AS invoice_pdf,
                subscriptions.current_period_end, subscriptions.cancel_at_period_end, subscriptions.created_at, subscriptions.updated_at
         FROM subscriptions
         JOIN users ON users.id = subscriptions.user_id
         UNION ALL
         SELECT 'payment' AS billing_type, payments.id AS record_id, payments.created_at AS date,
                users.id AS user_id, users.email, payments.provider, '' AS plan, payments.status,
                payments.stripe_customer_id, '' AS stripe_subscription_id, '' AS stripe_price_id,
                payments.amount_cents, payments.currency, payments.description, payments.stripe_checkout_session_id,
                payments.stripe_payment_intent_id, payments.stripe_invoice_id, payments.invoice_url, payments.invoice_pdf,
                '' AS current_period_end, 0 AS cancel_at_period_end, payments.created_at, '' AS updated_at
         FROM payments
         JOIN users ON users.id = payments.user_id
         ORDER BY date DESC, record_id DESC"
    )->fetchAll();

    $credits = $pdo->query(
        'SELECT credit_ledger.created_at AS date, credit_ledger.id AS record_id, users.id AS user_id, users.email,
                credit_ledger.delta, credit_ledger.reason, credit_ledger.reference, credit_ledger.created_at
         FROM credit_ledger
         JOIN users ON users.id = credit_ledger.user_id
         ORDER BY credit_ledger.created_at DESC, credit_ledger.id DESC'
    )->fetchAll();

    $exports = $pdo->query(
        'SELECT export_authorizations.created_at AS date, export_authorizations.id AS record_id, users.id AS user_id, users.email,
                export_authorizations.export_type, export_authorizations.credit_cost, export_authorizations.status,
                export_authorizations.expires_at, export_authorizations.created_at, export_authorizations.consumed_at
         FROM export_authorizations
         JOIN users ON users.id = export_authorizations.user_id
         ORDER BY export_authorizations.created_at DESC, export_authorizations.id DESC'
    )->fetchAll();

    $support = $pdo->query(
        "SELECT 'ticket' AS support_type, tickets.id AS record_id, tickets.updated_at AS date, tickets.id AS ticket_id,
                users.id AS user_id, users.email, tickets.subject, tickets.status, tickets.priority, tickets.assigned_to,
                '' AS author_role, '' AS body, '' AS recipient, '' AS notification_status, '' AS error,
                tickets.created_at, tickets.updated_at, tickets.closed_at
         FROM tickets
         JOIN users ON users.id = tickets.user_id
         UNION ALL
         SELECT 'message' AS support_type, ticket_messages.id AS record_id, ticket_messages.created_at AS date, tickets.id AS ticket_id,
                users.id AS user_id, users.email, tickets.subject, tickets.status, tickets.priority, tickets.assigned_to,
                ticket_messages.author_role, ticket_messages.body, '' AS recipient, '' AS notification_status, '' AS error,
                ticket_messages.created_at, '' AS updated_at, '' AS closed_at
         FROM ticket_messages
         JOIN tickets ON tickets.id = ticket_messages.ticket_id
         JOIN users ON users.id = ticket_messages.user_id
         UNION ALL
         SELECT 'notification' AS support_type, ticket_notifications.id AS record_id, ticket_notifications.created_at AS date, tickets.id AS ticket_id,
                users.id AS user_id, users.email, tickets.subject, tickets.status, tickets.priority, tickets.assigned_to,
                '' AS author_role, ticket_notifications.body, ticket_notifications.recipient, ticket_notifications.status AS notification_status,
                ticket_notifications.error, ticket_notifications.created_at, ticket_notifications.sent_at AS updated_at, '' AS closed_at
         FROM ticket_notifications
         JOIN tickets ON tickets.id = ticket_notifications.ticket_id
         JOIN users ON users.id = ticket_notifications.user_id
         ORDER BY date DESC, record_id DESC"
    )->fetchAll();

    $system = $pdo->query(
        "SELECT 'stripe_event' AS system_type, stripe_events.id AS record_id, stripe_events.created_at AS date,
                NULL AS user_id, '' AS email, stripe_events.event_id AS reference, stripe_events.type AS action,
                stripe_events.status, stripe_events.error, stripe_events.created_at, stripe_events.processed_at
         FROM stripe_events
         UNION ALL
         SELECT 'admin_audit' AS system_type, admin_audit_log.id AS record_id, admin_audit_log.created_at AS date,
                users.id AS user_id, COALESCE(users.email, '') AS email, '' AS reference, admin_audit_log.action,
                '' AS status, admin_audit_log.note AS error, admin_audit_log.created_at, '' AS processed_at
         FROM admin_audit_log
         LEFT JOIN users ON users.id = admin_audit_log.user_id
         ORDER BY date DESC, record_id DESC"
    )->fetchAll();

    return [
        'clients' => admin_export_dataset('Clients', ['date', 'user_id', 'email', 'display_name', 'credits', 'subscription_status', 'status', 'stripe_customer_id', 'created_at'], $clients),
        'billing' => admin_export_dataset('Billing', ['billing_type', 'record_id', 'date', 'user_id', 'email', 'provider', 'plan', 'status', 'amount_cents', 'currency', 'description', 'stripe_customer_id', 'stripe_subscription_id', 'stripe_price_id', 'stripe_checkout_session_id', 'stripe_payment_intent_id', 'stripe_invoice_id', 'invoice_url', 'invoice_pdf', 'current_period_end', 'cancel_at_period_end', 'created_at', 'updated_at'], $billing),
        'credits' => admin_export_dataset('Credits', ['date', 'record_id', 'user_id', 'email', 'delta', 'reason', 'reference', 'created_at'], $credits),
        'exports' => admin_export_dataset('Autorisations exports', ['date', 'record_id', 'user_id', 'email', 'export_type', 'credit_cost', 'status', 'expires_at', 'created_at', 'consumed_at'], $exports),
        'support' => admin_export_dataset('Support', ['support_type', 'record_id', 'date', 'ticket_id', 'user_id', 'email', 'subject', 'status', 'priority', 'assigned_to', 'author_role', 'body', 'recipient', 'notification_status', 'error', 'created_at', 'updated_at', 'closed_at'], $support),
        'system' => admin_export_dataset('Systeme', ['system_type', 'record_id', 'date', 'user_id', 'email', 'reference', 'action', 'status', 'error', 'created_at', 'processed_at'], $system),
    ];
}

function admin_export_value(array $row, string $key): string
{
    $value = $row[$key] ?? '';
    return $value === null ? '' : (string) $value;
}

function admin_export_timeline_rows(array $datasets): array
{
    $timeline = [];
    foreach ($datasets as $scope => $dataset) {
        foreach ($dataset['rows'] as $row) {
            $type = admin_export_value($row, 'billing_type')
                ?: admin_export_value($row, 'support_type')
                ?: admin_export_value($row, 'system_type')
                ?: admin_export_value($row, 'export_type')
                ?: admin_export_value($row, 'reason')
                ?: $scope;
            $timeline[] = [
                'section' => (string) $dataset['label'],
                'date' => admin_export_value($row, 'date') ?: admin_export_value($row, 'created_at'),
                'record_id' => admin_export_value($row, 'record_id') ?: admin_export_value($row, 'user_id'),
                'user_id' => admin_export_value($row, 'user_id'),
                'email' => admin_export_value($row, 'email'),
                'type' => $type,
                'status' => admin_export_value($row, 'status') ?: admin_export_value($row, 'notification_status'),
                'amount_cents' => admin_export_value($row, 'amount_cents'),
                'currency' => admin_export_value($row, 'currency'),
                'credit_delta' => admin_export_value($row, 'delta'),
                'description' => admin_export_value($row, 'description') ?: admin_export_value($row, 'subject') ?: admin_export_value($row, 'action') ?: admin_export_value($row, 'reference'),
                'metadata_json' => json_encode($row, JSON_UNESCAPED_SLASHES),
            ];
        }
    }
    usort($timeline, static fn (array $a, array $b): int => strcmp((string) $b['date'], (string) $a['date']));
    return $timeline;
}

function admin_export_selected_data(PDO $pdo, string $scope): array
{
    $datasets = admin_export_data($pdo);
    if ($scope === 'all') {
        return [
            'label' => 'Base complete',
            'filename' => 'base-complete',
            'datasets' => $datasets,
        ];
    }
    return [
        'label' => (string) $datasets[$scope]['label'],
        'filename' => $scope,
        'datasets' => [$scope => $datasets[$scope]],
    ];
}

function admin_export_send_csv(array $export, string $scope, string $filename): void
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    $out = fopen('php://output', 'w');
    if ($out === false) {
        http_response_code(500);
        echo 'Unable to open output stream';
        return;
    }

    if ($scope === 'all') {
        $columns = ['section', 'date', 'record_id', 'user_id', 'email', 'type', 'status', 'amount_cents', 'currency', 'credit_delta', 'description', 'metadata_json'];
        fputcsv($out, $columns);
        foreach (admin_export_timeline_rows($export['datasets']) as $row) {
            fputcsv($out, array_map(static fn (string $column): string => admin_export_value($row, $column), $columns));
        }
        fclose($out);
        return;
    }

    $dataset = reset($export['datasets']);
    $columns = $dataset['columns'];
    fputcsv($out, $columns);
    foreach ($dataset['rows'] as $row) {
        fputcsv($out, array_map(static fn (string $column): string => admin_export_value($row, $column), $columns));
    }
    fclose($out);
}

function admin_export_send_json(array $export, string $filename): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    $payload = [
        'label' => $export['label'],
        'generated_at' => (new DateTimeImmutable())->format(DateTimeInterface::ATOM),
        'datasets' => [],
    ];
    foreach ($export['datasets'] as $key => $dataset) {
        $payload['datasets'][$key] = [
            'label' => $dataset['label'],
            'rows' => $dataset['rows'],
        ];
    }
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
}

function admin_export_send_excel(array $export, string $filename): void
{
    header('Content-Type: application/vnd.ms-excel; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    echo '<!doctype html><html><head><meta charset="utf-8"></head><body>';
    echo '<h1>' . h((string) $export['label']) . '</h1>';
    echo '<p>Genere le ' . h((new DateTimeImmutable())->format('Y-m-d H:i:s')) . '</p>';
    foreach ($export['datasets'] as $dataset) {
        echo '<h2>' . h((string) $dataset['label']) . '</h2>';
        echo '<table border="1"><thead><tr>';
        foreach ($dataset['columns'] as $column) {
            echo '<th>' . h((string) $column) . '</th>';
        }
        echo '</tr></thead><tbody>';
        foreach ($dataset['rows'] as $row) {
            echo '<tr>';
            foreach ($dataset['columns'] as $column) {
                echo '<td>' . h(admin_export_value($row, (string) $column)) . '</td>';
            }
            echo '</tr>';
        }
        echo '</tbody></table>';
    }
    echo '</body></html>';
}

function handle_admin_exports_download(): void
{
    if (!admin_allowed()) {
        http_response_code(403);
        echo 'Forbidden';
        return;
    }

    $format = admin_export_format_value((string) ($_GET['format'] ?? 'csv'));
    $scope = admin_export_scope_value((string) ($_GET['scope'] ?? 'exports'));
    if (!in_array($format, ['csv', 'json', 'xls'], true)) {
        http_response_code(400);
        echo 'Invalid export format';
        return;
    }

    $export = admin_export_selected_data(db(), $scope);
    $filename = 'nichoir-' . $export['filename'] . '-' . (new DateTimeImmutable())->format('Ymd-His') . '.' . $format;

    if ($format === 'json') {
        admin_export_send_json($export, $filename);
        return;
    }
    if ($format === 'xls') {
        admin_export_send_excel($export, $filename);
        return;
    }
    admin_export_send_csv($export, $scope, $filename);
}
