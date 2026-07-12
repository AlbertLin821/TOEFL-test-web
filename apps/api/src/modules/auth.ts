import { Router } from 'express';
import argon2 from 'argon2';
import { prisma } from '@toefl/database';
import { loginSchema } from '@toefl/shared';
import { errors } from '../lib/errors.js';
import { createSession, destroySession, SESSION_COOKIE } from '../lib/session.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { auditLog } from '../lib/audit.js';
import { config } from '../config.js';

export const authRouter = Router();

authRouter.post('/auth/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'active') throw errors.invalidCredentials();
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      await auditLog({ organizationId: user.organizationId, actorUserId: user.id, action: 'login_failed', resourceType: 'user', resourceId: user.id });
      throw errors.invalidCredentials();
    }
    const token = await createSession(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await auditLog({ organizationId: user.organizationId, actorUserId: user.id, action: 'login_success', resourceType: 'user', resourceId: user.id });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    });
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization_id: user.organizationId,
      },
    });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/auth/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) await destroySession(token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

authRouter.get('/users/me', requireAuth, (req, res) => {
  const user = (req as AuthedRequest).user;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization_id: user.organizationId,
  });
});
