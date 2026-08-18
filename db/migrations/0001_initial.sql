PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 100),
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL CHECK(length(password_hash) = 64),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE CHECK(length(token_hash) = 64),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user_expiry ON sessions(user_id, expires_at);

CREATE TABLE codes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(slug) BETWEEN 3 AND 64),
  foreground TEXT NOT NULL CHECK(foreground GLOB '#[0-9A-Fa-f]*' AND length(foreground) = 7),
  background TEXT NOT NULL CHECK(background GLOB '#[0-9A-Fa-f]*' AND length(background) = 7),
  error_correction TEXT NOT NULL CHECK(error_correction IN ('L','M','Q','H')),
  logo_key TEXT,
  logo_content_type TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled','archived')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX idx_codes_owner_status_updated ON codes(owner_id, status, updated_at DESC);

CREATE TABLE redirect_rules (
  id TEXT PRIMARY KEY,
  code_id TEXT NOT NULL REFERENCES codes(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK(revision > 0),
  destination_url TEXT NOT NULL CHECK(length(destination_url) BETWEEN 10 AND 2048),
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  changed_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  UNIQUE(code_id, revision)
);
CREATE UNIQUE INDEX idx_redirect_rules_one_current ON redirect_rules(code_id) WHERE valid_to IS NULL;
CREATE INDEX idx_redirect_rules_code_history ON redirect_rules(code_id, revision DESC);

CREATE TABLE scan_events (
  id TEXT PRIMARY KEY,
  code_id TEXT NOT NULL REFERENCES codes(id) ON DELETE RESTRICT,
  occurred_at TEXT NOT NULL,
  occurred_date TEXT NOT NULL CHECK(length(occurred_date) = 10),
  device_category TEXT NOT NULL CHECK(device_category IN ('mobile','tablet','desktop','bot','unknown'))
);
CREATE INDEX idx_scan_events_code_date ON scan_events(code_id, occurred_date);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  code_id TEXT REFERENCES codes(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK(length(action) BETWEEN 3 AND 64),
  idempotency_key TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE(owner_id, idempotency_key)
);
CREATE INDEX idx_audit_owner_created ON audit_log(owner_id, created_at DESC);

PRAGMA optimize;
