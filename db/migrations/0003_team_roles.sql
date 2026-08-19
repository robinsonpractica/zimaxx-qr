ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'editor'
  CHECK(role IN ('admin','editor'));

-- Preserve full control for every account that existed before team roles.
-- Accounts provisioned after this migration must declare their role explicitly.
UPDATE users SET role = 'admin';

PRAGMA optimize;
