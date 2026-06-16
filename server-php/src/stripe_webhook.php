<?php

declare(strict_types=1);

function stripe_object_metadata(array $object): array
{
    $metadata = $object['metadata'] ?? [];
    return is_array($metadata) ? $metadata : [];
}

function stripe_text(array $source, string $key, string $default = ''): string
{
    $value = $source[$key] ?? $default;
    return is_scalar($value) ? trim((string) $value) : $default;
}

function stripe_int(array $source, string $key, int $default = 0): int
{
    $value = $source[$key] ?? $default;
    return is_numeric($value) ? (int) $value : $default;
}

function stripe_period_text(mixed $value): ?string
{
    if (is_numeric($value) && (int) $value > 0) {
        return (new DateTimeImmutable('@' . (int) $value))->format('Y-m-d');
    }
    if (is_string($value) && trim($value) !== '') {
        return trim($value);
    }
    return null;
}

function stripe_webhook_allowed(): bool
{
    if (stripe_settings(db())['webhook_secret'] !== '') {
        return true;
    }
    if (function_exists('is_local_request') && is_local_request()) {
        return true;
    }
    return app_config_value('NICHOIR_ALLOW_UNSIGNED_STRIPE_WEBHOOKS') === '1';
}

function stripe_webhook_object_id(array $object): string
{
    return stripe_text($object, 'id');
}

function stripe_webhook_livemode(array $event): bool
{
    return !empty($event['livemode']);
}

function stripe_webhook_payload_hash(string $raw): string
{
    return hash('sha256', $raw);
}

function stripe_app_log(PDO $pdo, string $level, string $eventCode, string $message, array $context = [], ?int $httpStatus = null): void
{
    if (function_exists('app_log')) {
        app_log($pdo, $level, 'stripe', $eventCode, $message, $context, null, $httpStatus);
    }
}

function stripe_store_event_log(PDO $pdo, string $eventId, string $type, array $object, bool $livemode, string $status, string $payloadHash, string $error = ''): void
{
    if (function_exists('stripe_event_log')) {
        stripe_event_log($pdo, $eventId, $type, stripe_webhook_object_id($object), $livemode, $status, $error, $payloadHash);
    }
}

function stripe_select_event(PDO $pdo, string $eventId, bool $forUpdate = false): ?array
{
    $sql = 'SELECT id, event_id, type, status, payload, error, created_at, processed_at FROM stripe_events WHERE event_id = ?';
    if ($forUpdate && db_driver_name($pdo) === 'mysql') {
        $sql .= ' FOR UPDATE';
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$eventId]);
    $row = $stmt->fetch();
    return is_array($row) ? $row : null;
}

function stripe_claim_event_for_processing(PDO $pdo, string $eventId, string $type, string $payload): array
{
    try {
        $pdo->prepare('INSERT INTO stripe_events (event_id, type, status, payload) VALUES (?, ?, ?, ?)')
            ->execute([$eventId, $type, 'received', $payload]);
    } catch (PDOException $e) {
        if (stripe_select_event($pdo, $eventId, false) === null) {
            throw $e;
        }
    }

    $event = stripe_select_event($pdo, $eventId, true);
    if ($event === null) {
        throw new RuntimeException('stripe_event_claim_failed');
    }

    $status = (string) $event['status'];
    if (in_array($status, ['processed', 'ignored'], true)) {
        return ['action' => 'skip', 'status' => $status];
    }

    $pdo->prepare('UPDATE stripe_events SET type = ?, payload = ?, status = ?, error = ? WHERE event_id = ?')
        ->execute([$type, $payload, 'processing', '', $eventId]);

    return ['action' => 'process', 'previous_status' => $status];
}

function stripe_mark_event_failed(PDO $pdo, string $eventId, string $type, string $payload, string $error): void
{
    $error = substr($error, 0, 500);
    try {
        $pdo->prepare('INSERT INTO stripe_events (event_id, type, status, payload, error) VALUES (?, ?, ?, ?, ?)')
            ->execute([$eventId, $type, 'failed', $payload, $error]);
    } catch (PDOException) {
        $pdo->prepare("UPDATE stripe_events SET type = ?, payload = ?, status = ?, error = ? WHERE event_id = ? AND status NOT IN ('processed', 'ignored')")
            ->execute([$type, $payload, 'failed', $error, $eventId]);
    }
}

function stripe_processed_event_code(string $type, array $result): string
{
    if ((string) ($result['status'] ?? '') === 'ignored') {
        return 'stripe_webhook_ignored';
    }
    return match ($type) {
        'checkout.session.completed' => 'payment_succeeded',
        'customer.subscription.created' => 'subscription_created',
        'customer.subscription.updated' => 'subscription_updated',
        'customer.subscription.deleted' => 'subscription_cancelled',
        'invoice.paid', 'invoice.payment_succeeded' => 'invoice_paid',
        'invoice.payment_failed' => 'invoice_payment_failed',
        default => 'stripe_webhook_processed',
    };
}

function stripe_find_user(PDO $pdo, array $object): ?array
{
    $metadata = stripe_object_metadata($object);
    $userId = stripe_int($metadata, 'user_id');
    if ($userId <= 0) {
        $userId = stripe_int($object, 'client_reference_id');
    }
    if ($userId > 0) {
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if (is_array($user)) {
            return $user;
        }
    }

    $subscriptionId = stripe_text($object, 'subscription', stripe_text($object, 'id'));
    $customerId = stripe_text($object, 'customer');
    if ($subscriptionId !== '' || $customerId !== '') {
        if ($customerId !== '') {
            $stmt = $pdo->prepare('SELECT * FROM users WHERE stripe_customer_id = ? LIMIT 1');
            $stmt->execute([$customerId]);
            $user = $stmt->fetch();
            if (is_array($user)) {
                return $user;
            }
        }
        $stmt = $pdo->prepare(
            'SELECT users.* FROM users JOIN subscriptions ON subscriptions.user_id = users.id WHERE subscriptions.stripe_subscription_id = ? OR subscriptions.stripe_customer_id = ? ORDER BY subscriptions.id DESC LIMIT 1'
        );
        $stmt->execute([$subscriptionId, $customerId]);
        $user = $stmt->fetch();
        if (is_array($user)) {
            return $user;
        }
    }

    $email = strtolower(stripe_text($metadata, 'email'));
    if ($email === '') {
        $email = strtolower(stripe_text($object, 'customer_email'));
    }
    if ($email !== '') {
        $stmt = $pdo->prepare('SELECT * FROM users WHERE lower(email) = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        return is_array($user) ? $user : null;
    }

    return null;
}

function stripe_plan_from_object(array $object): string
{
    $metadata = stripe_object_metadata($object);
    $plan = stripe_text($metadata, 'plan', stripe_text($metadata, 'offer', 'none'));
    if ($plan !== '' && $plan !== 'none') {
        return $plan;
    }

    $items = $object['items']['data'] ?? [];
    if (is_array($items) && isset($items[0]) && is_array($items[0])) {
        $price = $items[0]['price'] ?? [];
        if (is_array($price)) {
            return stripe_text($price, 'lookup_key', stripe_text($price, 'nickname', stripe_text($price, 'id', 'none')));
        }
    }

    return 'none';
}

function stripe_upsert_subscription(PDO $pdo, int $userId, array $object): void
{
    $plan = stripe_plan_from_object($object);
    $status = stripe_text($object, 'status', 'active');
    $subscriptionId = stripe_text($object, 'subscription', stripe_text($object, 'id'));
    $customerId = stripe_text($object, 'customer');
    $priceId = '';
    $items = $object['items']['data'] ?? [];
    if (is_array($items) && isset($items[0]) && is_array($items[0])) {
        $price = $items[0]['price'] ?? [];
        if (is_array($price)) {
            $priceId = stripe_text($price, 'id');
        }
    }
    $periodEnd = stripe_period_text($object['current_period_end'] ?? ($object['current_period_end_text'] ?? null));
    $cancelAtPeriodEnd = !empty($object['cancel_at_period_end']) ? 1 : 0;

    $existing = null;
    $existingPlan = null;
    if ($subscriptionId !== '') {
        $stmt = $pdo->prepare('SELECT id, plan FROM subscriptions WHERE stripe_subscription_id = ? LIMIT 1');
        $stmt->execute([$subscriptionId]);
        $row = $stmt->fetch();
        if (is_array($row)) {
            $existing = (int) $row['id'];
            $existingPlan = (string) $row['plan'];
        }
    }
    if (!$existing) {
        $stmt = $pdo->prepare('SELECT id, plan FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if (is_array($row)) {
            $existing = (int) $row['id'];
            $existingPlan = (string) $row['plan'];
        }
    }
    if ($plan === 'none' && $existingPlan !== null && $existingPlan !== 'none') {
        $plan = $existingPlan;
    }

    if ($existing) {
        $pdo->prepare(
            'UPDATE subscriptions SET plan = ?, status = ?, stripe_customer_id = ?, stripe_subscription_id = ?, stripe_price_id = ?, current_period_end = ?, cancel_at_period_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        )->execute([$plan, $status, $customerId, $subscriptionId, $priceId, $periodEnd, $cancelAtPeriodEnd, (int) $existing]);
    } else {
        $pdo->prepare(
            'INSERT INTO subscriptions (user_id, plan, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_end, cancel_at_period_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$userId, $plan, $status, $customerId, $subscriptionId, $priceId, $periodEnd, $cancelAtPeriodEnd]);
    }
    $pdo->prepare('UPDATE users SET subscription_status = ? WHERE id = ?')->execute([$status, $userId]);
    if ($customerId !== '') {
        $pdo->prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ? AND stripe_customer_id = ?')->execute([$customerId, $userId, '']);
    }
}

function stripe_record_payment(PDO $pdo, int $userId, array $object): void
{
    $sessionId = stripe_text($object, 'id');
    if ($sessionId !== '') {
        $stmt = $pdo->prepare('SELECT id FROM payments WHERE stripe_checkout_session_id = ? LIMIT 1');
        $stmt->execute([$sessionId]);
        if ($stmt->fetchColumn()) {
            return;
        }
    }

    $amount = stripe_int($object, 'amount_total', stripe_int($object, 'amount_paid'));
    $currency = strtolower(stripe_text($object, 'currency', 'cad'));
    $status = stripe_text($object, 'payment_status', stripe_text($object, 'status', 'pending'));
    $description = stripe_text($object, 'description', 'Stripe checkout');
    $paymentIntent = stripe_text($object, 'payment_intent');
    $customerId = stripe_text($object, 'customer');
    $invoiceId = stripe_text($object, 'invoice');
    $invoiceUrl = stripe_text($object, 'hosted_invoice_url');
    $invoicePdf = stripe_text($object, 'invoice_pdf');
    if ($invoiceId !== '' && ($invoiceUrl === '' || $invoicePdf === '')) {
        try {
            $invoice = stripe_api_request($pdo, 'GET', '/v1/invoices/' . rawurlencode($invoiceId));
            $invoiceUrl = stripe_text($invoice, 'hosted_invoice_url', $invoiceUrl);
            $invoicePdf = stripe_text($invoice, 'invoice_pdf', $invoicePdf);
        } catch (Throwable) {
            // The webhook remains idempotent even if invoice fetch fails.
        }
    }
    if ($invoiceId !== '') {
        $stmt = $pdo->prepare('SELECT id FROM payments WHERE stripe_invoice_id = ? LIMIT 1');
        $stmt->execute([$invoiceId]);
        $paymentId = $stmt->fetchColumn();
        if ($paymentId) {
            $pdo->prepare(
                "UPDATE payments
                 SET status = ?, stripe_customer_id = ?, stripe_checkout_session_id = CASE WHEN stripe_checkout_session_id = '' THEN ? ELSE stripe_checkout_session_id END, stripe_payment_intent_id = ?, invoice_url = ?, invoice_pdf = ?
                 WHERE id = ?"
            )->execute([$status, $customerId, $sessionId, $paymentIntent, $invoiceUrl, $invoicePdf, (int) $paymentId]);
            return;
        }
    }
    $pdo->prepare(
        'INSERT INTO payments (user_id, amount_cents, currency, status, description, stripe_customer_id, stripe_checkout_session_id, stripe_payment_intent_id, stripe_invoice_id, invoice_url, invoice_pdf) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([$userId, $amount, $currency, $status, $description, $customerId, $sessionId, $paymentIntent, $invoiceId, $invoiceUrl, $invoicePdf]);
    if ($customerId !== '') {
        $pdo->prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ? AND stripe_customer_id = ?')->execute([$customerId, $userId, '']);
    }
}

function stripe_record_invoice(PDO $pdo, int $userId, array $object): void
{
    $invoiceId = stripe_text($object, 'id');
    if ($invoiceId === '') {
        return;
    }
    $stmt = $pdo->prepare('SELECT id FROM payments WHERE stripe_invoice_id = ? LIMIT 1');
    $stmt->execute([$invoiceId]);
    $paymentId = $stmt->fetchColumn();
    $amount = stripe_int($object, 'amount_paid', stripe_int($object, 'total'));
    $currency = strtolower(stripe_text($object, 'currency', 'cad'));
    $status = stripe_text($object, 'status', 'paid');
    $customerId = stripe_text($object, 'customer');
    $paymentIntent = stripe_text($object, 'payment_intent');
    $invoiceUrl = stripe_text($object, 'hosted_invoice_url');
    $invoicePdf = stripe_text($object, 'invoice_pdf');
    $description = stripe_text($object, 'description', 'Stripe invoice');
    if ($paymentId) {
        $pdo->prepare('UPDATE payments SET amount_cents = ?, currency = ?, status = ?, description = ?, stripe_customer_id = ?, stripe_payment_intent_id = ?, invoice_url = ?, invoice_pdf = ? WHERE id = ?')
            ->execute([$amount, $currency, $status, $description, $customerId, $paymentIntent, $invoiceUrl, $invoicePdf, (int) $paymentId]);
    } else {
        $pdo->prepare(
            'INSERT INTO payments (user_id, amount_cents, currency, status, description, stripe_customer_id, stripe_payment_intent_id, stripe_invoice_id, invoice_url, invoice_pdf) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$userId, $amount, $currency, $status, $description, $customerId, $paymentIntent, $invoiceId, $invoiceUrl, $invoicePdf]);
    }
    if ($customerId !== '') {
        $pdo->prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ? AND stripe_customer_id = ?')->execute([$customerId, $userId, '']);
    }
}

function stripe_apply_checkout_completed(PDO $pdo, int $userId, array $object): void
{
    $metadata = stripe_object_metadata($object);
    stripe_record_payment($pdo, $userId, $object);

    $credits = stripe_int($metadata, 'credits');
    if ($credits > 0) {
        $reference = stripe_text($object, 'id', 'stripe_checkout');
        $stmt = $pdo->prepare('SELECT id FROM credit_ledger WHERE user_id = ? AND reason = ? AND reference = ? LIMIT 1');
        $stmt->execute([$userId, 'stripe_checkout', $reference]);
        if (!$stmt->fetchColumn()) {
            $pdo->prepare('UPDATE users SET credits = credits + ? WHERE id = ?')->execute([$credits, $userId]);
            $pdo->prepare('INSERT INTO credit_ledger (user_id, delta, reason, reference) VALUES (?, ?, ?, ?)')
                ->execute([$userId, $credits, 'stripe_checkout', $reference]);
        }
    }

    if (stripe_text($object, 'subscription') !== '' || stripe_text($metadata, 'plan') !== '' || stripe_text($metadata, 'offer') !== '') {
        $subscriptionObject = $object;
        $subscriptionObject['status'] = stripe_text($object, 'subscription_status', stripe_text($object, 'status', 'active'));
        stripe_upsert_subscription($pdo, $userId, $subscriptionObject);
    }
}

function stripe_process_event(PDO $pdo, string $type, array $object): array
{
    $user = stripe_find_user($pdo, $object);
    if ($user === null) {
        return ['status' => 'ignored', 'reason' => 'user_not_found'];
    }
    $userId = (int) $user['id'];

    if ($type === 'checkout.session.completed') {
        stripe_apply_checkout_completed($pdo, $userId, $object);
        return ['status' => 'processed', 'user_id' => $userId];
    }

    if (in_array($type, ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'], true)) {
        $subscriptionObject = $object;
        if ($type === 'customer.subscription.deleted') {
            $subscriptionObject['status'] = 'canceled';
        }
        stripe_upsert_subscription($pdo, $userId, $subscriptionObject);
        return ['status' => 'processed', 'user_id' => $userId];
    }

    if (in_array($type, ['invoice.paid', 'invoice.payment_succeeded', 'invoice.payment_failed'], true)) {
        stripe_record_invoice($pdo, $userId, $object);
        return ['status' => 'processed', 'user_id' => $userId];
    }

    return ['status' => 'ignored', 'reason' => 'unsupported_event'];
}

function handle_stripe_webhook(): void
{
    $raw = file_get_contents('php://input');
    $payloadHash = is_string($raw) ? stripe_webhook_payload_hash($raw) : '';
    $pdo = db();
    if ($raw === false || trim($raw) === '') {
        stripe_app_log($pdo, 'warning', 'stripe_webhook_empty_payload', 'Webhook Stripe vide', [], 400);
        json_response(['ok' => false, 'error' => 'empty_payload'], 400);
        return;
    }
    $settings = stripe_settings($pdo);
    if ($settings['webhook_secret'] !== '') {
        $signature = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
        if (!stripe_verify_webhook_signature($raw, $signature, $settings['webhook_secret'])) {
            $eventId = 'evt_invalid_' . $payloadHash;
            if (function_exists('stripe_event_log')) {
                stripe_event_log($pdo, $eventId, 'unknown', '', false, 'failed', 'invalid_stripe_signature', $payloadHash);
            }
            stripe_app_log($pdo, 'security', 'stripe_webhook_signature_failed', 'Signature Stripe invalide', ['payload_hash' => $payloadHash], 400);
            json_response(['ok' => false, 'error' => 'invalid_stripe_signature'], 400);
            return;
        }
    } elseif (!stripe_webhook_allowed()) {
        stripe_app_log($pdo, 'security', 'stripe_webhook_unsigned_blocked', 'Webhook Stripe non signe bloque', ['payload_hash' => $payloadHash], 403);
        json_response(['ok' => false, 'error' => 'unsigned_webhook_disabled'], 403);
        return;
    }
    $event = json_decode($raw, true);
    if (!is_array($event)) {
        stripe_app_log($pdo, 'warning', 'stripe_webhook_invalid_json', 'Webhook Stripe JSON invalide', ['payload_hash' => $payloadHash], 400);
        json_response(['ok' => false, 'error' => 'invalid_json'], 400);
        return;
    }

    $eventId = stripe_text($event, 'id', 'evt_local_' . hash('sha256', $raw));
    $type = stripe_text($event, 'type');
    $object = $event['data']['object'] ?? [];
    if ($type === '' || !is_array($object)) {
        stripe_store_event_log($pdo, $eventId, $type !== '' ? $type : 'unknown', [], stripe_webhook_livemode($event), 'failed', $payloadHash, 'invalid_stripe_event');
        stripe_app_log($pdo, 'warning', 'stripe_webhook_invalid_event', 'Webhook Stripe invalide', ['event_id' => $eventId, 'type' => $type], 400);
        json_response(['ok' => false, 'error' => 'invalid_stripe_event'], 400);
        return;
    }

    $livemode = stripe_webhook_livemode($event);
    stripe_store_event_log($pdo, $eventId, $type, $object, $livemode, 'received', $payloadHash);
    stripe_app_log($pdo, 'info', 'stripe_webhook_received', 'Webhook Stripe recu', [
        'event_id' => $eventId,
        'type' => $type,
        'object_id' => stripe_webhook_object_id($object),
        'livemode' => $livemode,
    ]);

    $pdo->beginTransaction();
    try {
        $claim = stripe_claim_event_for_processing($pdo, $eventId, $type, $raw);
        if (($claim['action'] ?? '') === 'skip') {
            $pdo->commit();
            $storedStatus = (string) ($claim['status'] ?? 'terminal');
            stripe_store_event_log($pdo, $eventId, $type, $object, $livemode, $storedStatus === 'processed' ? 'processed' : 'ignored', $payloadHash, 'duplicate_' . $storedStatus);
            stripe_app_log($pdo, 'info', 'stripe_webhook_duplicate_terminal', 'Webhook Stripe deja termine', [
                'event_id' => $eventId,
                'type' => $type,
                'status' => $storedStatus,
            ]);
            json_response(['ok' => true, 'status' => 'duplicate', 'stored_status' => $storedStatus, 'event_id' => $eventId]);
            return;
        }

        stripe_store_event_log($pdo, $eventId, $type, $object, $livemode, 'processing', $payloadHash, (string) ($claim['previous_status'] ?? ''));
        $result = stripe_process_event($pdo, $type, $object);
        $finalStatus = (string) $result['status'];
        $pdo->prepare('UPDATE stripe_events SET status = ?, error = ?, processed_at = CURRENT_TIMESTAMP WHERE event_id = ?')
            ->execute([$finalStatus, '', $eventId]);
        stripe_store_event_log($pdo, $eventId, $type, $object, $livemode, (string) $result['status'] === 'ignored' ? 'ignored' : 'processed', $payloadHash, (string) ($result['reason'] ?? ''));
        stripe_app_log($pdo, 'info', stripe_processed_event_code($type, $result), 'Webhook Stripe traite', [
            'event_id' => $eventId,
            'type' => $type,
            'status' => (string) $result['status'],
            'reason' => (string) ($result['reason'] ?? ''),
        ]);
        $pdo->commit();
        json_response(['ok' => true, 'event_id' => $eventId] + $result);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        stripe_mark_event_failed($pdo, $eventId, $type, $raw, $e->getMessage());
        stripe_store_event_log($pdo, $eventId, $type, $object, $livemode, 'failed', $payloadHash, $e->getMessage());
        stripe_app_log($pdo, 'error', 'stripe_webhook_failed', 'Webhook Stripe echoue', [
            'event_id' => $eventId,
            'type' => $type,
            'error' => $e->getMessage(),
        ], 500);
        json_response(['ok' => false, 'error' => 'webhook_failed', 'event_id' => $eventId], 500);
    }
}
