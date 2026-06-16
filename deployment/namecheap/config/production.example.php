<?php

declare(strict_types=1);

return [
    'NICHOIR_PUBLIC_BASE_URL' => 'https://example.com',
    'NICHOIR_ADMIN_PASSWORD_HASH' => 'replace-with-password_hash-output',
    'NICHOIR_DB_DRIVER' => 'mysql',
    'NICHOIR_MYSQL_HOST' => 'localhost',
    'NICHOIR_MYSQL_PORT' => '3306',
    'NICHOIR_MYSQL_DATABASE' => 'cpaneluser_nichoir',
    'NICHOIR_MYSQL_USERNAME' => 'cpaneluser_dbuser',
    'NICHOIR_MYSQL_PASSWORD' => 'replace-with-private-password',
    'NICHOIR_MYSQL_CHARSET' => 'utf8mb4',
    'NICHOIR_CORS_ORIGINS' => 'https://example.com',
    'NICHOIR_LOG_HASH_SALT' => 'replace-with-random-secret',
    'NICHOIR_STRIPE_SECRET_KEY' => '',
    'NICHOIR_STRIPE_WEBHOOK_SECRET' => '',
    'NICHOIR_SMTP_PASSWORD' => '',
    'NICHOIR_SUPPORT_EMAIL' => 'support@example.com',
    'NICHOIR_DEBUG' => '0',
    'NICHOIR_ALLOW_UNSIGNED_STRIPE_WEBHOOKS' => '0',
];
