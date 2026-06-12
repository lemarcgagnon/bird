<?php

declare(strict_types=1);

function db_path(): string
{
    return dirname(__DIR__) . '/data/nichoir.sqlite';
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $pdo = new PDO('sqlite:' . db_path(), null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    return $pdo;
}

function run_migrations(): void
{
    $pdo = db();
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
    $stmt = $pdo->query('PRAGMA table_info(' . $table . ')');
    foreach ($stmt->fetchAll() as $row) {
        if (($row['name'] ?? '') === $column) {
            return true;
        }
    }
    return false;
}

function ensure_runtime_schema(PDO $pdo): void
{
    if (!table_has_column($pdo, 'users', 'status')) {
        $pdo->exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
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
