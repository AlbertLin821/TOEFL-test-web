import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { errors } from '../lib/errors.js';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(errors.validation(result.error.flatten()));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(errors.validation(result.error.flatten()));
    }
    (req as Request & { parsedQuery: unknown }).parsedQuery = result.data;
    next();
  };
}
