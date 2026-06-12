<?php

declare(strict_types=1);

function db_path(): string
{
    $config = db_config();
    return (string) ($config['sqlite_path'] ?: dirname(__DIR__) . '/data/nichoir.sqlite');
}

function db_config_path(): string
{
    return dirname(__DIR__) . '/data/db-config.php';
}

function db_default_config(): array
{
    return [
        'driver' => 'sqlite',
        'sqlite_path' => dirname(__DIR__) . '/data/nichoir.sqlite',
        'mysql_host' => 'localhost',
        'mysql_port' => '3306',
        'mysql_database' => '',
        'mysql_username' => '',
        'mysql_password' => '',
        'mysql_charset' => 'utf8mb4',
    ];
}

function db_local_config(): array
{
    $path = db_config_path();
    if (!is_file($path)) {
        return [];
    }
    try {
        $config = require $path;
    } catch (Throwable) {
        return [];
    }
    return is_array($config) ? $config : [];
}

function db_env_value(string $name): ?string
{
    $value = getenv($name);
    return is_string($value) && $value !== '' ? $value : null;
}

function db_env_config(): array
{
    $map = [
        'driver' => 'NICHOIR_DB_DRIVER',
        'sqlite_path' => 'NICHOIR_SQLITE_PATH',
        'mysql_host' => 'NICHOIR_DB_HOST',
        'mysql_port' => 'NICHOIR_DB_PORT',
        'mysql_database' => 'NICHOIR_DB_NAME',
        'mysql_username' => 'NICHOIR_DB_USER',
        'mysql_password' => 'NICHOIR_DB_PASSWORD',
        'mysql_charset' => 'NICHOIR_DB_CHARSET',
    ];
    $config = [];
    foreach ($map as $key => $envName) {
        $value = db_env_value($envName);
        if ($value !== null) {
            $config[$key] = $value;
        }
    }
    return $config;
}

function db_normalize_config(array $config): array
{
    $normalized = array_merge(db_default_config(), $config);
    $normalized['driver'] = strtolower(trim((string) $normalized['driver']));
    if (!in_array($normalized['driver'], ['sqlite', 'mysql'], true)) {
        $normalized['driver'] = 'sqlite';
    }
    $normalized['sqlite_path'] = trim((string) $normalized['sqlite_path']);
    $normalized['mysql_host'] = trim((string) $normalized['mysql_host']);
    $normalized['mysql_port'] = (string) max(1, min(65535, (int) $normalized['mysql_port']));
    $normalized['mysql_database'] = trim((string) $normalized['mysql_database']);
    $normalized['mysql_username'] = trim((string) $normalized['mysql_username']);
    $normalized['mysql_password'] = (string) $normalized['mysql_password'];
    $normalized['mysql_charset'] = preg_replace('/[^a-zA-Z0-9_]/', '', (string) $normalized['mysql_charset']) ?: 'utf8mb4';
    return $normalized;
}

function db_config(bool $reload = false): array
{
    static $config = null;
    if ($config !== null && !$reload) {
        return $config;
    }
    $config = db_normalize_config(array_merge(db_default_config(), db_local_config(), db_env_config()));
    return $config;
}

function db_driver(): string
{
    return (string) db_config()['driver'];
}

function db_driver_name(PDO $pdo): string
{
    return (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
}

function db_connect_from_config(array $config): PDO
{
    $config = db_normalize_config($config);
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];

    if ($config['driver'] === 'mysql') {
        $dsn = 'mysql:host=' . $config['mysql_host']
            . ';port=' . $config['mysql_port']
            . ';dbname=' . $config['mysql_database']
            . ';charset=' . $config['mysql_charset'];
        $options[PDO::ATTR_EMULATE_PREPARES] = true;
        $pdo = new PDO($dsn, $config['mysql_username'], $config['mysql_password'], $options);
        $pdo->exec("SET time_zone = '+00:00'");
        return $pdo;
    }

    $path = $config['sqlite_path'] ?: dirname(__DIR__) . '/data/nichoir.sqlite';
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    $pdo = new PDO('sqlite:' . $path, null, null, $options);
    $pdo->exec('PRAGMA foreign_keys = ON');
    return $pdo;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $pdo = db_connect_from_config(db_config());
    return $pdo;
}

function run_migrations(): void
{
    $pdo = db();
    if (db_driver_name($pdo) === 'mysql') {
        ensure_mysql_schema($pdo);
        return;
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            migration TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    );
    $migrationFiles = glob(dirname(__DIR__) . '/migrations/*.sql') ?: [];
    sort($migrationFiles, SORT_STRING);
    foreach ($migrationFiles as $migration) {
        $name = basename($migration);
        $seen = $pdo->prepare('SELECT 1 FROM schema_migrations WHERE migration = ?');
        $seen->execute([$name]);
        if ($seen->fetchColumn()) {
            continue;
        }
        $sql = file_get_contents($migration);
        if ($sql === false) {
            throw new RuntimeException('Migration file not found: ' . $name);
        }
        $pdo->beginTransaction();
        try {
            $pdo->exec($sql);
            $pdo->prepare('INSERT INTO schema_migrations (migration) VALUES (?)')->execute([$name]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
    ensure_runtime_schema($pdo);
}

function table_has_column(PDO $pdo, string $table, string $column): bool
{
    if (db_driver_name($pdo) === 'mysql') {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
        );
        $stmt->execute([$table, $column]);
        return (int) $stmt->fetchColumn() > 0;
    }

    $stmt = $pdo->query('PRAGMA table_info(' . $table . ')');
    foreach ($stmt->fetchAll() as $row) {
        if (($row['name'] ?? '') === $column) {
            return true;
        }
    }
    return false;
}

function setting_get(PDO $pdo, string $key, string $default = ''): string
{
    $stmt = $pdo->prepare('SELECT `value` FROM app_settings WHERE `key` = ?');
    $stmt->execute([$key]);
    $value = $stmt->fetchColumn();
    return is_string($value) ? $value : $default;
}

function setting_set(PDO $pdo, string $key, string $value): void
{
    if (db_driver_name($pdo) === 'mysql') {
        $stmt = $pdo->prepare(
            'INSERT INTO app_settings (`key`, `value`, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updated_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([$key, $value]);
        return;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO app_settings (`key`, `value`, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(`key`) DO UPDATE SET `value` = excluded.`value`, updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$key, $value]);
}

function ensure_runtime_schema(PDO $pdo): void
{
    if (db_driver_name($pdo) === 'mysql') {
        ensure_mysql_schema($pdo);
        return;
    }

    if (!table_has_column($pdo, 'users', 'status')) {
        $pdo->exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
    }
    if (!table_has_column($pdo, 'users', 'email_verified_at')) {
        $pdo->exec("ALTER TABLE users ADD COLUMN email_verified_at TEXT");
    }
    if (!table_has_column($pdo, 'users', 'email_verification_code_hash')) {
        $pdo->exec("ALTER TABLE users ADD COLUMN email_verification_code_hash TEXT NOT NULL DEFAULT ''");
    }
    if (!table_has_column($pdo, 'users', 'email_verification_expires_at')) {
        $pdo->exec("ALTER TABLE users ADD COLUMN email_verification_expires_at TEXT");
    }
    if (!table_has_column($pdo, 'users', 'email_verification_sent_at')) {
        $pdo->exec("ALTER TABLE users ADD COLUMN email_verification_sent_at TEXT");
    }
    if (!table_has_column($pdo, 'users', 'stripe_customer_id')) {
        $pdo->exec("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT NOT NULL DEFAULT ''");
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            provider TEXT NOT NULL DEFAULT 'stripe',
            plan TEXT NOT NULL DEFAULT 'none',
            status TEXT NOT NULL DEFAULT 'none',
            stripe_customer_id TEXT NOT NULL DEFAULT '',
            stripe_subscription_id TEXT NOT NULL DEFAULT '',
            current_period_end TEXT,
            cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )"
    );
    if (!table_has_column($pdo, 'subscriptions', 'stripe_price_id')) {
        $pdo->exec("ALTER TABLE subscriptions ADD COLUMN stripe_price_id TEXT NOT NULL DEFAULT ''");
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            provider TEXT NOT NULL DEFAULT 'stripe',
            amount_cents INTEGER NOT NULL,
            currency TEXT NOT NULL DEFAULT 'cad',
            status TEXT NOT NULL DEFAULT 'pending',
            description TEXT NOT NULL DEFAULT '',
            stripe_checkout_session_id TEXT NOT NULL DEFAULT '',
            stripe_payment_intent_id TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )"
    );
    if (!table_has_column($pdo, 'payments', 'stripe_customer_id')) {
        $pdo->exec("ALTER TABLE payments ADD COLUMN stripe_customer_id TEXT NOT NULL DEFAULT ''");
    }
    if (!table_has_column($pdo, 'payments', 'stripe_invoice_id')) {
        $pdo->exec("ALTER TABLE payments ADD COLUMN stripe_invoice_id TEXT NOT NULL DEFAULT ''");
    }
    if (!table_has_column($pdo, 'payments', 'invoice_url')) {
        $pdo->exec("ALTER TABLE payments ADD COLUMN invoice_url TEXT NOT NULL DEFAULT ''");
    }
    if (!table_has_column($pdo, 'payments', 'invoice_pdf')) {
        $pdo->exec("ALTER TABLE payments ADD COLUMN invoice_pdf TEXT NOT NULL DEFAULT ''");
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS stripe_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'received',
            payload TEXT NOT NULL,
            error TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            processed_at TEXT
        )"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS admin_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_key_hash TEXT NOT NULL DEFAULT '',
            user_id INTEGER,
            action TEXT NOT NULL,
            delta INTEGER,
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )"
    );
    if (!table_has_column($pdo, 'tickets', 'priority')) {
        $pdo->exec("ALTER TABLE tickets ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'");
    }
    if (!table_has_column($pdo, 'tickets', 'assigned_to')) {
        $pdo->exec("ALTER TABLE tickets ADD COLUMN assigned_to TEXT NOT NULL DEFAULT ''");
    }
    if (!table_has_column($pdo, 'tickets', 'closed_at')) {
        $pdo->exec("ALTER TABLE tickets ADD COLUMN closed_at TEXT");
    }
    if (!table_has_column($pdo, 'ticket_messages', 'author_role')) {
        $pdo->exec("ALTER TABLE ticket_messages ADD COLUMN author_role TEXT NOT NULL DEFAULT 'client'");
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS ticket_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            channel TEXT NOT NULL DEFAULT 'email',
            recipient TEXT NOT NULL,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            error TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sent_at TEXT,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )"
    );
    if (!table_has_column($pdo, 'ticket_notifications', 'error')) {
        $pdo->exec("ALTER TABLE ticket_notifications ADD COLUMN error TEXT NOT NULL DEFAULT ''");
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    );
}

function mysql_add_column_if_missing(PDO $pdo, string $table, string $column, string $definition): void
{
    if (!table_has_column($pdo, $table, $column)) {
        $pdo->exec('ALTER TABLE `' . $table . '` ADD COLUMN ' . $definition);
    }
}

function ensure_mysql_schema(PDO $pdo): void
{
    $tableOptions = ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    $pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (
        migration VARCHAR(191) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )' . $tableOptions);
    $pdo->exec('CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(254) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(120) NOT NULL DEFAULT \'\',
        credits INT NOT NULL DEFAULT 10,
        subscription_status VARCHAR(32) NOT NULL DEFAULT \'none\',
        status VARCHAR(32) NOT NULL DEFAULT \'active\',
        email_verified_at DATETIME NULL,
        email_verification_code_hash VARCHAR(128) NOT NULL DEFAULT \'\',
        email_verification_expires_at DATETIME NULL,
        email_verification_sent_at DATETIME NULL,
        stripe_customer_id VARCHAR(255) NOT NULL DEFAULT \'\',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )' . $tableOptions);
    $pdo->exec('CREATE TABLE IF NOT EXISTS sessions (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        token_hash VARCHAR(128) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )' . $tableOptions);
    $pdo->exec('CREATE TABLE IF NOT EXISTS export_authorizations (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        export_type VARCHAR(32) NOT NULL,
        credit_cost INT NOT NULL,
        auth_token_hash VARCHAR(128) NOT NULL UNIQUE,
        status VARCHAR(32) NOT NULL DEFAULT \'authorized\',
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        consumed_at DATETIME NULL,
        CONSTRAINT fk_export_authorizations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )' . $tableOptions);
    $pdo->exec('CREATE TABLE IF NOT EXISTS credit_ledger (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        delta INT NOT NULL,
        reason VARCHAR(120) NOT NULL,
        reference VARCHAR(255) NOT NULL DEFAULT \'\',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_credit_ledger_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )' . $tableOptions);
    $pdo->exec('CREATE TABLE IF NOT EXISTS subscriptions (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        provider VARCHAR(32) NOT NULL DEFAULT \'stripe\',
        plan VARCHAR(32) NOT NULL DEFAULT \'none\',
        status VARCHAR(32) NOT NULL DEFAULT \'none\',
        stripe_customer_id VARCHAR(255) NOT NULL DEFAULT \'\',
        stripe_subscription_id VARCHAR(255) NOT NULL DEFAULT \'\',
        stripe_price_id VARCHAR(255) NOT NULL DEFAULT \'\',
        current_period_end DATE NULL,
        cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )' . $tableOptions);
    $pdo->exec('CREATE TABLE IF NOT EXISTS payments (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        provider VARCHAR(32) NOT NULL DEFAULT \'stripe\',
        amount_cents INT NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT \'cad\',
        status VARCHAR(32) NOT NULL DEFAULT \'pending\',
        description VARCHAR(255) NOT NULL DEFAULT \'\',
        stripe_customer_id VARCHAR(255) NOT NULL DEFAULT \'\',
        stripe_checkout_session_id VARCHAR(255) NOT NULL DEFAULT \'\',
        stripe_payment_intent_id VARCHAR(255) NOT NULL DEFAULT \'\',
        stripe_invoice_id VARCHAR(255) NOT NULL DEFAULT \'\',
        invoice_url VARCHAR(2048) NOT NULL DEFAULT \'\',
        invoice_pdf VARCHAR(2048) NOT NULL DEFAULT \'\',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )' . $tableOptions);
    $pdo->exec('CREATE TABLE IF NOT EXISTS stripe_events (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL UNIQUE,
        type VARCHAR(120) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT \'received\',
        payload MEDIUMTEXT NOT NULL,
        error VARCHAR(500) NOT NULL DEFAULT \'\',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME NULL
    )' . $tableOptions);
    $pdo->exec('CREATE TABLE IF NOT EXISTS tickets (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        subject VARCHAR(140) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT \'open\',
        priority VARCHAR(32) NOT NULL DEFAULT \'normal\',
        assigned_to VARCHAR(120) NOT NULL DEFAULT \'\',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME NULL,
        CONSTRAINT fk_tickets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )' . $tableOptions);
    $pdo->exec('CREATE TABLE IF NOT EXISTS ticket_messages (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        author_role VARCHAR(32) NOT NULL DEFAULT \'client\',
        body TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_ticket_messages_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        CONSTRAINT fk_ticket_messages_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )' . $tableOptions);
    $pdo->exec('CREATE TABLE IF NOT EXISTS ticket_notifications (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        channel VARCHAR(32) NOT NULL DEFAULT \'email\',
        recipient VARCHAR(254) NOT NULL,
        subject VARCHAR(180) NOT NULL,
        body TEXT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT \'pending\',
        error VARCHAR(500) NOT NULL DEFAULT \'\',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sent_at DATETIME NULL,
        CONSTRAINT fk_ticket_notifications_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        CONSTRAINT fk_ticket_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )' . $tableOptions);
    $pdo->exec('CREATE TABLE IF NOT EXISTS app_settings (
        `key` VARCHAR(120) PRIMARY KEY,
        `value` MEDIUMTEXT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )' . $tableOptions);
    $pdo->exec('CREATE TABLE IF NOT EXISTS admin_audit_log (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        admin_key_hash VARCHAR(128) NOT NULL DEFAULT \'\',
        user_id INT UNSIGNED NULL,
        action VARCHAR(120) NOT NULL,
        delta INT NULL,
        note TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_admin_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )' . $tableOptions);

    mysql_add_column_if_missing($pdo, 'users', 'status', 'status VARCHAR(32) NOT NULL DEFAULT \'active\'');
    mysql_add_column_if_missing($pdo, 'users', 'email_verified_at', 'email_verified_at DATETIME NULL');
    mysql_add_column_if_missing($pdo, 'users', 'email_verification_code_hash', 'email_verification_code_hash VARCHAR(128) NOT NULL DEFAULT \'\'');
    mysql_add_column_if_missing($pdo, 'users', 'email_verification_expires_at', 'email_verification_expires_at DATETIME NULL');
    mysql_add_column_if_missing($pdo, 'users', 'email_verification_sent_at', 'email_verification_sent_at DATETIME NULL');
    mysql_add_column_if_missing($pdo, 'users', 'stripe_customer_id', 'stripe_customer_id VARCHAR(255) NOT NULL DEFAULT \'\'');
    mysql_add_column_if_missing($pdo, 'subscriptions', 'stripe_price_id', 'stripe_price_id VARCHAR(255) NOT NULL DEFAULT \'\'');
    mysql_add_column_if_missing($pdo, 'payments', 'stripe_customer_id', 'stripe_customer_id VARCHAR(255) NOT NULL DEFAULT \'\'');
    mysql_add_column_if_missing($pdo, 'payments', 'stripe_invoice_id', 'stripe_invoice_id VARCHAR(255) NOT NULL DEFAULT \'\'');
    mysql_add_column_if_missing($pdo, 'payments', 'invoice_url', 'invoice_url VARCHAR(2048) NOT NULL DEFAULT \'\'');
    mysql_add_column_if_missing($pdo, 'payments', 'invoice_pdf', 'invoice_pdf VARCHAR(2048) NOT NULL DEFAULT \'\'');
    mysql_add_column_if_missing($pdo, 'stripe_events', 'error', 'error VARCHAR(500) NOT NULL DEFAULT \'\'');
    mysql_add_column_if_missing($pdo, 'tickets', 'priority', 'priority VARCHAR(32) NOT NULL DEFAULT \'normal\'');
    mysql_add_column_if_missing($pdo, 'tickets', 'assigned_to', 'assigned_to VARCHAR(120) NOT NULL DEFAULT \'\'');
    mysql_add_column_if_missing($pdo, 'tickets', 'closed_at', 'closed_at DATETIME NULL');
    mysql_add_column_if_missing($pdo, 'ticket_messages', 'author_role', 'author_role VARCHAR(32) NOT NULL DEFAULT \'client\'');
    mysql_add_column_if_missing($pdo, 'ticket_notifications', 'error', 'error VARCHAR(500) NOT NULL DEFAULT \'\'');
}

function db_test_config(array $config, bool $initialize = false): void
{
    $pdo = db_connect_from_config($config);
    if ($initialize && db_driver_name($pdo) === 'mysql') {
        ensure_mysql_schema($pdo);
    }
    $pdo->query('SELECT 1')->fetchColumn();
}

function db_write_local_config(array $config): void
{
    $config = db_normalize_config($config);
    $path = db_config_path();
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    $payload = "<?php\n\nreturn " . var_export($config, true) . ";\n";
    if (file_put_contents($path, $payload, LOCK_EX) === false) {
        throw new RuntimeException('Unable to write database config.');
    }
    @chmod($path, 0600);
    db_config(true);
}
