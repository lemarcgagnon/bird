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
    $migration = dirname(__DIR__) . '/migrations/001_init.sql';
    $sql = file_get_contents($migration);
    if ($sql === false) {
        throw new RuntimeException('Migration file not found');
    }
    $pdo->exec($sql);
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
}
