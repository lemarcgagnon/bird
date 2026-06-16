# PHP scripts

Utility scripts for the local/cPanel PHP backend.

## Local seed dataset

```bash
php server-php/scripts/seed_demo_dataset.php
```

The script is idempotent for the known local seed accounts: it deletes and recreates those accounts and their related test data in the active database. Locally this is usually SQLite.

Do not run it on a production database containing real customers.

Included data: active/suspended local users, subscriptions, test payments/invoices, export authorizations, credit ledger rows, open/closed tickets, support message threads and ticket email notifications.

Keep seeded account credentials out of production docs, public assets and release artifacts.
