import { Router } from 'express';
import argon2 from 'argon2';
import { prisma } from '@toefl/database';
import { createUserSchema, importUsersSchema } from '@toefl/shared';
import { errors } from '../lib/errors.js';
import { requireAuth, requireRole, assertOrgScope, type AuthedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { auditLog } from '../lib/audit.js';

export const usersRouter = Router();

usersRouter.use('/users', requireAuth);

usersRouter.get('/users', requireRole('platform_admin', 'org_admin', 'teacher'), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const { role, class_id } = req.query as { role?: string; class_id?: string };
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size ?? 20)));

    const orgId = user.role === 'platform_admin' ? (req.query.organization_id as string | undefined) : user.organizationId;
    const where = {
      ...(orgId ? { organizationId: orgId } : {}),
      ...(role ? { role: role as 'teacher' | 'student' } : {}),
      ...(class_id ? { classMembers: { some: { classId: class_id } } } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ data, pagination: { page, page_size: pageSize, total } });
  } catch (e) {
    next(e);
  }
});

usersRouter.post(
  '/users',
  requireRole('platform_admin', 'org_admin'),
  validateBody(createUserSchema),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const body = req.body as { name: string; email: string; role: string; password: string };
      if (user.role === 'org_admin' && (body.role === 'platform_admin' || body.role === 'org_admin')) {
        throw errors.forbidden('Org admins can only create teachers and students.');
      }
      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing) throw errors.conflict('Email already exists.');
      const created = await prisma.user.create({
        data: {
          name: body.name,
          email: body.email,
          role: body.role as 'teacher' | 'student',
          passwordHash: await argon2.hash(body.password),
          organizationId: user.organizationId,
        },
        select: { id: true, name: true, email: true, role: true, status: true },
      });
      await auditLog({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: 'user_created',
        resourceType: 'user',
        resourceId: created.id,
        metadata: { role: created.role },
      });
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

usersRouter.post(
  '/users/import',
  requireRole('platform_admin', 'org_admin', 'teacher'),
  validateBody(importUsersSchema),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const body = req.body as {
        class_id?: string;
        students: { name: string; email: string; password?: string }[];
      };
      if (!user.organizationId) throw errors.forbidden('Importing requires an organization account.');

      let classId: string | undefined;
      if (body.class_id) {
        const klass = await prisma.class.findUnique({ where: { id: body.class_id } });
        if (!klass) throw errors.notFound('Class');
        assertOrgScope(user, klass.organizationId);
        classId = klass.id;
      }

      const errorsList: { email: string; reason: string }[] = [];
      let created = 0;
      for (const s of body.students) {
        const existing = await prisma.user.findUnique({ where: { email: s.email } });
        if (existing) {
          if (existing.organizationId === user.organizationId && classId) {
            await prisma.classMember.upsert({
              where: { classId_userId: { classId, userId: existing.id } },
              update: {},
              create: { classId, userId: existing.id },
            });
          } else {
            errorsList.push({ email: s.email, reason: 'Email already exists.' });
          }
          continue;
        }
        const newUser = await prisma.user.create({
          data: {
            name: s.name,
            email: s.email,
            role: 'student',
            passwordHash: await argon2.hash(s.password ?? 'Password123!'),
            organizationId: user.organizationId,
          },
        });
        if (classId) {
          await prisma.classMember.create({ data: { classId, userId: newUser.id } });
        }
        created++;
      }
      await auditLog({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: 'users_imported',
        resourceType: 'user',
        metadata: { created, failed: errorsList.length },
      });
      res.json({ created_count: created, failed_count: errorsList.length, errors: errorsList });
    } catch (e) {
      next(e);
    }
  },
);
