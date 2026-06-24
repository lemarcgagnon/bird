# Temporary installer

Role: one-time web installer for server setup. Use it during setup, then remove the entire `installation/` directory from the deployed server.

## File

- `index.php`: installer UI for database config, schema initialization, optional support email/SMTP settings and install lock creation.

## What it does

- Starts a secure-ish PHP session with Lax, HTTP-only cookies.
- Uses a CSRF token for installer POST.
- Checks PHP version, PDO, PDO MySQL, PDO SQLite, `server-php/data` writability and migration readability.
- Accepts MySQL/cPanel config or local SQLite config unless DB env/private config is already active. SQLite is for local/development setup only.
- Writes `server-php/data/db-config.php` when the database is not controlled by env/private config.
- Tests the DB config and initializes schema through the same app code path (`run_migrations_for_pdo()` / MySQL schema setup).
- Can save support email and basic SMTP settings.
- Leaves library upload limits and storage paths to the admin settings panel after installation.
- Writes `server-php/data/installed.lock.php` to block a second installation.

## Rules

- Delete `installation/` after setup.
- Define `NICHOIR_ADMIN_PATH` and `NICHOIR_ADMIN_PASSWORD_HASH` before opening the back-office. The default admin path is `/gestion-nichoir`; do not use `/admin` or `/administration`.
- Prefer the cPanel artifact layout from `deployment/namecheap/README.md`, where `installation/` is never copied to `public_html`.
- In the validated Namecheap artifact, production starts as `NICHOIR_ENV=production`, requires MySQL/MariaDB and fails closed without private config.
- If a whole-repo/root deployment is used temporarily, keep the root `.htaccess` rules and remove/block `installation/` after setup.
- Do not commit or expose `server-php/data/db-config.php` or `server-php/data/installed.lock.php`.

## Current limits

- No active SMTP send test in the installer; it only records initial settings.
- No multi-step wizard or complex form resume.
- No admin account creation; admin login uses `NICHOIR_ADMIN_PASSWORD_HASH` and a PHP session.
- No production hardening by itself. Production still needs private config, MySQL/MariaDB, CORS/public base URL, log hash salt, real SMTP settings if email is enabled, Stripe secrets if enabled, and disabled debug/unsigned webhooks.
