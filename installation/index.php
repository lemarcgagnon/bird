<?php

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('log_errors', '1');
ini_set('display_errors', getenv('NICHOIR_DEBUG') === '1' ? '1' : '0');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

require_once __DIR__ . '/../server-php/src/db.php';
require_once __DIR__ . '/../server-php/src/mail.php';

const INSTALL_MIN_PHP_VERSION = '8.1.0';
const INSTALL_SMTP_LABELS = [
    'none' => 'Sans chiffrement',
    'tls' => 'TLS',
    'ssl' => 'SSL',
];

function install_h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function install_csrf_token(): string
{
    if (!isset($_SESSION['install_csrf']) || !is_string($_SESSION['install_csrf']) || $_SESSION['install_csrf'] === '') {
        $_SESSION['install_csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['install_csrf'];
}

function install_verify_csrf(): bool
{
    $token = (string) ($_POST['csrf_token'] ?? '');
    $expected = (string) ($_SESSION['install_csrf'] ?? '');
    return $token !== '' && $expected !== '' && hash_equals($expected, $token);
}

function install_base_form(array $config): array
{
    return [
        'db_driver' => (string) ($config['driver'] ?? 'mysql'),
        'sqlite_path' => (string) ($config['sqlite_path'] ?? dirname(__DIR__) . '/server-php/data/nichoir.sqlite'),
        'mysql_host' => (string) ($config['mysql_host'] ?? 'localhost'),
        'mysql_port' => (string) ($config['mysql_port'] ?? '3306'),
        'mysql_database' => (string) ($config['mysql_database'] ?? ''),
        'mysql_username' => (string) ($config['mysql_username'] ?? ''),
        'mysql_password' => '',
        'mysql_charset' => (string) ($config['mysql_charset'] ?? 'utf8mb4'),
        'support_email' => '',
        'smtp_enabled' => '0',
        'smtp_host' => '',
        'smtp_port' => '587',
        'smtp_encryption' => 'tls',
        'smtp_username' => '',
        'smtp_password' => '',
        'smtp_from_email' => '',
        'smtp_from_name' => 'Nichoir support',
    ];
}

function install_form_from_post(array $base): array
{
    $form = $base;
    foreach (array_keys($form) as $key) {
        if ($key === 'smtp_enabled') {
            $form[$key] = isset($_POST[$key]) ? '1' : '0';
            continue;
        }
        $form[$key] = trim((string) ($_POST[$key] ?? $form[$key]));
    }
    return $form;
}

function install_system_checks(): array
{
    $dataDir = dirname(__DIR__) . '/server-php/data';
    $lockPath = installation_lock_path();
    return [
        [
            'label' => 'PHP >= ' . INSTALL_MIN_PHP_VERSION,
            'ok' => version_compare(PHP_VERSION, INSTALL_MIN_PHP_VERSION, '>='),
            'detail' => 'Version detectee: ' . PHP_VERSION,
        ],
        [
            'label' => 'Extension PDO',
            'ok' => extension_loaded('pdo'),
            'detail' => extension_loaded('pdo') ? 'activee' : 'absente',
        ],
        [
            'label' => 'Driver PDO MySQL',
            'ok' => extension_loaded('pdo_mysql'),
            'detail' => extension_loaded('pdo_mysql') ? 'actif' : 'absent',
        ],
        [
            'label' => 'Driver PDO SQLite',
            'ok' => extension_loaded('pdo_sqlite'),
            'detail' => extension_loaded('pdo_sqlite') ? 'actif' : 'absent',
        ],
        [
            'label' => 'Dossier data accessible',
            'ok' => is_dir($dataDir) && is_writable($dataDir),
            'detail' => $dataDir,
        ],
        [
            'label' => 'Migrations lisibles',
            'ok' => is_dir(dirname(__DIR__) . '/server-php/migrations') && is_readable(dirname(__DIR__) . '/server-php/migrations'),
            'detail' => dirname(__DIR__) . '/server-php/migrations',
        ],
        [
            'label' => 'Etat installateur',
            'ok' => true,
            'detail' => is_file($lockPath) ? 'Verrouille apres installation' : 'Pret',
        ],
    ];
}

function install_checks_blocking(array $checks, string $driver): array
{
    $blocking = [];
    foreach ($checks as $check) {
        if ($check['label'] === 'Driver PDO MySQL' && $driver !== 'mysql') {
            continue;
        }
        if ($check['label'] === 'Driver PDO SQLite' && $driver !== 'sqlite') {
            continue;
        }
        if (!$check['ok']) {
            $blocking[] = $check['label'];
        }
    }
    return array_values(array_unique($blocking));
}

function install_effective_db_config(array $form, bool $envActive): array
{
    if ($envActive) {
        return db_config();
    }

    $local = db_local_config();
    $password = $form['mysql_password'] !== '' ? $form['mysql_password'] : (string) ($local['mysql_password'] ?? '');
    return db_normalize_config([
        'driver' => $form['db_driver'],
        'sqlite_path' => $form['sqlite_path'],
        'mysql_host' => $form['mysql_host'],
        'mysql_port' => $form['mysql_port'],
        'mysql_database' => $form['mysql_database'],
        'mysql_username' => $form['mysql_username'],
        'mysql_password' => $password,
        'mysql_charset' => $form['mysql_charset'],
    ]);
}

function install_validate(array $form, array $checks, bool $envActive): array
{
    $errors = install_checks_blocking($checks, $form['db_driver']);
    if ($form['db_driver'] === 'mysql') {
        if ($form['mysql_host'] === '' || $form['mysql_database'] === '' || $form['mysql_username'] === '') {
            $errors[] = 'Les champs MySQL host, base et utilisateur sont requis.';
        }
    }
    if ($form['db_driver'] === 'sqlite' && $form['sqlite_path'] === '') {
        $errors[] = 'Le chemin SQLite est requis.';
    }
    if ($form['support_email'] !== '' && !filter_var($form['support_email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'L email support est invalide.';
    }
    if ($form['smtp_enabled'] === '1') {
        if ($form['smtp_host'] === '' || $form['smtp_from_email'] === '') {
            $errors[] = 'SMTP actif exige au moins un host et un email expediteur.';
        }
        if (!filter_var($form['smtp_from_email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'L email expediteur SMTP est invalide.';
        }
        if ($form['smtp_port'] === '' || (int) $form['smtp_port'] < 1 || (int) $form['smtp_port'] > 65535) {
            $errors[] = 'Le port SMTP est invalide.';
        }
        if (!in_array($form['smtp_encryption'], SMTP_ENCRYPTIONS, true)) {
            $errors[] = 'Le chiffrement SMTP est invalide.';
        }
    }
    if (installation_is_locked()) {
        $errors[] = 'L application est deja installee. Supprime le dossier installation si le setup est termine.';
    }
    return array_values(array_unique($errors));
}

function install_save_mail_settings(PDO $pdo, array $form): void
{
    if ($form['support_email'] !== '') {
        setting_set($pdo, 'support_email', strtolower($form['support_email']));
    }
    setting_set($pdo, 'smtp_enabled', $form['smtp_enabled'] === '1' ? '1' : '0');
    setting_set($pdo, 'smtp_host', $form['smtp_host']);
    setting_set($pdo, 'smtp_port', (string) max(1, min(65535, (int) $form['smtp_port'])));
    setting_set($pdo, 'smtp_encryption', in_array($form['smtp_encryption'], SMTP_ENCRYPTIONS, true) ? $form['smtp_encryption'] : 'tls');
    setting_set($pdo, 'smtp_username', $form['smtp_username']);
    if ($form['smtp_password'] !== '') {
        setting_set($pdo, 'smtp_password', $form['smtp_password']);
    }
    setting_set($pdo, 'smtp_from_email', strtolower($form['smtp_from_email']));
    setting_set($pdo, 'smtp_from_name', substr($form['smtp_from_name'] !== '' ? $form['smtp_from_name'] : 'Nichoir support', 0, 120));
}

$envConfig = db_env_config();
$envActive = db_env_value('NICHOIR_DB_DRIVER') !== null
    || (
        db_env_value('NICHOIR_DB_HOST') !== null
        && db_env_value('NICHOIR_DB_NAME') !== null
        && db_env_value('NICHOIR_DB_USER') !== null
    );
$prefillConfig = $envActive ? db_config() : db_normalize_config(array_merge(db_default_config(), db_local_config()));
$form = install_base_form($prefillConfig);
if ($envActive) {
    $form['db_driver'] = (string) $prefillConfig['driver'];
}

$checks = install_system_checks();
$errors = [];
$success = false;
$successDetails = [];

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $form = install_form_from_post($form);
    if (!$envActive) {
        $form['db_driver'] = in_array($form['db_driver'], ['sqlite', 'mysql'], true) ? $form['db_driver'] : 'mysql';
    }
    if (!install_verify_csrf()) {
        $errors[] = 'Session d installation invalide. Recharge la page.';
    } else {
        $errors = install_validate($form, $checks, $envActive);
    }

    if ($errors === []) {
        $config = install_effective_db_config($form, $envActive);
        try {
            db_test_config($config, true);
            if (!$envActive) {
                db_write_local_config($config);
            }
            $pdo = db_connect_from_config($config);
            install_save_mail_settings($pdo, $form);
            installation_write_lock([
                'driver' => (string) $config['driver'],
                'details' => (string) ($config['driver'] === 'mysql'
                    ? ($config['mysql_host'] . ':' . $config['mysql_database'])
                    : $config['sqlite_path']),
            ]);
            $success = true;
            $successDetails = [
                'driver' => (string) $config['driver'],
                'config_source' => $envActive ? 'Variables serveur NICHOIR_DB_*' : 'server-php/data/db-config.php',
                'lock_path' => installation_lock_path(),
            ];
            $checks = install_system_checks();
        } catch (Throwable $e) {
            $errors[] = 'Installation interrompue: ' . $e->getMessage();
        }
    }
}

$lockData = installation_lock_data();
$csrf = install_csrf_token();
?><!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Installation Nichoir</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f3eb;
      --panel: #fffaf1;
      --line: #e6d6bc;
      --text: #2d2620;
      --muted: #6f665d;
      --brand: #c8821a;
      --brand-deep: #9f6410;
      --ok: #e8f4df;
      --ok-text: #376a22;
      --warn: #fff2d6;
      --warn-text: #8b5e00;
      --bad: #fde6e4;
      --bad-text: #9b2e2a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    main {
      max-width: 1120px;
      margin: 0 auto;
      padding: 40px 20px 80px;
    }
    .header { margin-bottom: 24px; }
    .eyebrow {
      margin: 0 0 8px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }
    h1 { margin: 0 0 8px; font-size: clamp(42px, 6vw, 72px); line-height: 0.95; }
    p { margin: 0; color: var(--muted); }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.8fr) minmax(280px, 0.9fr);
      gap: 20px;
      align-items: start;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 20px;
    }
    .panel + .panel { margin-top: 16px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .stat {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      background: #fffdf8;
    }
    .stat span {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--muted);
    }
	    .stat strong { font-size: 20px; }
	    .stat strong, .check small, code { overflow-wrap: anywhere; }
	    .notice {
	      margin-bottom: 16px;
	      padding: 14px 16px;
      border-radius: 8px;
      border: 1px solid transparent;
      font-size: 15px;
    }
    .notice ul { margin: 8px 0 0 18px; padding: 0; }
    .notice.ok { background: var(--ok); color: var(--ok-text); border-color: #cfe7c0; }
    .notice.warn { background: var(--warn); color: var(--warn-text); border-color: #efd49b; }
    .notice.bad { background: var(--bad); color: var(--bad-text); border-color: #f0c2be; }
    .checks { display: grid; gap: 10px; }
    .check {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px 14px;
      background: #fffdf8;
    }
    .check strong { display: block; margin-bottom: 4px; }
    .check small { color: var(--muted); }
    .badge {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid var(--line);
      background: #fff;
    }
    .badge.ok { color: var(--ok-text); background: var(--ok); border-color: #cfe7c0; }
    .badge.bad { color: var(--bad-text); background: var(--bad); border-color: #f0c2be; }
    form { display: grid; gap: 18px; }
    .section-block {
      display: grid;
      gap: 14px;
      padding-top: 14px;
      border-top: 1px solid var(--line);
    }
    .section-block:first-of-type {
      border-top: 0;
      padding-top: 0;
    }
    .section-heading h2, .panel h2 {
      margin: 0 0 6px;
      font-size: 24px;
    }
    .field-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    label {
      display: grid;
      gap: 6px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
    }
    label span, .choice-group legend {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--muted);
    }
	    input, select {
	      width: 100%;
	      border: 1px solid var(--line);
	      border-radius: 8px;
      padding: 12px 13px;
      font: inherit;
	      color: var(--text);
	      background: #fff;
	    }
	    input:focus-visible, select:focus-visible, button:focus-visible, .link-button:focus-visible {
	      outline: 3px solid rgba(200, 130, 26, 0.35);
	      outline-offset: 2px;
	      border-color: var(--brand);
	    }
	    input[disabled], select[disabled] {
	      background: #f1ebe1;
	      color: #8b8278;
	    }
	    [hidden] { display: none !important; }
    .choice-group {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px 14px 14px;
    }
    .choice-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 10px;
    }
    .choice-row label, .toggle {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }
    .toggle input, .choice-row input {
      width: auto;
      margin: 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }
    button, .link-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 46px;
      padding: 0 18px;
      border-radius: 8px;
      border: 1px solid var(--brand);
      background: var(--brand);
      color: #fff;
      font: inherit;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
    }
    .link-button.secondary, button.secondary {
      background: transparent;
      color: var(--brand-deep);
      border-color: var(--line);
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      background: #f3ecdf;
      padding: 2px 5px;
      border-radius: 4px;
    }
    .aside-list {
      display: grid;
      gap: 10px;
      margin-top: 16px;
    }
    .aside-list li { color: var(--muted); }
    @media (max-width: 920px) {
      .layout { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) {
      main { padding: 24px 14px 56px; }
      .field-grid { grid-template-columns: 1fr; }
      h1 { font-size: 46px; }
    }
  </style>
</head>
<body>
  <main>
    <header class="header">
      <p class="eyebrow">Installation temporaire</p>
      <h1>Nichoir</h1>
      <p>Prepare la base, ecrit la config locale si besoin, initialise le schema et verrouille l installateur. Supprime ensuite le dossier <code>installation/</code>.</p>
    </header>

    <?php if ($success): ?>
	      <div class="notice ok" role="status" aria-live="polite">
	        Installation terminee. Supprime maintenant le dossier <code>installation/</code>, puis definis <code>NICHOIR_ADMIN_PASSWORD_HASH</code> cote serveur avant d ouvrir <code>/admin</code>.
	      </div>
	    <?php elseif ($lockData !== []): ?>
	      <div class="notice warn" role="status" aria-live="polite">
	        L application est deja verrouillee depuis <?php echo install_h((string) ($lockData['installed_at'] ?? '')); ?>. Supprime le dossier <code>installation/</code> du serveur si le setup est termine.
	      </div>
	    <?php endif; ?>

	    <?php if ($errors !== []): ?>
	      <div class="notice bad" role="alert" aria-live="assertive">
	        Installation bloquee.
	        <ul>
          <?php foreach ($errors as $error): ?>
            <li><?php echo install_h($error); ?></li>
          <?php endforeach; ?>
        </ul>
      </div>
    <?php endif; ?>

    <div class="layout">
      <section>
        <section class="panel">
          <div class="section-heading">
            <h2>Checks systeme</h2>
            <p>Les points bloquants doivent etre verts avant d ecrire la configuration ou d initialiser la base.</p>
          </div>
          <div class="checks">
            <?php foreach ($checks as $check): ?>
              <div class="check">
                <div>
                  <strong><?php echo install_h((string) $check['label']); ?></strong>
                  <small><?php echo install_h((string) $check['detail']); ?></small>
                </div>
                <span class="badge <?php echo $check['ok'] ? 'ok' : 'bad'; ?>"><?php echo $check['ok'] ? 'OK' : 'A corriger'; ?></span>
              </div>
            <?php endforeach; ?>
          </div>
        </section>

        <section class="panel">
          <div class="section-heading">
            <h2>Configurer et installer</h2>
            <p>Le setup utilise MySQL cPanel ou SQLite. Les variables serveur <code>NICHOIR_DB_*</code> gardent priorite si elles sont deja actives.</p>
          </div>

          <form method="post" action="/installation/">
            <input type="hidden" name="csrf_token" value="<?php echo install_h($csrf); ?>">

            <div class="section-block">
              <fieldset class="choice-group">
                <legend>Driver base de donnees</legend>
	                <div class="choice-row" data-db-driver>
	                  <label><input type="radio" name="db_driver" value="mysql"<?php echo $form['db_driver'] === 'mysql' ? ' checked' : ''; ?><?php echo $envActive ? ' disabled' : ''; ?>> MySQL cPanel</label>
	                  <label><input type="radio" name="db_driver" value="sqlite"<?php echo $form['db_driver'] === 'sqlite' ? ' checked' : ''; ?><?php echo $envActive ? ' disabled' : ''; ?>> SQLite local</label>
	                </div>
              </fieldset>

              <?php if ($envActive): ?>
                <div class="notice warn">Les variables serveur <code>NICHOIR_DB_*</code> sont actives. Le formulaire affiche la config effective, mais le fichier local <code>server-php/data/db-config.php</code> ne pilotera pas la connexion tant que ces variables existeront.</div>
              <?php endif; ?>

	              <div class="field-grid" data-db-panel="sqlite"<?php echo $form['db_driver'] === 'sqlite' ? '' : ' hidden'; ?>>
	                <label><span>Chemin SQLite</span><input type="text" name="sqlite_path" value="<?php echo install_h($form['sqlite_path']); ?>"<?php echo $envActive ? ' disabled' : ''; ?>></label>
	              </div>

	              <div class="field-grid" data-db-panel="mysql"<?php echo $form['db_driver'] === 'mysql' ? '' : ' hidden'; ?>>
	                <label><span>Host MySQL</span><input type="text" name="mysql_host" value="<?php echo install_h($form['mysql_host']); ?>" placeholder="localhost"<?php echo $envActive ? ' disabled' : ''; ?>></label>
	                <label><span>Port MySQL</span><input type="number" name="mysql_port" min="1" max="65535" value="<?php echo install_h($form['mysql_port']); ?>"<?php echo $envActive ? ' disabled' : ''; ?>></label>
	                <label><span>Nom base</span><input type="text" name="mysql_database" value="<?php echo install_h($form['mysql_database']); ?>" placeholder="cpaneluser_nichoir"<?php echo $envActive ? ' disabled' : ''; ?>></label>
	                <label><span>Utilisateur MySQL</span><input type="text" name="mysql_username" value="<?php echo install_h($form['mysql_username']); ?>" autocomplete="username"<?php echo $envActive ? ' disabled' : ''; ?>></label>
	                <label><span>Mot de passe MySQL</span><input type="password" name="mysql_password" value="" autocomplete="new-password" placeholder="<?php echo install_h($envActive ? 'Pilote par les variables serveur' : 'Laisser vide pour conserver le mot de passe local'); ?>"<?php echo $envActive ? ' disabled' : ''; ?>></label>
	                <label><span>Charset</span><input type="text" name="mysql_charset" value="<?php echo install_h($form['mysql_charset']); ?>"<?php echo $envActive ? ' disabled' : ''; ?>></label>
	              </div>

	              <div class="field-grid">
	                <label><span>Email support</span><input type="email" name="support_email" value="<?php echo install_h($form['support_email']); ?>" placeholder="support@domaine.com"></label>
	              </div>
	            </div>

            <div class="section-block">
              <div class="section-heading">
                <h2>SMTP tickets</h2>
                <p>Optionnel. Tu peux aussi finaliser ces champs plus tard dans <code>/admin</code> &gt; <code>Reglages</code>.</p>
              </div>

	              <label class="toggle"><input type="checkbox" name="smtp_enabled" value="1"<?php echo $form['smtp_enabled'] === '1' ? ' checked' : ''; ?> data-smtp-toggle> Activer l envoi SMTP</label>

	              <div class="field-grid" data-smtp-panel<?php echo $form['smtp_enabled'] === '1' ? '' : ' hidden'; ?>>
	                <label><span>Serveur SMTP</span><input type="text" name="smtp_host" value="<?php echo install_h($form['smtp_host']); ?>" placeholder="mail.domaine.com"></label>
	                <label><span>Port SMTP</span><input type="number" name="smtp_port" min="1" max="65535" value="<?php echo install_h($form['smtp_port']); ?>"></label>
                <label><span>Chiffrement</span>
                  <select name="smtp_encryption">
                    <?php foreach (SMTP_ENCRYPTIONS as $encryption): ?>
                      <option value="<?php echo install_h($encryption); ?>"<?php echo $form['smtp_encryption'] === $encryption ? ' selected' : ''; ?>><?php echo install_h(INSTALL_SMTP_LABELS[$encryption] ?? $encryption); ?></option>
                    <?php endforeach; ?>
                  </select>
                </label>
                <label><span>Utilisateur SMTP</span><input type="text" name="smtp_username" value="<?php echo install_h($form['smtp_username']); ?>" autocomplete="username"></label>
                <label><span>Mot de passe SMTP</span><input type="password" name="smtp_password" value="" autocomplete="new-password" placeholder="Laisser vide pour ne pas modifier"></label>
                <label><span>Email expediteur</span><input type="email" name="smtp_from_email" value="<?php echo install_h($form['smtp_from_email']); ?>" placeholder="support@domaine.com"></label>
                <label><span>Nom expediteur</span><input type="text" name="smtp_from_name" value="<?php echo install_h($form['smtp_from_name']); ?>" maxlength="120"></label>
              </div>
            </div>

            <div class="actions">
              <button type="submit"<?php echo installation_is_locked() ? ' disabled' : ''; ?>>Installer l application</button>
              <a class="link-button secondary" href="/">Retour au site</a>
            </div>
          </form>
        </section>
      </section>

      <aside>
        <section class="panel">
          <h2>Sortie d installation</h2>
          <div class="stats">
            <div class="stat"><span>Driver</span><strong><?php echo install_h($successDetails['driver'] ?? ($lockData['driver'] ?? $form['db_driver'])); ?></strong></div>
            <div class="stat"><span>Config DB</span><strong><?php echo install_h($successDetails['config_source'] ?? ($envActive ? 'Variables serveur' : 'Fichier local')); ?></strong></div>
	            <div class="stat"><span>Fichier verrou</span><strong><?php echo install_h(($success || $lockData !== []) ? ($successDetails['lock_path'] ?? installation_lock_path()) : 'Sera cree ici: ' . installation_lock_path()); ?></strong></div>
	          </div>
	        </section>

        <section class="panel">
          <h2>Ne pas oublier</h2>
          <ul class="aside-list">
            <li>Definir <code>NICHOIR_ADMIN_PASSWORD_HASH</code> cote serveur avant d ouvrir <code>/admin</code>.</li>
            <li>Supprimer le dossier <code>installation/</code> des que l installation est terminee.</li>
            <li>Pointer idealement le document root vers <code>server-php/public</code>.</li>
            <li>Si le document root reste sur la racine du projet, garder le fichier <code>.htaccess</code> deploye avec l app.</li>
          </ul>
        </section>
      </aside>
	    </div>
	  </main>
	  <script>
	    const dbInputs = document.querySelectorAll('[name="db_driver"]');
	    const dbPanels = document.querySelectorAll('[data-db-panel]');
	    const updateDbPanels = () => {
	      const selected = document.querySelector('[name="db_driver"]:checked')?.value || 'mysql';
	      dbPanels.forEach((panel) => {
	        panel.hidden = panel.dataset.dbPanel !== selected;
	      });
	    };
	    dbInputs.forEach((input) => input.addEventListener('change', updateDbPanels));
	    updateDbPanels();

	    const smtpToggle = document.querySelector('[data-smtp-toggle]');
	    const smtpPanel = document.querySelector('[data-smtp-panel]');
	    const updateSmtpPanel = () => {
	      if (smtpPanel && smtpToggle) {
	        smtpPanel.hidden = !smtpToggle.checked;
	      }
	    };
	    smtpToggle?.addEventListener('change', updateSmtpPanel);
	    updateSmtpPanel();
	  </script>
	</body>
	</html>
