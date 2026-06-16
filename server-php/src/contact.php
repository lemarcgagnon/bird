<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/i18n.php';
require_once __DIR__ . '/mail.php';

function contact_csrf_token(): string
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (!isset($_SESSION['contact_csrf']) || !is_string($_SESSION['contact_csrf']) || $_SESSION['contact_csrf'] === '') {
        $_SESSION['contact_csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['contact_csrf'];
}

function contact_csrf_valid(string $token): bool
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    $expected = (string) ($_SESSION['contact_csrf'] ?? '');
    return $token !== '' && $expected !== '' && hash_equals($expected, $token);
}

function handle_contact_post(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    $lang = page_lang();
    $pdo = db();
    $name = trim((string) ($_POST['name'] ?? ''));
    $email = strtolower(trim((string) ($_POST['email'] ?? '')));
    $subject = trim((string) ($_POST['subject'] ?? ''));
    $message = trim((string) ($_POST['message'] ?? ''));
    $honeypot = trim((string) ($_POST['website'] ?? ''));
    $errors = [];

    if (!contact_csrf_valid((string) ($_POST['csrf_token'] ?? ''))) {
        $errors[] = page_t('contact_error_csrf', $lang);
    }
    if ($honeypot !== '') {
        $errors[] = page_t('contact_error_honeypot', $lang);
    }
    if (!auth_rate_limit_hit($pdo, 'contact:ip', auth_client_ip(), 3, 600)) {
        $errors[] = page_t('contact_error_rate', $lang);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
        $errors[] = page_t('contact_error_email', $lang);
    }
    if ($subject === '' || strlen($subject) > 140) {
        $errors[] = page_t('contact_error_subject', $lang);
    }
    if ($message === '' || strlen($message) > 4000) {
        $errors[] = page_t('contact_error_message', $lang);
    }
    if (strlen($name) > 120) {
        $name = substr($name, 0, 120);
    }

    if ($errors === []) {
        $settings = mail_settings($pdo);
        $body = "Message contact Nichoir\n\n"
            . "Nom: " . ($name !== '' ? $name : '-') . "\n"
            . "Email: " . $email . "\n"
            . "IP: " . auth_client_ip() . "\n\n"
            . $message;
        try {
            smtp_send_email($pdo, (string) $settings['support_email'], '[Nichoir contact] ' . $subject, $body);
            if (function_exists('app_log')) {
                app_log($pdo, 'info', 'email', 'contact_email_sent', 'Message contact envoye', [
                    'email_hash' => function_exists('log_hash_value') ? log_hash_value($email) : null,
                    'subject' => substr($subject, 0, 140),
                ]);
            }
            $_SESSION['contact_success'] = true;
            $_SESSION['contact_old'] = [];
            header('Location: ' . page_path_with_lang('/contact', $lang));
            return;
        } catch (Throwable $e) {
            if (function_exists('app_log')) {
                app_log($pdo, 'error', 'email', 'contact_email_failed', 'Echec message contact', [
                    'email_hash' => function_exists('log_hash_value') ? log_hash_value($email) : null,
                    'error' => $e->getMessage(),
                ]);
            }
            $errors[] = page_t('contact_error_smtp', $lang);
        }
    }

    $_SESSION['contact_errors'] = $errors;
    $_SESSION['contact_old'] = ['name' => $name, 'email' => $email, 'subject' => $subject, 'message' => $message];
    header('Location: ' . page_path_with_lang('/contact', $lang));
}
