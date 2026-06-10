export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: string, status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found.", details?: Record<string, unknown>) {
    super("RESOURCE_NOT_FOUND", 404, message, details);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Access denied.", details?: Record<string, unknown>) {
    super("FORBIDDEN", 403, message, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized.", details?: Record<string, unknown>) {
    super("UNAUTHORIZED", 401, message, details);
  }
}

export class ValidationError extends ApiError {
  constructor(message = "Validation error.", details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", 400, message, details);
  }
}

export class ConflictError extends ApiError {
  constructor(message = "Conflict.", details?: Record<string, unknown>) {
    super("CONFLICT", 409, message, details);
  }
}

export class ConflictCodeError extends ApiError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, 409, message, details);
  }
}

export class RateLimitError extends ApiError {
  constructor(message = "Rate limit exceeded.", details?: Record<string, unknown>) {
    super("RATE_LIMIT_EXCEEDED", 429, message, details);
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, 429, message, details);
  }
}
