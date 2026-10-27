-- Contact form submissions.
--
-- Forward-only. Never edit this file once it may have been applied anywhere.

CREATE TABLE IF NOT EXISTS contact_messages (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  -- COLLATE NOCASE so that a search for a sender later is not defeated by casing.
  email      TEXT COLLATE NOCASE NOT NULL,
  message    TEXT NOT NULL,
  -- Attacker controlled and unbounded on the wire, so the service truncates it
  -- before it reaches here. Kept because it is the cheapest signal for telling
  -- a person from a script when triaging.
  user_agent TEXT,
  created_at TEXT NOT NULL
);
