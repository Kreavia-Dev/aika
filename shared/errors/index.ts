import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Domain errors carry a stable machine-readable `code` and an HTTP status.
 * Route handlers throw these; `shared/http/app.ts` maps them to the JSON
 * envelope in one place, so no handler ever builds an error response by hand.
 */
export class AppError extends Error {
  readonly code: string
  readonly status: ContentfulStatusCode

  constructor(
    message: string,
    options: { code: string, status: ContentfulStatusCode, cause?: unknown },
  ) {
    super(message, { cause: options.cause })
    this.name = new.target.name
    this.code = options.code
    this.status = options.status
  }
}

export class ValidationError extends AppError {
  readonly issues: readonly string[]

  constructor(message = 'The submitted data is invalid.', issues: readonly string[] = []) {
    super(message, { code: 'VALIDATION_ERROR', status: 422 })
    this.issues = issues
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found.') {
    super(message, { code: 'NOT_FOUND', status: 404 })
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'You must sign in to continue.') {
    super(message, { code: 'UNAUTHORIZED', status: 401 })
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this.') {
    super(message, { code: 'FORBIDDEN', status: 403 })
  }
}

export class ConflictError extends AppError {
  constructor(message = 'That conflicts with existing data.') {
    super(message, { code: 'CONFLICT', status: 409 })
  }
}
