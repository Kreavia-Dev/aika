-- One previous address per post, so a renamed post keeps working.
--
-- Forward-only. Never edit this file once it may have been applied anywhere.
--
-- WHY ONE PREVIOUS SLUG AND NOT A HISTORY TABLE. A table of every slug a post
-- ever had grows without bound and needs a cleanup policy nobody will write. It
-- also creates an ambiguity that is worse than the problem: if post A used
-- "/blog/x" and moved on, and post B later takes "/blog/x", the old redirect
-- fights the new post. One column holds the case that actually happens, which is
-- somebody fixing a typo in an address, and cannot outgrow one row per post.
--
-- The trade is stated rather than hidden: renaming a post twice or more leaves
-- the older addresses dead. That is the thing a full history table would fix, and
-- it is not worth the ambiguity until somebody actually wants it.

ALTER TABLE blog_posts ADD COLUMN previous_slug TEXT;

-- Not unique, deliberately. Two posts may in principle have been renamed away
-- from the same address at different times, and a UNIQUE here would turn that
-- into a failed save rather than a redirect that is simply not used.
CREATE INDEX IF NOT EXISTS idx_blog_posts_previous_slug
  ON blog_posts (previous_slug);
