-- Account lifecycle: ending an account's access without deleting it.
--
-- Forward-only. Never edit this file once it may have been applied anywhere.
--
-- A departed staff member's access has to end when somebody decides it ends.
-- Deleting the row is the wrong tool: it takes that person's sessions and any
-- future audit trail with it, and it cannot be undone by mistake. A timestamp
-- records both facts that matter, whether and when, in one column.
--
-- No index. Every query that reads this either looks a user up by primary key or
-- counts the whole table, and the table holds single digit rows.

ALTER TABLE users ADD COLUMN disabled_at TEXT;
