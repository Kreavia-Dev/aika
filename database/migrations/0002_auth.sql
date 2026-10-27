-- Authentication: users and their sessions.
--
-- Forward-only. Never edit this file once it may have been applied anywhere.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  -- COLLATE NOCASE so that Ada@example.com and ada@example.com are one account.
  -- The service lowercases input too; this is the second line of defence.
  email         TEXT COLLATE NOCASE NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'editor')),
  created_at    TEXT NOT NULL
);

-- The id stored here is the SHA-256 of the token the browser holds, never the
-- token itself. A database leak therefore does not hand over live sessions.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Expiry pruning scans this, and it keeps the cascade from deleting a user
-- linear in the size of the whole table.
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
