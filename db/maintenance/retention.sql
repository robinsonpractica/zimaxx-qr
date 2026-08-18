-- Run daily after a verified D1 backup.
-- Retain privacy-minimal scan events for 13 months and discard dead sessions.
DELETE FROM scan_events WHERE occurred_at < datetime('now', '-13 months');
DELETE FROM sessions
WHERE expires_at < datetime('now', '-7 days')
   OR (revoked_at IS NOT NULL AND revoked_at < datetime('now', '-7 days'));
PRAGMA optimize;
