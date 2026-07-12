import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES, type ErrorCode } from '@toefl/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const errors = {
  validation: (details?: unknown) => new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Invalid request.', details),
  unauthorized: () => new ApiError(401, ERROR_CODES.AUTH_REQUIRED, 'Authentication required.'),
  invalidCredentials: () => new ApiError(401, ERROR_CODES.AUTH_INVALID_CREDENTIALS, 'Invalid email or password.'),
  forbidden: (message = 'You do not have permission to perform this action.') =>
    new ApiError(403, ERROR_CODES.AUTH_FORBIDDEN, message),
  tenantViolation: () => new ApiError(403, ERROR_CODES.TENANT_SCOPE_VIOLATION, 'Cross-organization access denied.'),
  notFound: (what = 'Resource') => new ApiError(404, ERROR_CODES.NOT_FOUND, `${what} not found.`),
  conflict: (message: string) => new ApiError(409, ERROR_CODES.CONFLICT, message),
  business: (code: ErrorCode, message: string) => new ApiError(422, code, message),
};

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as Request & { requestId?: string }).requestId ?? 'unknown';
  if (err instanceof ApiError) {
    res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.details ?? null,
      request_id: requestId,
    });
    return;
  }
  console.error(`[${requestId}]`, err);
  res.status(500).json({
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'Internal server error.',
    details: null,
    request_id: requestId,
  });
}
