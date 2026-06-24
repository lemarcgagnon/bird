# PHP migrations

Role: versioned schema files for the PHP backend.

## Files

- `001_init.sql`: SQLite baseline schema for users, sessions, credits, product-code export authorizations/entitlements, tickets, ticket messages, ticket notifications, app settings, subscriptions, payments, Stripe events, library items/downloads and admin audit data.
- `002_library.sql`: SQLite schema for private STL/image library items, including descriptions and file metadata, short-lived download authorizations and completed library download records.
- `003_library_archive.sql`: adds `deleted_at` so library files can be archived without erasing accounting/download history.

## Runtime behavior

- For SQLite, `run_migrations()` applies `*.sql` files alphabetically and records applied names in `schema_migrations`.
- After SQLite migrations, `ensure_runtime_schema()` adds compatibility columns/tables that were introduced after the baseline.
- For MySQL, `run_migrations_for_pdo()` calls `ensure_mysql_schema()` in `src/db.php`; it does not execute the SQLite SQL files directly.

## Rules

- Add a new numbered migration for schema changes that should be versioned.
- Do not rewrite an already-applied migration unless there is an explicit reset/migration decision.
- Keep constraints and indexes close to the schema definition.
- Never version `server-php/data/nichoir.sqlite`, dumps or production DB configs.
- Prefer `NICHOIR_SMTP_PASSWORD`, `NICHOIR_STRIPE_SECRET_KEY`, `NICHOIR_STRIPE_WEBHOOK_SECRET` or private `config/production.php` for secrets.
