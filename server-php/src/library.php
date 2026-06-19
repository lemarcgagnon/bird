<?php

declare(strict_types=1);

require_once __DIR__ . '/credits.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/logger.php';
require_once __DIR__ . '/auth.php';

const LIBRARY_MAX_STL_BYTES = 4194304;
const LIBRARY_MAX_IMAGE_BYTES = 2097152;
const LIBRARY_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const LIBRARY_STL_PREVIEW_MAX_TRIANGLES = 700;

function library_ini_upload_limit_label(): string
{
    return 'upload_max_filesize=' . (string) ini_get('upload_max_filesize') . ', post_max_size=' . (string) ini_get('post_max_size');
}

function library_upload_error_message(int $error): string
{
    return match ($error) {
        UPLOAD_ERR_INI_SIZE => 'upload_exceeds_php_upload_max_filesize:' . library_ini_upload_limit_label(),
        UPLOAD_ERR_FORM_SIZE => 'upload_exceeds_form_limit',
        UPLOAD_ERR_PARTIAL => 'upload_partial',
        UPLOAD_ERR_NO_FILE => 'upload_no_file',
        UPLOAD_ERR_NO_TMP_DIR => 'upload_missing_tmp_dir',
        UPLOAD_ERR_CANT_WRITE => 'upload_cannot_write_tmp',
        UPLOAD_ERR_EXTENSION => 'upload_blocked_by_php_extension',
        default => 'upload_failed:error=' . $error,
    };
}

function library_storage_dir(): string
{
    return rtrim(app_config_value('NICHOIR_LIBRARY_DIR', dirname(__DIR__) . '/data/library'), '/');
}

function library_ensure_storage_dir(): void
{
    $dir = library_storage_dir();
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('library_storage_unavailable');
    }
}

function library_item_path(array $item): string
{
    $filename = (string) ($item['filename'] ?? '');
    if (!preg_match('/^[a-zA-Z0-9_.-]+$/', $filename)) {
        throw new RuntimeException('invalid_library_filename');
    }
    return library_storage_dir() . '/' . $filename;
}

function library_public_item(array $item): array
{
    return [
        'id' => (int) $item['id'],
        'title' => (string) $item['title'],
        'original_filename' => (string) $item['original_filename'],
        'media_type' => (string) $item['media_type'],
        'file_ext' => (string) $item['file_ext'],
        'file_size_bytes' => (int) $item['file_size_bytes'],
        'cost' => (int) $item['cost'],
        'download_count' => (int) $item['download_count'],
        'created_at' => (string) $item['created_at'],
    ];
}

function library_is_image_item(array $item): bool
{
    return (string) ($item['media_type'] ?? '') === 'image';
}

function library_is_stl_item(array $item): bool
{
    return (string) ($item['media_type'] ?? '') === 'stl' || strtolower((string) ($item['file_ext'] ?? '')) === 'stl';
}

function library_normalize_upload_files(array $files): array
{
    if (!isset($files['name'])) {
        return [];
    }
    if (!is_array($files['name'])) {
        return [$files];
    }

    $normalized = [];
    foreach ($files['name'] as $index => $name) {
        $normalized[] = [
            'name' => $name,
            'type' => $files['type'][$index] ?? '',
            'tmp_name' => $files['tmp_name'][$index] ?? '',
            'error' => $files['error'][$index] ?? UPLOAD_ERR_NO_FILE,
            'size' => $files['size'][$index] ?? 0,
        ];
    }
    return $normalized;
}

function library_file_kind(string $original, string $tmpName, int $size): array
{
    $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
    if ($ext === 'stl') {
        if ($size <= 84 || $size > LIBRARY_MAX_STL_BYTES) {
            throw new RuntimeException('invalid_library_stl');
        }
        return ['media_type' => 'stl', 'mime_type' => 'model/stl', 'file_ext' => 'stl'];
    }

    if (in_array($ext, LIBRARY_IMAGE_EXTENSIONS, true)) {
        if ($size <= 0 || $size > LIBRARY_MAX_IMAGE_BYTES) {
            throw new RuntimeException('invalid_library_image');
        }
        $info = @getimagesize($tmpName);
        if (!is_array($info)) {
            throw new RuntimeException('invalid_library_image');
        }
        $mime = (string) ($info['mime'] ?? '');
        $allowedMime = [
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
        ][$ext] ?? '';
        if ($mime !== $allowedMime) {
            throw new RuntimeException('invalid_library_image');
        }
        return ['media_type' => 'image', 'mime_type' => $mime, 'file_ext' => $ext];
    }

    throw new RuntimeException('invalid_library_file_type');
}

function library_list_items(PDO $pdo, bool $activeOnly = true): array
{
    $sql = 'SELECT * FROM library_items';
    if ($activeOnly) {
        $sql .= ' WHERE is_active = 1';
    }
    $sql .= ' ORDER BY updated_at DESC, id DESC';
    return $pdo->query($sql)->fetchAll();
}

function library_find_item(PDO $pdo, int $itemId, bool $activeOnly = true): ?array
{
    $sql = 'SELECT * FROM library_items WHERE id = ?';
    if ($activeOnly) {
        $sql .= ' AND is_active = 1';
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$itemId]);
    $item = $stmt->fetch();
    return is_array($item) ? $item : null;
}

function library_clean_title(string $title, string $fallback): string
{
    $title = trim($title);
    if ($title === '') {
        $title = preg_replace('/\.[^.]+$/', '', $fallback) ?: $fallback;
    }
    return substr($title, 0, 140);
}

function library_admin_upload(PDO $pdo, array $file, string $title, int $cost, bool $active): int
{
    $uploadError = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($uploadError !== UPLOAD_ERR_OK) {
        throw new RuntimeException(library_upload_error_message($uploadError));
    }
    $original = basename((string) ($file['name'] ?? 'decor.stl'));
    $size = (int) ($file['size'] ?? 0);
    $tmpName = (string) ($file['tmp_name'] ?? '');
    if ($tmpName === '' || !is_uploaded_file($tmpName)) {
        throw new RuntimeException('invalid_library_upload');
    }
    $kind = library_file_kind($original, $tmpName, $size);

    library_ensure_storage_dir();
    $stored = 'library_' . bin2hex(random_bytes(16)) . '.' . $kind['file_ext'];
    $target = library_storage_dir() . '/' . $stored;
    if (!move_uploaded_file($tmpName, $target)) {
        throw new RuntimeException('library_store_failed');
    }
    @chmod($target, 0664);

    $stmt = $pdo->prepare(
        'INSERT INTO library_items (filename, original_filename, title, media_type, mime_type, file_ext, file_size_bytes, cost, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $stored,
        substr($original, 0, 190),
        library_clean_title($title, $original),
        $kind['media_type'],
        $kind['mime_type'],
        $kind['file_ext'],
        $size,
        max(1, $cost),
        $active ? 1 : 0,
    ]);
    return (int) $pdo->lastInsertId();
}

function library_admin_upload_many(PDO $pdo, array $files, string $title, int $cost, bool $active): array
{
    $uploaded = [];
    $failed = [];
    foreach (library_normalize_upload_files($files) as $file) {
        try {
            $uploaded[] = library_admin_upload($pdo, $file, $title, $cost, $active);
        } catch (Throwable $e) {
            $failed[] = [
                'name' => (string) ($file['name'] ?? ''),
                'error' => $e->getMessage(),
            ];
        }
    }
    return ['uploaded' => $uploaded, 'failed' => $failed];
}

function library_admin_update(PDO $pdo, int $itemId, string $title, int $cost, bool $active): void
{
    $item = library_find_item($pdo, $itemId, false);
    if ($item === null) {
        throw new RuntimeException('library_item_not_found');
    }
    $stmt = $pdo->prepare('UPDATE library_items SET title = ?, cost = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $stmt->execute([library_clean_title($title, (string) $item['original_filename']), max(1, $cost), $active ? 1 : 0, $itemId]);
}

function library_create_authorization(PDO $pdo, array $user, array $item): array
{
    $cost = max(1, (int) $item['cost']);
    if ((string) ($user['status'] ?? 'active') !== 'active') {
        return ['ok' => false, 'error' => 'account_suspended', 'status' => 403];
    }
    if ((int) $user['credits'] < $cost) {
        return ['ok' => false, 'error' => 'insufficient_credits', 'credits' => (int) $user['credits'], 'cost' => $cost, 'status' => 402];
    }
    $authToken = random_token();
    $expires = sql_utc_datetime('+10 minutes');
    $stmt = $pdo->prepare(
        'INSERT INTO library_download_authorizations (user_id, library_item_id, credit_cost, auth_token_hash, expires_at, ip_hash, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        (int) $user['id'],
        (int) $item['id'],
        $cost,
        token_hash($authToken),
        $expires,
        function_exists('log_client_ip_hash') ? (log_client_ip_hash() ?? '') : '',
        substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
    ]);

    return [
        'ok' => true,
        'authorization' => $authToken,
        'item_id' => (int) $item['id'],
        'cost' => $cost,
        'expires_at' => $expires,
    ];
}

function library_create_admin_authorization(array $item): array
{
    app_secure_session_start();
    $authToken = random_token();
    $expires = sql_utc_datetime('+10 minutes');
    if (!isset($_SESSION['nichoir_admin_library_authorizations']) || !is_array($_SESSION['nichoir_admin_library_authorizations'])) {
        $_SESSION['nichoir_admin_library_authorizations'] = [];
    }
    $_SESSION['nichoir_admin_library_authorizations'][token_hash($authToken)] = [
        'item_id' => (int) $item['id'],
        'expires_at' => $expires,
    ];
    return [
        'ok' => true,
        'admin' => true,
        'authorization' => $authToken,
        'item_id' => (int) $item['id'],
        'cost' => 0,
        'expires_at' => $expires,
    ];
}

function library_authorization_download_url(array $authorization): string
{
    return '/api/library/download?item_id=' . (int) $authorization['item_id']
        . '&authorization=' . rawurlencode((string) $authorization['authorization']);
}

function library_stl_vertices_from_binary(string $bytes): array
{
    if (strlen($bytes) < 84) {
        throw new RuntimeException('invalid_stl_preview');
    }
    $triCount = unpack('V', substr($bytes, 80, 4))[1] ?? 0;
    $expected = 84 + ((int) $triCount * 50);
    if ($triCount <= 0 || $expected > strlen($bytes)) {
        throw new RuntimeException('invalid_stl_preview');
    }
    $step = max(1, (int) ceil($triCount / LIBRARY_STL_PREVIEW_MAX_TRIANGLES));
    $triangles = [];
    for ($i = 0; $i < $triCount; $i += $step) {
        $offset = 84 + ($i * 50) + 12;
        $tri = [];
        for ($v = 0; $v < 3; $v++) {
            $coords = unpack('gx/gy/gz', substr($bytes, $offset + ($v * 12), 12));
            $tri[] = [
                (float) ($coords['x'] ?? 0.0),
                (float) ($coords['y'] ?? 0.0),
                (float) ($coords['z'] ?? 0.0),
            ];
        }
        $triangles[] = $tri;
    }
    return $triangles;
}

function library_stl_vertices_from_ascii(string $bytes): array
{
    preg_match_all('/vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/', $bytes, $matches, PREG_SET_ORDER);
    if (count($matches) < 3) {
        throw new RuntimeException('invalid_stl_preview');
    }
    $triCount = intdiv(count($matches), 3);
    $step = max(1, (int) ceil($triCount / LIBRARY_STL_PREVIEW_MAX_TRIANGLES));
    $triangles = [];
    for ($i = 0; $i < $triCount; $i += $step) {
        $tri = [];
        for ($v = 0; $v < 3; $v++) {
            $row = $matches[($i * 3) + $v] ?? null;
            if ($row === null) {
                continue 2;
            }
            $tri[] = [(float) $row[1], (float) $row[2], (float) $row[3]];
        }
        $triangles[] = $tri;
    }
    return $triangles;
}

function library_project_stl_preview(array $triangles): array
{
    $min = [INF, INF, INF];
    $max = [-INF, -INF, -INF];
    foreach ($triangles as $tri) {
        foreach ($tri as $p) {
            for ($i = 0; $i < 3; $i++) {
                $min[$i] = min($min[$i], (float) $p[$i]);
                $max[$i] = max($max[$i], (float) $p[$i]);
            }
        }
    }
    $center = [
        ($min[0] + $max[0]) / 2.0,
        ($min[1] + $max[1]) / 2.0,
        ($min[2] + $max[2]) / 2.0,
    ];
    $scale = max($max[0] - $min[0], $max[1] - $min[1], $max[2] - $min[2], 1.0);
    $projected = [];
    foreach ($triangles as $tri) {
        $out = [];
        foreach ($tri as $p) {
            $x = ((float) $p[0] - $center[0]) / $scale;
            $y = ((float) $p[1] - $center[1]) / $scale;
            $z = ((float) $p[2] - $center[2]) / $scale;
            $out[] = [
                round(($x - $y) * 0.72, 5),
                round((($x + $y) * 0.36) - ($z * 0.78), 5),
            ];
        }
        $projected[] = $out;
    }
    return [
        'bbox' => [
            'min' => [round($min[0], 5), round($min[1], 5), round($min[2], 5)],
            'max' => [round($max[0], 5), round($max[1], 5), round($max[2], 5)],
        ],
        'triangles' => $projected,
    ];
}

function library_stl_preview_payload(array $item): array
{
    if (!library_is_stl_item($item)) {
        throw new RuntimeException('not_stl_preview');
    }
    $path = library_item_path($item);
    $bytes = is_file($path) ? file_get_contents($path) : false;
    if (!is_string($bytes) || $bytes === '') {
        throw new RuntimeException('library_file_missing');
    }
    $looksAscii = str_starts_with(ltrim(substr($bytes, 0, 256)), 'solid') && preg_match('/\bvertex\b/', substr($bytes, 0, 4096));
    $triangles = $looksAscii ? library_stl_vertices_from_ascii($bytes) : library_stl_vertices_from_binary($bytes);
    $preview = library_project_stl_preview($triangles);
    return [
        'ok' => true,
        'item' => library_public_item($item),
        'sampled_triangles' => count($preview['triangles']),
        'bbox' => $preview['bbox'],
        'triangles' => $preview['triangles'],
    ];
}
