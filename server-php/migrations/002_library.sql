CREATE TABLE IF NOT EXISTS library_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL DEFAULT 'stl',
  mime_type TEXT NOT NULL DEFAULT 'model/stl',
  file_ext TEXT NOT NULL DEFAULT 'stl',
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  cost INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_library_items_is_active ON library_items(is_active);
CREATE INDEX IF NOT EXISTS idx_library_items_media_type ON library_items(media_type);

CREATE TABLE IF NOT EXISTS library_download_authorizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  library_item_id INTEGER NOT NULL,
  credit_cost INTEGER NOT NULL,
  auth_token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'authorized',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at TEXT,
  downloaded_at TEXT,
  ip_hash TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (library_item_id) REFERENCES library_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_library_download_authorizations_user_id ON library_download_authorizations(user_id);
CREATE INDEX IF NOT EXISTS idx_library_download_authorizations_library_item_id ON library_download_authorizations(library_item_id);
CREATE INDEX IF NOT EXISTS idx_library_download_authorizations_status ON library_download_authorizations(status);

CREATE TABLE IF NOT EXISTS library_downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  library_item_id INTEGER NOT NULL,
  library_download_authorization_id INTEGER NOT NULL,
  downloaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_hash TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  request_uri TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (library_item_id) REFERENCES library_items(id) ON DELETE CASCADE,
  FOREIGN KEY (library_download_authorization_id) REFERENCES library_download_authorizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_library_downloads_user_id ON library_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_library_downloads_library_item_id ON library_downloads(library_item_id);
