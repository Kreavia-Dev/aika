/**
 * The `blog` feature's server boundary.
 *
 * The ONLY file other parts of Aika may import from this feature. Deep imports
 * such as `~~/features/blog/server/service` are refused by `npm run arch:check`.
 *
 * This is the server door. `blogRoutes` reaches `better-sqlite3` through the
 * database client, so nothing running in a browser may import from here. Browser
 * code uses `~~/features/blog/web`.
 */
export { blogRoutes } from './server/routes'
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
} from './contract'
