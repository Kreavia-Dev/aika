-- Blog: articles, and the categories they belong to.
--
-- Forward-only. Never edit this file once it may have been applied anywhere.
--
-- WHY TWO TABLES AND NOT ONE TEXT COLUMN FOR THE CATEGORY. A category is
-- something a client will eventually rename, reorder, or list on its own, and a
-- free text column makes all three a migration instead of an update. The cost of
-- getting this right now is one table and one foreign key.

CREATE TABLE IF NOT EXISTS blog_categories (
  id         TEXT PRIMARY KEY,
  -- The address of the category, in a URL. Unique, because two categories at the
  -- same address is not a state anybody can navigate out of.
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  -- Hand set rather than alphabetical, so a client can put the important one
  -- first. Ties fall back to name, which is stable.
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id             TEXT PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  -- Shown in a list, and used as the meta description when the post has no
  -- dedicated SEO field. A list of titles with no summary is what makes a blog
  -- look like a sitemap.
  summary        TEXT NOT NULL,
  -- Markdown, not HTML. Stored as text and rendered on the server, so there is no
  -- HTML sanitising question at this layer: the renderer produces the HTML, and a
  -- client's post cannot inject a script into another reader's page. See
  -- `features/blog/server/markdown.ts` for what is deliberately not supported.
  body           TEXT NOT NULL,
  -- The cover image, if there is one. ON DELETE SET NULL rather than CASCADE: a
  -- deleted image should leave a post without a picture, not delete the post.
  cover_media_id TEXT REFERENCES media_files(id) ON DELETE SET NULL,
  -- Nullable so a post can exist before somebody decides where it belongs.
  category_id    TEXT REFERENCES blog_categories(id) ON DELETE SET NULL,
  -- 'draft' or 'published'. Deliberately not a boolean: a third state such as
  -- 'scheduled' is a realistic next request, and adding a value to a text column
  -- is free while adding one to a boolean is a migration.
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  -- Null while a post is a draft. Set when it is first published.
  published_at   TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

-- The public list is "published, newest first, optionally by category", and that
-- is the one query a visitor triggers on every page view. The index exists for
-- that query specifically: status narrows it, published_at orders it.
CREATE INDEX IF NOT EXISTS idx_blog_posts_published
  ON blog_posts (status, published_at DESC);

-- Category pages ask the same question with an extra equality, and the index
-- above does not help once the category is part of the prefix.
CREATE INDEX IF NOT EXISTS idx_blog_posts_category
  ON blog_posts (category_id, status, published_at DESC);
