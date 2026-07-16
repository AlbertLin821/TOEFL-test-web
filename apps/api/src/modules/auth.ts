import { Router, type Response } from 'express';
import argon2 from 'argon2';
import { Prisma, prisma } from '@toefl/database';
import { loginSchema, registerSchema } from '@toefl/shared';
import { errors } from '../lib/errors.js';
import { createSession, destroySession, SESSION_COOKIE } from '../lib/session.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { auditLog } from '../lib/audit.js';
import { config } from '../config.js';

export const authRouter = Router();

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string | null;
};

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
  });
}

function serializeUser(user: AuthUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization_id: user.organizationId,
  };
}

authRouter.post('/auth/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body as { name: string; email: string; password: string };
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw errors.conflict('Email already exists.');

    const passwordHash = await argon2.hash(password);
    const user = await prisma.$transaction(async (tx) => {
      const enrollmentClass = await tx.class.findFirst({
        where: {
          status: 'active',
          organization: { status: 'active' },
          assignments: { some: { status: 'active' } },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, organizationId: true },
      });
      if (!enrollmentClass) {
        throw errors.conflict('Registration is unavailable because no active exam class is configured.');
      }

      const created = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: 'student',
          organizationId: enrollmentClass.organizationId,
        },
      });
      await tx.classMember.create({
        data: { classId: enrollmentClass.id, userId: created.id },
      });
      return created;
    });

    await auditLog({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'self_registered',
      resourceType: 'user',
      resourceId: user.id,
    });
    const token = await createSession(user.id);
    setSessionCookie(res, token);
    res.status(201).json({ user: serializeUser(user) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      next(errors.conflict('Email already exists.'));
      return;
    }
    next(e);
  }
});

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
    setSessionCookie(res, token);
    res.json({ user: serializeUser(user) });
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
