import type { NextFunction, Request, Response } from 'express';
import { prisma, type User } from '@toefl/database';
import type { Role } from '@toefl/shared';
import { errors } from '../lib/errors.js';
import { getSession, SESSION_COOKIE } from '../lib/session.js';

export interface AuthedRequest extends Request {
  user: User;
  requestId?: string;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) throw errors.unauthorized();
    const session = await getSession(token);
    if (!session) throw errors.unauthorized();
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.status !== 'active') throw errors.unauthorized();
    (req as AuthedRequest).user = user;
    next();
  } catch (e) {
    next(e);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user) return next(errors.unauthorized());
    if (!roles.includes(user.role as Role)) return next(errors.forbidden());
    next();
  };
}

/**
 * Tenant scope guard: verifies the resource's organizationId matches the
 * current user's organization. Platform admins bypass (audited by callers).
 */
export function assertOrgScope(user: User, resourceOrgId: string | null | undefined): void {
  if (user.role === 'platform_admin') return;
  if (!resourceOrgId || !user.organizationId || resourceOrgId !== user.organizationId) {
    throw errors.tenantViolation();
  }
}
