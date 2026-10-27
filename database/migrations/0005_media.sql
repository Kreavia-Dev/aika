-- Uploaded files: what they are, where they live, and who put them there.
--
-- Forward-only. Never edit this file once it may have been applied anywhere.
--
-- The bytes themselves are NOT in this table. They are on disk under the
-- directory that MEDIA_ROOT points at. This row is the record that says a file
-- is expected to exist, and the two can drift: a file with no row is invisible
-- and harmless, a row with no file is a broken image and a loud one.

CREATE TABLE IF NOT EXISTS media_files (
  id            TEXT PRIMARY KEY,
  -- The generated name on disk, and the last segment of the public URL. Unique
  -- because it is what the serving route looks a file up by.
  filename      TEXT NOT NULL UNIQUE,
  -- What the uploader called it. Kept for a human, never used to build a path,
  -- because a filename from a browser is attacker controlled text.
  original_name TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  byte_size     INTEGER NOT NULL,
  -- Nullable because a file may outlive the account that uploaded it. The
  -- alternative, ON DELETE CASCADE, would delete a client's images when a staff
  -- account is removed, which is a surprising amount of damage.
  uploaded_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL
);

-- No index on created_at. The library screen lists the newest hundred rows in a
-- table that a client site will not grow past a few thousand, and SQLite reads
-- that by scanning. Same reasoning as 0003_contact.sql, recorded here so the
-- absence is a decision rather than an omission.
