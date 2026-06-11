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
}
