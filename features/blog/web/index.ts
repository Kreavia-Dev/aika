/**
 * The `blog` feature's browser-safe boundary.
 *
 * Types, plus the two constants a page needs: how many posts a page holds, and
 * the shape of a slug. Both are shared rather than copied, because a second copy
 * of either is a second place for it to drift.
 *
 * Why a browser door exists at all: the server door at `~~/features/blog` exports
 * `blogRoutes`, which reaches `better-sqlite3` through the database client. A Vue
 * component importing from there would drag SQLite into the browser bundle, and
 * rule R6 in `npm run arch:check` refuses it.
 */
export type {
  Category,
  CategoryInput,
  CategoryListResponse,
  DeletePostResponse,
  PostInput,
  PostListResponse,
  PostResponse,
  PostStatus,
  PublishedPost,
  StaffPost,
  StaffPostListResponse,
  StaffPostResponse,
} from '../contract'

export { POSTS_PER_PAGE, postStatusSchema, slugSchema } from '../contract'
