-- 0001_init.sql
--
-- Migrations are plain SQL, applied in filename order by `npm run db:migrate`.
-- They are forward-only: there are no down migrations. To undo a change,
-- write a new migration that does it.
--
-- Rules:
--   * Never edit a migration that has already been applied somewhere.
--   * Never drop a column in the same release that stops writing to it.
--   * A feature owns the tables it declares and no others.

-- Application-level key/value settings. Intentionally generic: every client
-- project ends up wanting somewhere to store a site name, a locale, or a
-- feature switch. A feature that needs richer storage declares its own tables.
CREATE TABLE IF NOT EXISTS app_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO app_meta (key, value)
VALUES ('schema_version', '1')
ON CONFLICT (key) DO NOTHING;
