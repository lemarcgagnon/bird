<?php

declare(strict_types=1);

require_once __DIR__ . '/credits.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/logger.php';
require_once __DIR__ . '/auth.php';

const LIBRARY_DEFAULT_MAX_STL_MB = 25;
const LIBRARY_MAX_STL_MB = 1024;
const LIBRARY_DEFAULT_MAX_IMAGE_MB = 2;
const LIBRARY_MAX_IMAGE_MB = 512;
const LIBRARY_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const LIBRARY_STL_PREVIEW_MAX_TRIANGLES = 700;
const LIBRARY_STL_PREVIEW_HIGH_MAX_TRIANGLES = 12000;
const LIBRARY_STL_THUMBNAIL_MAX_TRIANGLES = 24000;

function library_stl_upload_max_mb(PDO $pdo): int
{
    return max(1, min(LIBRARY_MAX_STL_MB, (int) setting_get($pdo, 'library_stl_upload_max_mb', (string) LIBRARY_DEFAULT_MAX_STL_MB)));
}

function library_stl_upload_max_bytes(PDO $pdo): int
{
    return library_stl_upload_max_mb($pdo) * 1024 * 1024;
}

function library_image_upload_max_mb(PDO $pdo): int
{
    return max(1, min(LIBRARY_MAX_IMAGE_MB, (int) setting_get($pdo, 'library_image_upload_max_mb', (string) LIBRARY_DEFAULT_MAX_IMAGE_MB)));
}

function library_image_upload_max_bytes(PDO $pdo): int
{
    return library_image_upload_max_mb($pdo) * 1024 * 1024;
}

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
    $env = trim(app_config_value('NICHOIR_LIBRARY_DIR', ''));
    if ($env !== '') {
        return rtrim($env, '/');
    }
    try {
        $configured = trim(setting_get(db(), 'library_storage_dir', ''));
        if ($configured !== '') {
            return rtrim($configured, '/');
        }
    } catch (Throwable) {
        // Fall back during early bootstrap or database repair.
    }
    return dirname(__DIR__) . '/data/library';
}

function library_app_image_dir(): string
{
    $env = trim(app_config_value('NICHOIR_LIBRARY_APP_IMAGE_DIR', ''));
    if ($env !== '') {
        return rtrim($env, '/');
    }
    try {
        $configured = trim(setting_get(db(), 'library_app_image_dir', ''));
        if ($configured !== '') {
            return rtrim($configured, '/');
        }
    } catch (Throwable) {
        // Fall back during early bootstrap or database repair.
    }
    return dirname(__DIR__, 2) . '/app/images/library';
}

function library_admin_config_path(string $value, string $fallback): string
{
    $path = trim($value);
    if ($path === '') {
        $path = $fallback;
    }
    if (str_contains($path, "\0") || strlen($path) > 500) {
        throw new RuntimeException('invalid_library_path');
    }
    return rtrim($path, '/');
}

function library_ensure_storage_dir(): void
{
    $dir = library_storage_dir();
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('library_storage_unavailable');
    }
}

function library_ensure_app_image_dir(): void
{
    $dir = library_app_image_dir();
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('library_app_image_dir_unavailable');
    }
}

function library_safe_filename(string $filename): string
{
    if (!preg_match('/^[a-zA-Z0-9_.-]+$/', $filename)) {
        throw new RuntimeException('invalid_library_filename');
    }
    return $filename;
}

function library_item_path(array $item): string
{
    $filename = library_safe_filename((string) ($item['filename'] ?? ''));
    return library_storage_dir() . '/' . $filename;
}

function library_thumbnail_path(array $item): string
{
    $filename = library_safe_filename((string) ($item['filename'] ?? ''));
    return library_storage_dir() . '/' . preg_replace('/\.[^.]+$/', '', $filename) . '.preview.png';
}

function library_app_image_path(string $filename): string
{
    return library_app_image_dir() . '/' . library_safe_filename($filename);
}

function library_app_image_thumbnail_filename(array $item): string
{
    $filename = library_safe_filename((string) ($item['filename'] ?? ''));
    return preg_replace('/\.[^.]+$/', '', $filename) . '.preview.png';
}

function library_copy_to_app_image_folder(string $sourcePath, string $filename): void
{
    if (!is_file($sourcePath) || !is_readable($sourcePath)) {
        throw new RuntimeException('library_source_file_missing');
    }
    library_ensure_app_image_dir();
    $target = library_app_image_path($filename);
    if (!copy($sourcePath, $target)) {
        throw new RuntimeException('library_app_image_copy_failed');
    }
    @chmod($target, 0664);
}

function library_mirror_item_to_app_images(array $item): void
{
    library_copy_to_app_image_folder(library_item_path($item), (string) $item['filename']);
}

function library_mirror_thumbnail_to_app_images(array $item): void
{
    library_copy_to_app_image_folder(library_thumbnail_path($item), library_app_image_thumbnail_filename($item));
}

function library_delete_app_image_assets(array $item): void
{
    $filename = (string) ($item['filename'] ?? '');
    if ($filename !== '') {
        $path = library_app_image_path($filename);
        if (is_file($path)) {
            @unlink($path);
        }
    }
    $thumbnail = library_app_image_path(library_app_image_thumbnail_filename($item));
    if (is_file($thumbnail)) {
        @unlink($thumbnail);
    }
}

function library_public_item(array $item): array
{
    $public = [
        'id' => (int) $item['id'],
        'title' => (string) $item['title'],
        'description' => (string) ($item['description'] ?? ''),
        'original_filename' => (string) $item['original_filename'],
        'media_type' => (string) $item['media_type'],
        'file_ext' => (string) $item['file_ext'],
        'file_size_bytes' => (int) $item['file_size_bytes'],
        'cost' => (int) $item['cost'],
        'download_count' => (int) $item['download_count'],
        'created_at' => (string) $item['created_at'],
        'thumbnail_url' => '/api/library/thumbnail?item_id=' . (int) $item['id'] . '&v=' . rawurlencode((string) ($item['updated_at'] ?? $item['created_at'] ?? '')),
    ];
    $filename = (string) ($item['filename'] ?? '');
    if ($filename !== '' && !app_is_production()) {
        try {
            if (is_file(library_app_image_path($filename))) {
                $public['app_original_url'] = 'images/library/' . rawurlencode(library_safe_filename($filename));
            }
        } catch (Throwable) {
            // Local mirror preview is optional; credit-protected PHP download remains authoritative.
        }
    }
    return $public;
}

function library_item_is_deleted(array $item): bool
{
    return trim((string) ($item['deleted_at'] ?? '')) !== '';
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

function library_file_kind(PDO $pdo, string $original, string $tmpName, int $size): array
{
    $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
    if ($ext === 'stl') {
        if ($size <= 84 || $size > library_stl_upload_max_bytes($pdo)) {
            throw new RuntimeException('invalid_library_stl');
        }
        return ['media_type' => 'stl', 'mime_type' => 'model/stl', 'file_ext' => 'stl'];
    }

    if (in_array($ext, LIBRARY_IMAGE_EXTENSIONS, true)) {
        if ($size <= 0 || $size > library_image_upload_max_bytes($pdo)) {
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
        $sql .= ' WHERE is_active = 1 AND (deleted_at IS NULL OR deleted_at = \'\')';
    }
    $sql .= ' ORDER BY updated_at DESC, id DESC';
    return $pdo->query($sql)->fetchAll();
}

function library_find_item(PDO $pdo, int $itemId, bool $activeOnly = true): ?array
{
    $sql = 'SELECT * FROM library_items WHERE id = ?';
    if ($activeOnly) {
        $sql .= ' AND is_active = 1 AND (deleted_at IS NULL OR deleted_at = \'\')';
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

function library_admin_upload(PDO $pdo, array $file, string $title, string $description, int $cost, bool $active): int
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
    $kind = library_file_kind($pdo, $original, $tmpName, $size);

    library_ensure_storage_dir();
    $stored = 'library_' . bin2hex(random_bytes(16)) . '.' . $kind['file_ext'];
    $target = library_storage_dir() . '/' . $stored;
    if (!move_uploaded_file($tmpName, $target)) {
        throw new RuntimeException('library_store_failed');
    }
    @chmod($target, 0664);
    try {
        library_copy_to_app_image_folder($target, $stored);
    } catch (Throwable $e) {
        @unlink($target);
        throw $e;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO library_items (filename, original_filename, title, description, media_type, mime_type, file_ext, file_size_bytes, cost, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $stored,
        substr($original, 0, 190),
        library_clean_title($title, $original),
        substr(trim($description), 0, 1000),
        $kind['media_type'],
        $kind['mime_type'],
        $kind['file_ext'],
        $size,
        max(1, $cost),
        $active ? 1 : 0,
    ]);
    $itemId = (int) $pdo->lastInsertId();
    if ($kind['media_type'] === 'stl') {
        try {
            library_write_stl_png_thumbnail([
                'id' => $itemId,
                'filename' => $stored,
                'media_type' => 'stl',
                'file_ext' => 'stl',
            ]);
        } catch (Throwable $e) {
            app_log($pdo, 'warning', 'admin', 'library_thumbnail_generation_failed', 'Preview PNG STL non generee', ['item_id' => $itemId, 'error' => $e->getMessage()], null, 422);
        }
    }
    return $itemId;
}

function library_admin_upload_many(PDO $pdo, array $files, string $title, string $description, int $cost, bool $active): array
{
    $uploaded = [];
    $failed = [];
    foreach (library_normalize_upload_files($files) as $file) {
        try {
            $uploaded[] = library_admin_upload($pdo, $file, $title, $description, $cost, $active);
        } catch (Throwable $e) {
            $failed[] = [
                'name' => (string) ($file['name'] ?? ''),
                'error' => $e->getMessage(),
            ];
        }
    }
    return ['uploaded' => $uploaded, 'failed' => $failed];
}

function library_admin_update(PDO $pdo, int $itemId, string $title, string $description, int $cost, bool $active): void
{
    $item = library_find_item($pdo, $itemId, false);
    if ($item === null) {
        throw new RuntimeException('library_item_not_found');
    }
    if (library_item_is_deleted($item)) {
        throw new RuntimeException('library_item_archived');
    }
    $stmt = $pdo->prepare('UPDATE library_items SET title = ?, description = ?, cost = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $stmt->execute([library_clean_title($title, (string) $item['original_filename']), substr(trim($description), 0, 1000), max(1, $cost), $active ? 1 : 0, $itemId]);
}

function library_admin_archive(PDO $pdo, int $itemId): array
{
    $item = library_find_item($pdo, $itemId, false);
    if ($item === null) {
        throw new RuntimeException('library_item_not_found');
    }
    $path = library_item_path($item);
    $thumbnailPath = library_thumbnail_path($item);
    $alreadyDeleted = library_item_is_deleted($item);
    $pdo->beginTransaction();
    try {
        if (!$alreadyDeleted) {
            $pdo->prepare("UPDATE library_download_authorizations SET status = 'revoked' WHERE library_item_id = ? AND status = 'authorized'")
                ->execute([$itemId]);
            $pdo->prepare('UPDATE library_items SET is_active = 0, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                ->execute([$itemId]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    $deletedFile = !is_file($path) || @unlink($path);
    if (is_file($thumbnailPath)) {
        @unlink($thumbnailPath);
    }
    library_delete_app_image_assets($item);
    return ['item' => $item, 'deleted_file' => $deletedFile, 'already_deleted' => $alreadyDeleted];
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

function library_download_request_reference(int $itemId): string
{
    return '/api/library/download?item_id=' . $itemId;
}

function library_user_downloads(PDO $pdo, int $userId, int $limit = 50): array
{
    $limit = max(1, min(200, $limit));
    $stmt = $pdo->prepare(
        'SELECT library_downloads.id,
                library_downloads.downloaded_at,
                library_downloads.library_item_id,
                library_download_authorizations.id AS authorization_id,
                library_download_authorizations.credit_cost,
                library_items.title,
                library_items.original_filename,
                library_items.media_type,
                library_items.file_ext,
                library_items.file_size_bytes,
                library_items.deleted_at
         FROM library_downloads
         JOIN library_download_authorizations ON library_download_authorizations.id = library_downloads.library_download_authorization_id
         JOIN library_items ON library_items.id = library_downloads.library_item_id
         WHERE library_downloads.user_id = ?
         ORDER BY library_downloads.id DESC
         LIMIT ?'
    );
    $stmt->bindValue(1, $userId, PDO::PARAM_INT);
    $stmt->bindValue(2, $limit, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetchAll();
}

function library_user_authorizations(PDO $pdo, int $userId, int $limit = 50): array
{
    $limit = max(1, min(200, $limit));
    $stmt = $pdo->prepare(
        'SELECT library_download_authorizations.id,
                library_download_authorizations.library_item_id,
                library_download_authorizations.credit_cost,
                library_download_authorizations.status,
                library_download_authorizations.created_at,
                library_download_authorizations.expires_at,
                library_download_authorizations.consumed_at,
                library_download_authorizations.downloaded_at,
                library_items.title,
                library_items.original_filename,
                library_items.deleted_at
         FROM library_download_authorizations
         LEFT JOIN library_items ON library_items.id = library_download_authorizations.library_item_id
         WHERE library_download_authorizations.user_id = ?
         ORDER BY library_download_authorizations.id DESC
         LIMIT ?'
    );
    $stmt->bindValue(1, $userId, PDO::PARAM_INT);
    $stmt->bindValue(2, $limit, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetchAll();
}

function library_stl_vertices_from_binary(string $bytes, int $maxTriangles = LIBRARY_STL_PREVIEW_MAX_TRIANGLES): array
{
    if (strlen($bytes) < 84) {
        throw new RuntimeException('invalid_stl_preview');
    }
    $triCount = unpack('V', substr($bytes, 80, 4))[1] ?? 0;
    $expected = 84 + ((int) $triCount * 50);
    if ($triCount <= 0 || $expected > strlen($bytes)) {
        throw new RuntimeException('invalid_stl_preview');
    }
    $step = max(1, (int) ceil($triCount / max(1, $maxTriangles)));
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

function library_stl_vertices_from_ascii(string $bytes, int $maxTriangles = LIBRARY_STL_PREVIEW_MAX_TRIANGLES): array
{
    preg_match_all('/vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/', $bytes, $matches, PREG_SET_ORDER);
    if (count($matches) < 3) {
        throw new RuntimeException('invalid_stl_preview');
    }
    $triCount = intdiv(count($matches), 3);
    $step = max(1, (int) ceil($triCount / max(1, $maxTriangles)));
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

function library_stl_preview_payload(array $item, int $maxTriangles = LIBRARY_STL_PREVIEW_MAX_TRIANGLES): array
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
    $maxTriangles = max(1, min(LIBRARY_STL_PREVIEW_HIGH_MAX_TRIANGLES, $maxTriangles));
    $triangles = $looksAscii
        ? library_stl_vertices_from_ascii($bytes, $maxTriangles)
        : library_stl_vertices_from_binary($bytes, $maxTriangles);
    $preview = library_project_stl_preview($triangles);
    return [
        'ok' => true,
        'item' => library_public_item($item),
        'sampled_triangles' => count($preview['triangles']),
        'bbox' => $preview['bbox'],
        'mesh_triangles' => $triangles,
        'triangles' => $preview['triangles'],
    ];
}

function library_create_preview_canvas(int $size): GdImage
{
    if (!extension_loaded('gd')) {
        throw new RuntimeException('gd_unavailable');
    }
    $size = max(128, min(1024, $size));
    $image = imagecreatetruecolor($size, $size);
    imageantialias($image, true);
    $background = imagecolorallocate($image, 255, 253, 248);
    imagefilledrectangle($image, 0, 0, $size, $size, $background);
    return $image;
}

function library_image_to_png_thumbnail(array $item, int $size = 512): string
{
    $path = library_item_path($item);
    $bytes = is_file($path) ? file_get_contents($path) : false;
    if (!is_string($bytes) || $bytes === '') {
        throw new RuntimeException('library_file_missing');
    }
    $source = @imagecreatefromstring($bytes);
    if (!$source instanceof GdImage) {
        throw new RuntimeException('invalid_library_image_preview');
    }
    $thumb = library_create_preview_canvas($size);
    $size = imagesx($thumb);
    $sourceW = imagesx($source);
    $sourceH = imagesy($source);
    if ($sourceW <= 0 || $sourceH <= 0) {
        imagedestroy($source);
        imagedestroy($thumb);
        throw new RuntimeException('invalid_library_image_preview');
    }
    $scale = min(($size - 32) / $sourceW, ($size - 32) / $sourceH);
    $targetW = max(1, (int) round($sourceW * $scale));
    $targetH = max(1, (int) round($sourceH * $scale));
    $targetX = (int) floor(($size - $targetW) / 2);
    $targetY = (int) floor(($size - $targetH) / 2);
    imagecopyresampled($thumb, $source, $targetX, $targetY, 0, 0, $targetW, $targetH, $sourceW, $sourceH);
    imagedestroy($source);
    ob_start();
    imagepng($thumb);
    $png = ob_get_clean();
    imagedestroy($thumb);
    if (!is_string($png) || $png === '') {
        throw new RuntimeException('thumbnail_render_failed');
    }
    return $png;
}

function library_stl_to_png_thumbnail(array $item, int $size = 512): string
{
    $path = library_item_path($item);
    $bytes = is_file($path) ? file_get_contents($path) : false;
    if (!is_string($bytes) || $bytes === '') {
        throw new RuntimeException('library_file_missing');
    }
    $looksAscii = str_starts_with(ltrim(substr($bytes, 0, 256)), 'solid') && preg_match('/\bvertex\b/', substr($bytes, 0, 4096));
    $triangles = $looksAscii
        ? library_stl_vertices_from_ascii($bytes, LIBRARY_STL_THUMBNAIL_MAX_TRIANGLES)
        : library_stl_vertices_from_binary($bytes, LIBRARY_STL_THUMBNAIL_MAX_TRIANGLES);
    return library_render_stl_top_png($triangles, $size);
}

function library_render_stl_top_png(array $triangles, int $size = 512): string
{
    if ($triangles === []) {
        throw new RuntimeException('invalid_stl_preview');
    }
    $image = library_create_preview_canvas($size);
    $size = imagesx($image);
    $border = max(18, (int) round($size * 0.08));
    $points = [];
    foreach ($triangles as $tri) {
        if (!is_array($tri)) {
            continue;
        }
        foreach ($tri as $point) {
            if (is_array($point) && count($point) >= 3) {
                $points[] = [(float) $point[0], (float) $point[1], (float) $point[2]];
            }
        }
    }
    if ($points === []) {
        imagedestroy($image);
        throw new RuntimeException('invalid_stl_preview');
    }
    $xs = array_column($points, 0);
    $ys = array_column($points, 1);
    $zs = array_column($points, 2);
    $minX = min($xs);
    $maxX = max($xs);
    $minY = min($ys);
    $maxY = max($ys);
    $minZ = min($zs);
    $maxZ = max($zs);
    $spanZ = max($maxZ - $minZ, 0.001);
    $scale = min(($size - ($border * 2)) / max($maxX - $minX, 0.001), ($size - ($border * 2)) / max($maxY - $minY, 0.001));
    $usedW = ($maxX - $minX) * $scale;
    $usedH = ($maxY - $minY) * $scale;
    $offsetX = (int) round(($size - $usedW) / 2);
    $offsetY = (int) round(($size - $usedH) / 2);
    $map = static function (array $point) use ($offsetX, $offsetY, $size, $scale, $minX, $minY): array {
        return [
            (int) round($offsetX + (((float) $point[0] - $minX) * $scale)),
            (int) round($size - $offsetY - (((float) $point[1] - $minY) * $scale)),
        ];
    };
    usort($triangles, static function (array $a, array $b): int {
        $za = (((float) ($a[0][2] ?? 0)) + ((float) ($a[1][2] ?? 0)) + ((float) ($a[2][2] ?? 0))) / 3.0;
        $zb = (((float) ($b[0][2] ?? 0)) + ((float) ($b[1][2] ?? 0)) + ((float) ($b[2][2] ?? 0))) / 3.0;
        return $za <=> $zb;
    });
    $line = imagecolorallocatealpha($image, 64, 46, 28, 82);
    foreach ($triangles as $tri) {
        if (!is_array($tri) || count($tri) < 3) {
            continue;
        }
        $a = $map($tri[0]);
        $b = $map($tri[1]);
        $c = $map($tri[2]);
        $poly = [$a[0], $a[1], $b[0], $b[1], $c[0], $c[1]];
        $avgZ = (((float) ($tri[0][2] ?? 0)) + ((float) ($tri[1][2] ?? 0)) + ((float) ($tri[2][2] ?? 0))) / 3.0;
        $shade = ($avgZ - $minZ) / $spanZ;
        $r = (int) round(214 - ($shade * 84));
        $g = (int) round(154 - ($shade * 72));
        $bcol = (int) round(86 - ($shade * 48));
        $fill = imagecolorallocatealpha($image, max(65, $r), max(48, $g), max(28, $bcol), 34);
        imagefilledpolygon($image, $poly, 3, $fill);
        imagepolygon($image, $poly, 3, $line);
    }
    $frame = imagecolorallocatealpha($image, 180, 137, 89, 94);
    imagerectangle($image, $offsetX, $offsetY, (int) round($offsetX + $usedW), (int) round($offsetY + $usedH), $frame);
    ob_start();
    imagepng($image);
    $png = ob_get_clean();
    imagedestroy($image);
    if (!is_string($png) || $png === '') {
        throw new RuntimeException('thumbnail_render_failed');
    }
    return $png;
}

function library_write_stl_png_thumbnail(array $item, int $size = 512): void
{
    if (!library_is_stl_item($item)) {
        return;
    }
    $png = library_stl_to_png_thumbnail($item, $size);
    $thumbnailPath = library_thumbnail_path($item);
    if (file_put_contents($thumbnailPath, $png, LOCK_EX) === false) {
        throw new RuntimeException('thumbnail_write_failed');
    }
    @chmod($thumbnailPath, 0664);
    library_mirror_thumbnail_to_app_images($item);
}

function library_save_custom_png_thumbnail(array $item, string $pngBytes, int $size = 512): void
{
    if (!library_is_stl_item($item)) {
        throw new RuntimeException('not_stl_thumbnail');
    }
    if ($pngBytes === '' || strlen($pngBytes) > 2097152) {
        throw new RuntimeException('invalid_thumbnail_png');
    }
    $source = @imagecreatefromstring($pngBytes);
    if (!$source instanceof GdImage) {
        throw new RuntimeException('invalid_thumbnail_png');
    }
    $thumb = library_create_preview_canvas($size);
    $srcW = imagesx($source);
    $srcH = imagesy($source);
    $scale = min($size / max($srcW, 1), $size / max($srcH, 1));
    $dstW = max(1, (int) round($srcW * $scale));
    $dstH = max(1, (int) round($srcH * $scale));
    $dstX = (int) round(($size - $dstW) / 2);
    $dstY = (int) round(($size - $dstH) / 2);
    imagecopyresampled($thumb, $source, $dstX, $dstY, 0, 0, $dstW, $dstH, $srcW, $srcH);
    imagedestroy($source);

    ob_start();
    imagepng($thumb);
    $cleanPng = ob_get_clean();
    imagedestroy($thumb);
    if (!is_string($cleanPng) || $cleanPng === '') {
        throw new RuntimeException('thumbnail_render_failed');
    }
    $thumbnailPath = library_thumbnail_path($item);
    if (file_put_contents($thumbnailPath, $cleanPng, LOCK_EX) === false) {
        throw new RuntimeException('thumbnail_write_failed');
    }
    @chmod($thumbnailPath, 0664);
    library_mirror_thumbnail_to_app_images($item);
}

function library_touch_item_thumbnail(PDO $pdo, int $itemId): void
{
    $pdo->prepare('UPDATE library_items SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$itemId]);
}

function library_thumbnail_png(array $item, int $size = 512): string
{
    if (library_is_stl_item($item)) {
        $thumbnailPath = library_thumbnail_path($item);
        if (!is_file($thumbnailPath)) {
            library_write_stl_png_thumbnail($item, $size);
        }
        $png = file_get_contents($thumbnailPath);
        if (!is_string($png) || $png === '') {
            throw new RuntimeException('thumbnail_read_failed');
        }
        return $png;
    }
    if (library_is_image_item($item)) {
        return library_image_to_png_thumbnail($item, $size);
    }
    throw new RuntimeException('unsupported_library_thumbnail');
}
