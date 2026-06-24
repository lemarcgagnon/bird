<?php

declare(strict_types=1);

require_once __DIR__ . '/admin_core.php';
require_once __DIR__ . '/admin_helpers.php';
require_once __DIR__ . '/credits.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/library.php';
require_once __DIR__ . '/mail.php';
require_once __DIR__ . '/stripe.php';

function handle_admin_login(): void
{
    if (!admin_csrf_valid((string) ($_POST['csrf_token'] ?? ''))) {
        page_response('Admin', '<section class="page-title"><h1>Connexion admin</h1><p>Session invalide. Recharge la page.</p></section>', admin_login_path(), 403);
        return;
    }
    $password = (string) ($_POST['password'] ?? '');
    if (!admin_verify_password($password)) {
        if (function_exists('app_log')) {
            app_log(db(), 'security', 'admin', 'admin_login_failed', 'Connexion admin refusee', [], null, 403);
        }
        header('Location: ' . admin_login_path() . '?error=1');
        return;
    }
    admin_mark_logged_in();
    if (function_exists('app_log')) {
        app_log(db(), 'security', 'admin', 'admin_login_success', 'Connexion admin reussie');
    }
    header('Location: ' . admin_base_path());
}

function handle_admin_logout(): void
{
    if (!admin_csrf_valid((string) ($_POST['csrf_token'] ?? ''))) {
        page_response('Admin', '<section class="page-title"><h1>Admin protege</h1><p>Session invalide. Recharge la page.</p></section>', admin_login_path(), 403);
        return;
    }
    admin_mark_logged_out();
    header('Location: ' . admin_login_path() . '?logout=1');
}

function admin_create_user(PDO $pdo): void
{
    $email = strtolower(trim((string) ($_POST['email'] ?? '')));
    $name = trim((string) ($_POST['display_name'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    $credits = max(0, (int) ($_POST['credits'] ?? 0));
    $status = (string) ($_POST['status'] ?? 'active');
    if (!admin_valid_email($email) || !admin_valid_display_name($name) || !admin_valid_password($password) || !admin_valid_user_status($status)) {
        header('Location: ' . admin_redirect_url(['notice' => 'creation_invalide']));
        return;
    }
    $pdo->beginTransaction();
    try {
        $verifiedAt = $status === 'pending' ? null : sql_utc_datetime();
        $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, display_name, credits, status, email_verified_at) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$email, password_hash($password, PASSWORD_DEFAULT), $name, $credits, $status, $verifiedAt]);
        $newUserId = (int) $pdo->lastInsertId();
        if ($credits > 0) {
            $pdo->prepare('INSERT INTO credit_ledger (user_id, delta, reason, reference) VALUES (?, ?, ?, ?)')
                ->execute([$newUserId, $credits, 'admin_create_user', 'initial']);
        }
        audit_admin_action($pdo, $newUserId, 'create_user', $credits, $email);
        $pdo->commit();
        redirect_admin($newUserId, 'client_cree');
    } catch (Throwable $e) {
        $pdo->rollBack();
        header('Location: ' . admin_redirect_url(['notice' => 'creation_erreur']));
    }
}

function admin_update_user(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $email = strtolower(trim((string) ($_POST['email'] ?? '')));
    $name = trim((string) ($_POST['display_name'] ?? ''));
    $status = (string) ($_POST['status'] ?? 'active');
    $credits = max(0, (int) ($_POST['credits'] ?? 0));
    if (!admin_valid_email($email) || !admin_valid_display_name($name) || !admin_valid_user_status($status)) {
        redirect_admin($userId, 'profil_invalide');
        return;
    }
    $delta = $credits - (int) $currentUser['credits'];
    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            "UPDATE users
             SET email = ?,
                 display_name = ?,
                 status = ?,
                 credits = ?,
                 email_verified_at = CASE WHEN ? <> 'pending' AND email_verified_at IS NULL THEN CURRENT_TIMESTAMP ELSE email_verified_at END,
                 email_verification_code_hash = CASE WHEN ? <> 'pending' THEN '' ELSE email_verification_code_hash END,
                 email_verification_expires_at = CASE WHEN ? <> 'pending' THEN NULL ELSE email_verification_expires_at END,
                 email_verification_sent_at = CASE WHEN ? <> 'pending' THEN NULL ELSE email_verification_sent_at END
             WHERE id = ?"
        )->execute([$email, $name, $status, $credits, $status, $status, $status, $status, $userId]);
        if ($delta !== 0) {
            $pdo->prepare('INSERT INTO credit_ledger (user_id, delta, reason, reference) VALUES (?, ?, ?, ?)')
                ->execute([$userId, $delta, 'admin_set_balance', 'profile']);
        }
        audit_admin_action($pdo, $userId, 'update_user', $delta, $email);
        $pdo->commit();
        redirect_admin($userId, 'profil_modifie');
    } catch (Throwable $e) {
        $pdo->rollBack();
        redirect_admin($userId, 'profil_erreur');
    }
}

function admin_reset_password(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $password = (string) ($_POST['password'] ?? '');
    if (!admin_valid_password($password)) {
        redirect_admin($userId, 'mot_de_passe_invalide');
        return;
    }
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $userId]);
    audit_admin_action($pdo, $userId, 'reset_password', null, 'admin_reset');
    redirect_admin($userId, 'mot_de_passe_modifie');
}

function admin_delete_user(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $confirm = trim((string) ($_POST['confirm'] ?? ''));
    if ($confirm !== 'DELETE') {
        redirect_admin($userId, 'confirmation_requise');
        return;
    }
    $email = (string) $currentUser['email'];
    $pdo->beginTransaction();
    try {
        audit_admin_action($pdo, $userId, 'delete_user', null, $email);
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
        $pdo->commit();
        header('Location: ' . admin_redirect_url(['notice' => 'client_supprime']));
    } catch (Throwable $e) {
        $pdo->rollBack();
        redirect_admin($userId, 'suppression_erreur');
    }
}

function admin_adjust_credits(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $delta = (int) ($_POST['delta'] ?? 0);
    $note = trim((string) ($_POST['note'] ?? ''));
    if ($delta === 0) {
        redirect_admin($userId, 'delta_zero');
        return;
    }
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE users SET credits = credits + ? WHERE id = ?')->execute([$delta, $userId]);
        $pdo->prepare('INSERT INTO credit_ledger (user_id, delta, reason, reference) VALUES (?, ?, ?, ?)')
            ->execute([$userId, $delta, 'admin_adjustment', $note]);
        audit_admin_action($pdo, $userId, 'adjust_credits', $delta, $note);
        $pdo->commit();
        redirect_admin($userId, 'credits_ajustes');
    } catch (Throwable $e) {
        $pdo->rollBack();
        redirect_admin($userId, 'erreur_credits');
    }
}

function admin_set_status(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $status = (string) ($_POST['status'] ?? 'active');
    if (!in_array($status, ['pending', 'active', 'suspended', 'closed'], true)) {
        redirect_admin($userId, 'statut_invalide');
        return;
    }
    $pdo->prepare(
        "UPDATE users
         SET status = ?,
             email_verified_at = CASE WHEN ? <> 'pending' AND email_verified_at IS NULL THEN CURRENT_TIMESTAMP ELSE email_verified_at END,
             email_verification_code_hash = CASE WHEN ? <> 'pending' THEN '' ELSE email_verification_code_hash END,
             email_verification_expires_at = CASE WHEN ? <> 'pending' THEN NULL ELSE email_verification_expires_at END,
             email_verification_sent_at = CASE WHEN ? <> 'pending' THEN NULL ELSE email_verification_sent_at END
         WHERE id = ?"
    )->execute([$status, $status, $status, $status, $status, $userId]);
    audit_admin_action($pdo, $userId, 'set_status', null, $status);
    redirect_admin($userId, 'statut_modifie');
}

function admin_set_subscription(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $plan = (string) ($_POST['plan'] ?? 'none');
    $status = (string) ($_POST['subscription_status'] ?? 'none');
    if (!in_array($plan, ADMIN_PLANS, true) || !in_array($status, ADMIN_SUBSCRIPTION_STATUSES, true)) {
        redirect_admin($userId, 'abonnement_invalide');
        return;
    }
    $periodEnd = trim((string) ($_POST['current_period_end'] ?? ''));
    $periodEnd = $periodEnd === '' ? null : $periodEnd;
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE users SET subscription_status = ? WHERE id = ?')->execute([$status, $userId]);
        $existing = $pdo->prepare('SELECT id FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1');
        $existing->execute([$userId]);
        $subscriptionId = $existing->fetchColumn();
        if ($subscriptionId) {
            $pdo->prepare('UPDATE subscriptions SET plan = ?, status = ?, current_period_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                ->execute([$plan, $status, $periodEnd, (int) $subscriptionId]);
        } else {
            $pdo->prepare('INSERT INTO subscriptions (user_id, plan, status, current_period_end) VALUES (?, ?, ?, ?)')
                ->execute([$userId, $plan, $status, $periodEnd]);
        }
        audit_admin_action($pdo, $userId, 'set_subscription', null, $plan . ':' . $status);
        $pdo->commit();
        redirect_admin($userId, 'abonnement_modifie');
    } catch (Throwable $e) {
        $pdo->rollBack();
        redirect_admin($userId, 'erreur_abonnement');
    }
}

function admin_reply_ticket(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $ticketId = (int) ($_POST['ticket_id'] ?? 0);
    $ticket = admin_load_ticket($pdo, $ticketId, $userId);
    if ($ticket === null) {
        redirect_admin($userId, 'ticket_introuvable');
        return;
    }
    if (($ticket['status'] ?? 'open') !== 'open') {
        redirect_admin($userId, 'ticket_ferme', $ticketId);
        return;
    }
    $body = trim((string) ($_POST['body'] ?? ''));
    if (!string_length_between($body, 1, 5000)) {
        redirect_admin($userId, 'message_ticket_invalide', $ticketId);
        return;
    }
    $notificationId = 0;
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO ticket_messages (ticket_id, user_id, author_role, body) VALUES (?, ?, ?, ?)')
            ->execute([$ticketId, $userId, 'admin', $body]);
        $pdo->prepare('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$ticketId]);
        $notificationId = admin_create_ticket_notification($pdo, $ticket, $currentUser, 'Reponse support ticket #' . $ticketId, $body);
        audit_admin_action($pdo, $userId, 'reply_ticket', null, 'ticket #' . $ticketId);
        $pdo->commit();
        ticket_notification_send($pdo, $notificationId);
        redirect_admin($userId, 'reponse_ticket_envoyee', $ticketId);
    } catch (Throwable $e) {
        $pdo->rollBack();
        redirect_admin($userId, 'erreur_ticket', $ticketId);
    }
}

function admin_set_ticket_status(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $ticketId = (int) ($_POST['ticket_id'] ?? 0);
    $ticket = admin_load_ticket($pdo, $ticketId, $userId);
    $status = strtolower(trim((string) ($_POST['ticket_status'] ?? '')));
    if ($ticket === null || !admin_valid_ticket_status($status)) {
        redirect_admin($userId, 'statut_ticket_invalide', $ticketId);
        return;
    }
    $closedAt = $status === 'closed' ? 'CURRENT_TIMESTAMP' : 'NULL';
    $notificationId = 0;
    $pdo->beginTransaction();
    try {
        $updateTicket = $pdo->prepare('UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP, closed_at = ' . $closedAt . ' WHERE id = ?');
        $updateTicket->execute([$status, $ticketId]);
        $notificationId = admin_create_ticket_notification(
            $pdo,
            $ticket,
            $currentUser,
            'Statut ticket #' . $ticketId . ': ' . $status,
            "Le statut de ton ticket #" . $ticketId . " est maintenant: " . $status . "."
        );
        audit_admin_action($pdo, $userId, 'set_ticket_status', null, 'ticket #' . $ticketId . ':' . $status);
        $pdo->commit();
        ticket_notification_send($pdo, $notificationId);
        redirect_admin($userId, 'statut_ticket_modifie', $ticketId);
    } catch (Throwable $e) {
        $pdo->rollBack();
        redirect_admin($userId, 'erreur_ticket', $ticketId);
    }
}

function admin_update_ticket_meta(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $ticketId = (int) ($_POST['ticket_id'] ?? 0);
    $ticket = admin_load_ticket($pdo, $ticketId, $userId);
    $priority = strtolower(trim((string) ($_POST['priority'] ?? 'normal')));
    $assignedTo = trim((string) ($_POST['assigned_to'] ?? ''));
    if ($ticket === null || !admin_valid_ticket_priority($priority) || strlen($assignedTo) > 120) {
        redirect_admin($userId, 'meta_ticket_invalide', $ticketId);
        return;
    }
    $pdo->prepare('UPDATE tickets SET priority = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        ->execute([$priority, $assignedTo, $ticketId]);
    audit_admin_action($pdo, $userId, 'update_ticket_meta', null, 'ticket #' . $ticketId . ':' . $priority . ':' . $assignedTo);
    redirect_admin($userId, 'ticket_modifie', $ticketId);
}

function admin_update_email_settings(PDO $pdo): void
{
    $enabled = isset($_POST['smtp_enabled']) ? '1' : '0';
    $host = trim((string) ($_POST['smtp_host'] ?? ''));
    $port = (int) ($_POST['smtp_port'] ?? 587);
    $encryption = strtolower(trim((string) ($_POST['smtp_encryption'] ?? 'tls')));
    $username = trim((string) ($_POST['smtp_username'] ?? ''));
    $password = (string) ($_POST['smtp_password'] ?? '');
    $fromEmail = strtolower(trim((string) ($_POST['smtp_from_email'] ?? '')));
    $fromName = trim((string) ($_POST['smtp_from_name'] ?? 'Nichoir support'));
    $supportEmail = strtolower(trim((string) ($_POST['support_email'] ?? '')));

    if (!in_array($encryption, SMTP_ENCRYPTIONS, true) || $port <= 0 || $port > 65535) {
        header('Location: ' . admin_redirect_url(['notice' => 'smtp_invalide']));
        return;
    }
    if ($enabled === '1' && ($host === '' || !filter_var($fromEmail, FILTER_VALIDATE_EMAIL) || !filter_var($supportEmail, FILTER_VALIDATE_EMAIL))) {
        header('Location: ' . admin_redirect_url(['notice' => 'smtp_champs_requis']));
        return;
    }

    setting_set($pdo, 'smtp_enabled', $enabled);
    setting_set($pdo, 'smtp_host', $host);
    setting_set($pdo, 'smtp_port', (string) $port);
    setting_set($pdo, 'smtp_encryption', $encryption);
    setting_set($pdo, 'smtp_username', $username);
    if ($password !== '') {
        setting_set($pdo, 'smtp_password', $password);
    }
    setting_set($pdo, 'smtp_from_email', $fromEmail);
    setting_set($pdo, 'smtp_from_name', substr($fromName, 0, 120));
    setting_set($pdo, 'support_email', $supportEmail);
    audit_admin_action($pdo, null, 'update_email_settings', null, $host . ':' . $port);
    header('Location: ' . admin_redirect_url(['notice' => 'smtp_modifie']));
}

function admin_send_test_email(PDO $pdo): void
{
    $recipient = strtolower(trim((string) ($_POST['test_recipient'] ?? '')));
    if (!filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
        header('Location: ' . admin_redirect_url(['notice' => 'email_test_invalide']));
        return;
    }
    try {
        smtp_send_email(
            $pdo,
            $recipient,
            'Test email Nichoir',
            "Ceci est un test SMTP depuis le panneau admin Nichoir.\n\nSi tu recois ce message, les coordonnees email sont valides."
        );
        audit_admin_action($pdo, null, 'send_test_email', null, $recipient);
        header('Location: ' . admin_redirect_url(['notice' => 'email_test_envoye']));
    } catch (Throwable $e) {
        $requestId = function_exists('log_request_id') ? log_request_id() : '';
        audit_admin_action($pdo, null, 'send_test_email_failed', null, 'email_test_failed' . ($requestId !== '' ? ':request_id=' . $requestId : ''));
        header('Location: ' . admin_redirect_url(['notice' => 'email_test_erreur']));
    }
}

function admin_update_stripe_settings(PDO $pdo): void
{
    $enabled = isset($_POST['stripe_enabled']) ? '1' : '0';
    $secretKey = trim((string) ($_POST['stripe_secret_key'] ?? ''));
    $webhookSecret = trim((string) ($_POST['stripe_webhook_secret'] ?? ''));
    $currency = strtolower(trim((string) ($_POST['stripe_currency'] ?? 'cad')));
    $priceCredits = trim((string) ($_POST['stripe_price_credits'] ?? ''));
    $priceAtelier = trim((string) ($_POST['stripe_price_atelier'] ?? ''));
    $pricePro = trim((string) ($_POST['stripe_price_pro'] ?? ''));
    $creditsQuantity = max(1, (int) ($_POST['stripe_credits_quantity'] ?? 50));

    if (!preg_match('/^[a-z]{3}$/', $currency)) {
        header('Location: ' . admin_redirect_url(['notice' => 'stripe_devise_invalide']));
        return;
    }
    if ($enabled === '1' && ($priceCredits === '' && $priceAtelier === '' && $pricePro === '')) {
        header('Location: ' . admin_redirect_url(['notice' => 'stripe_prix_requis']));
        return;
    }

    setting_set($pdo, 'stripe_enabled', $enabled);
    if ($secretKey !== '') {
        setting_set($pdo, 'stripe_secret_key', $secretKey);
    }
    if ($webhookSecret !== '') {
        setting_set($pdo, 'stripe_webhook_secret', $webhookSecret);
    }
    setting_set($pdo, 'stripe_currency', $currency);
    setting_set($pdo, 'stripe_price_credits', $priceCredits);
    setting_set($pdo, 'stripe_price_atelier', $priceAtelier);
    setting_set($pdo, 'stripe_price_pro', $pricePro);
    setting_set($pdo, 'stripe_credits_quantity', (string) $creditsQuantity);
    audit_admin_action($pdo, null, 'update_stripe_settings', null, $enabled . ':' . $currency);
    header('Location: ' . admin_redirect_url(['notice' => 'stripe_modifie']));
}

function admin_update_credit_policy_settings(PDO $pdo): void
{
    $exportCost = max(1, (int) ($_POST['export_credit_cost'] ?? 3));
    $partialBonusEnabled = isset($_POST['partial_credit_bonus_enabled']) ? '1' : '0';

    setting_set($pdo, 'export_credit_cost', (string) $exportCost);
    setting_set($pdo, 'partial_credit_bonus_enabled', $partialBonusEnabled);
    audit_admin_action($pdo, null, 'update_credit_policy_settings', $exportCost, $partialBonusEnabled);
    header('Location: ' . admin_redirect_url(['notice' => 'credits_regles']) . '#admin-settings');
}

function admin_update_library_settings(PDO $pdo): void
{
    try {
        $stlMaxMb = max(1, min(LIBRARY_MAX_STL_MB, (int) ($_POST['library_stl_upload_max_mb'] ?? LIBRARY_DEFAULT_MAX_STL_MB)));
        $imageMaxMb = max(1, min(LIBRARY_MAX_IMAGE_MB, (int) ($_POST['library_image_upload_max_mb'] ?? LIBRARY_DEFAULT_MAX_IMAGE_MB)));
        $storageDir = library_admin_config_path((string) ($_POST['library_storage_dir'] ?? ''), library_storage_dir());
        $appImageDir = library_admin_config_path((string) ($_POST['library_app_image_dir'] ?? ''), library_app_image_dir());

        setting_set($pdo, 'library_stl_upload_max_mb', (string) $stlMaxMb);
        setting_set($pdo, 'library_image_upload_max_mb', (string) $imageMaxMb);
        setting_set($pdo, 'library_storage_dir', $storageDir);
        setting_set($pdo, 'library_app_image_dir', $appImageDir);
        audit_admin_action($pdo, null, 'update_library_settings', $stlMaxMb, 'stl=' . $stlMaxMb . ':image=' . $imageMaxMb);
        header('Location: ' . admin_redirect_url(['notice' => 'library_settings_updated']) . '#admin-settings');
    } catch (Throwable) {
        header('Location: ' . admin_redirect_url(['notice' => 'library_settings_invalid']) . '#admin-settings');
    }
}

function admin_upload_library_item(PDO $pdo): void
{
    $files = $_FILES['library_files'] ?? ($_FILES['library_file'] ?? []);
    $result = library_admin_upload_many(
        $pdo,
        is_array($files) ? $files : [],
        (string) ($_POST['title'] ?? ''),
        (string) ($_POST['description'] ?? ''),
        (int) ($_POST['cost'] ?? 1),
        isset($_POST['is_active'])
    );
    $uploadedCount = count($result['uploaded']);
    $failedCount = count($result['failed']);
    app_log($pdo, $uploadedCount > 0 ? 'info' : 'warning', 'admin', 'library_upload_result', 'Resultat upload librairie admin', [
        'uploaded' => $uploadedCount,
        'failed' => $failedCount,
        'failures' => array_slice($result['failed'], 0, 10),
        'app_stl_upload_max_mb' => library_stl_upload_max_mb($pdo),
        'app_image_upload_max_mb' => library_image_upload_max_mb($pdo),
        'library_storage_dir' => library_storage_dir(),
        'library_app_image_dir' => library_app_image_dir(),
        'php_upload_max_filesize' => (string) ini_get('upload_max_filesize'),
        'php_post_max_size' => (string) ini_get('post_max_size'),
    ], null, $uploadedCount > 0 ? 200 : 422);
    $failureReasons = array_values(array_unique(array_map(
        static fn (array $failure): string => (string) ($failure['error'] ?? 'unknown_upload_error'),
        $result['failed']
    )));
    $failureSummary = substr(implode(',', $failureReasons), 0, 180);
    if ($uploadedCount > 0) {
        audit_admin_action($pdo, null, 'upload_library_item', null, 'uploaded:' . $uploadedCount . ':failed:' . $failedCount);
        header('Location: ' . admin_redirect_url([
            'notice' => 'library_uploaded',
            'uploaded' => $uploadedCount,
            'failed' => $failedCount,
            'errors' => $failureSummary,
        ]) . '#admin-library');
        return;
    }
    audit_admin_action($pdo, null, 'upload_library_item_failed', null, 'failed:' . $failedCount);
    header('Location: ' . admin_redirect_url([
        'notice' => 'library_upload_error',
        'uploaded' => 0,
        'failed' => $failedCount,
        'errors' => $failureSummary,
    ]) . '#admin-library');
}

function admin_update_library_item(PDO $pdo): void
{
    $itemId = (int) ($_POST['library_item_id'] ?? 0);
    if ($itemId <= 0) {
        header('Location: ' . admin_redirect_url(['notice' => 'library_item_invalid']) . '#admin-library');
        return;
    }
    try {
        library_admin_update(
            $pdo,
            $itemId,
            (string) ($_POST['title'] ?? ''),
            (string) ($_POST['description'] ?? ''),
            (int) ($_POST['cost'] ?? 1),
            isset($_POST['is_active'])
        );
        audit_admin_action($pdo, null, 'update_library_item', null, 'library_item:' . $itemId);
        header('Location: ' . admin_redirect_url(['notice' => 'library_updated']) . '#admin-library');
    } catch (Throwable $e) {
        audit_admin_action($pdo, null, 'update_library_item_failed', null, 'library_item:' . $itemId);
        header('Location: ' . admin_redirect_url(['notice' => 'library_update_error']) . '#admin-library');
    }
}

function admin_archive_library_item(PDO $pdo): void
{
    $itemId = (int) ($_POST['library_item_id'] ?? 0);
    if ($itemId <= 0) {
        header('Location: ' . admin_redirect_url(['notice' => 'library_item_invalid']) . '#admin-library');
        return;
    }
    try {
        $result = library_admin_archive($pdo, $itemId);
        $fileDeleted = (bool) $result['deleted_file'];
        audit_admin_action($pdo, null, 'archive_library_item', null, 'library_item:' . $itemId . ':file_deleted=' . ($fileDeleted ? '1' : '0'));
        if (!$fileDeleted) {
            app_log($pdo, 'warning', 'admin', 'library_archive_file_delete_failed', 'Fichier librairie archive mais original prive non supprime', ['item_id' => $itemId], null, 207);
        }
        header('Location: ' . admin_redirect_url(['notice' => $fileDeleted ? 'library_archived' : 'library_archived_file_kept']) . '#admin-library');
    } catch (Throwable $e) {
        audit_admin_action($pdo, null, 'archive_library_item_failed', null, 'library_item:' . $itemId);
        app_log($pdo, 'warning', 'admin', 'library_archive_failed', 'Archivage fichier librairie refuse', ['item_id' => $itemId, 'error' => $e->getMessage()], null, 422);
        header('Location: ' . admin_redirect_url(['notice' => 'library_archive_error']) . '#admin-library');
    }
}

function admin_regenerate_library_thumbnail(PDO $pdo): void
{
    $itemId = (int) ($_POST['library_item_id'] ?? 0);
    if ($itemId <= 0) {
        header('Location: ' . admin_redirect_url(['notice' => 'library_item_invalid']) . '#admin-library');
        return;
    }
    try {
        $item = library_find_item($pdo, $itemId, false);
        if ($item === null || !library_is_stl_item($item)) {
            throw new RuntimeException('library_stl_not_found');
        }
        library_write_stl_png_thumbnail($item);
        library_touch_item_thumbnail($pdo, $itemId);
        audit_admin_action($pdo, null, 'regenerate_library_thumbnail', null, 'library_item:' . $itemId);
        header('Location: ' . admin_redirect_url(['notice' => 'library_thumbnail_regenerated']) . '#admin-library');
    } catch (Throwable $e) {
        audit_admin_action($pdo, null, 'regenerate_library_thumbnail_failed', null, 'library_item:' . $itemId);
        app_log($pdo, 'warning', 'admin', 'library_thumbnail_regeneration_failed', 'Regeneration miniature STL refusee', ['item_id' => $itemId, 'error' => $e->getMessage()], null, 422);
        header('Location: ' . admin_redirect_url(['notice' => 'library_thumbnail_error']) . '#admin-library');
    }
}

function admin_database_config_from_post(): array
{
    $local = db_local_config();
    $active = db_config();
    $driver = strtolower(trim((string) ($_POST['db_driver'] ?? $active['driver'])));
    $password = (string) ($_POST['mysql_password'] ?? '');
    if ($password === '') {
        $password = (string) (($local['mysql_password'] ?? '') ?: ($active['mysql_password'] ?? ''));
    }

    return db_normalize_config([
        'env' => (string) ($active['env'] ?? app_environment()),
        'dev_mode' => (string) ($active['dev_mode'] ?? '0'),
        'driver' => $driver,
        'sqlite_path' => trim((string) ($_POST['sqlite_path'] ?? $active['sqlite_path'])),
        'mysql_host' => trim((string) ($_POST['mysql_host'] ?? $active['mysql_host'])),
        'mysql_port' => trim((string) ($_POST['mysql_port'] ?? $active['mysql_port'])),
        'mysql_database' => trim((string) ($_POST['mysql_database'] ?? $active['mysql_database'])),
        'mysql_username' => trim((string) ($_POST['mysql_username'] ?? $active['mysql_username'])),
        'mysql_password' => $password,
        'mysql_charset' => trim((string) ($_POST['mysql_charset'] ?? $active['mysql_charset'])),
    ]);
}

function admin_handle_database_settings(PDO $pdo, bool $save): void
{
    $config = admin_database_config_from_post();
    if ($config['driver'] === 'mysql' && ($config['mysql_host'] === '' || $config['mysql_database'] === '' || $config['mysql_username'] === '')) {
        header('Location: ' . admin_redirect_url(['notice' => 'db_champs_requis']));
        return;
    }
    if ($config['driver'] === 'sqlite' && $config['sqlite_path'] === '') {
        header('Location: ' . admin_redirect_url(['notice' => 'db_sqlite_requis']));
        return;
    }

    try {
        db_test_config($config, $save);
        if ($save) {
            db_write_local_config($config);
            audit_admin_action(
                $pdo,
                null,
                'update_database_settings',
                null,
                $config['driver'] === 'mysql'
                    ? $config['mysql_host'] . ':' . $config['mysql_database']
                    : $config['sqlite_path']
            );
            header('Location: ' . admin_redirect_url(['notice' => 'db_modifie']) . '#admin-settings');
            return;
        }
        header('Location: ' . admin_redirect_url(['notice' => 'db_connexion_ok']) . '#admin-settings');
    } catch (Throwable $e) {
        $requestId = function_exists('log_request_id') ? log_request_id() : '';
        audit_admin_action($pdo, null, 'database_settings_failed', null, 'database_settings_failed' . ($requestId !== '' ? ':request_id=' . $requestId : ''));
        header('Location: ' . admin_redirect_url(['notice' => 'db_connexion_erreur']) . '#admin-settings');
    }
}

function handle_admin_post(): void
{
    if (!admin_allowed()) {
        if (function_exists('app_log')) {
            app_log(db(), 'security', 'admin', 'admin_access_denied', 'POST admin refuse', [], null, 403);
        }
        page_response('Admin', '<section class="page-title"><h1>Admin protege</h1><p>Acces refuse.</p></section>', admin_base_path(), 403);
        return;
    }
    if (!admin_csrf_valid((string) ($_POST['csrf_token'] ?? ''))) {
        if (function_exists('app_log')) {
            app_log(db(), 'security', 'admin', 'admin_csrf_invalid', 'CSRF admin invalide', [], null, 403);
        }
        page_response('Admin', '<section class="page-title"><h1>Admin protege</h1><p>Session invalide. Recharge la page.</p></section>', admin_base_path(), 403);
        return;
    }

    $action = (string) ($_POST['action'] ?? '');
    $pdo = db();

    if ($action === 'create_user') {
        admin_create_user($pdo);
        return;
    }
    if ($action === 'update_email_settings') {
        admin_update_email_settings($pdo);
        return;
    }
    if ($action === 'send_test_email') {
        admin_send_test_email($pdo);
        return;
    }
    if ($action === 'update_stripe_settings') {
        admin_update_stripe_settings($pdo);
        return;
    }
    if ($action === 'update_credit_policy_settings') {
        admin_update_credit_policy_settings($pdo);
        return;
    }
    if ($action === 'update_library_settings') {
        admin_update_library_settings($pdo);
        return;
    }
    if ($action === 'upload_library_item') {
        admin_upload_library_item($pdo);
        return;
    }
    if ($action === 'update_library_item') {
        admin_update_library_item($pdo);
        return;
    }
    if ($action === 'archive_library_item') {
        admin_archive_library_item($pdo);
        return;
    }
    if ($action === 'regenerate_library_thumbnail') {
        admin_regenerate_library_thumbnail($pdo);
        return;
    }
    if ($action === 'test_database_settings') {
        admin_handle_database_settings($pdo, false);
        return;
    }
    if ($action === 'update_database_settings') {
        admin_handle_database_settings($pdo, true);
        return;
    }

    $userId = (int) ($_POST['user_id'] ?? 0);
    if ($userId <= 0) {
        redirect_admin(0, 'client_invalide');
        return;
    }
    $currentUser = admin_load_user($pdo, $userId);
    if ($currentUser === null) {
        redirect_admin(0, 'client_introuvable');
        return;
    }

    match ($action) {
        'update_user' => admin_update_user($pdo, $currentUser),
        'reset_password' => admin_reset_password($pdo, $currentUser),
        'delete_user' => admin_delete_user($pdo, $currentUser),
        'adjust_credits' => admin_adjust_credits($pdo, $currentUser),
        'set_status' => admin_set_status($pdo, $currentUser),
        'set_subscription' => admin_set_subscription($pdo, $currentUser),
        'reply_ticket' => admin_reply_ticket($pdo, $currentUser),
        'set_ticket_status' => admin_set_ticket_status($pdo, $currentUser),
        'update_ticket_meta' => admin_update_ticket_meta($pdo, $currentUser),
        default => redirect_admin($userId, 'action_inconnue'),
    };
}
