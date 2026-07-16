import { Router } from 'express';
import { prisma } from '@toefl/database';
import { addClassMembersSchema, createClassSchema, updateClassSchema } from '@toefl/shared';
import { errors } from '../lib/errors.js';
import { requireAuth, requireRole, assertOrgScope, type AuthedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { auditLog } from '../lib/audit.js';

export const classesRouter = Router();

classesRouter.use('/classes', requireAuth);

classesRouter.get('/classes', requireRole('platform_admin', 'org_admin', 'teacher'), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const requestedOrgId = req.query.organization_id as string | undefined;
    const where =
      user.role === 'platform_admin'
        ? requestedOrgId ? { organizationId: requestedOrgId } : {}
        : user.role === 'teacher'
          ? { organizationId: user.organizationId!, teacherId: user.id }
          : { organizationId: user.organizationId! };
    const classes = await prisma.class.findMany({
      where,
      include: {
        teacher: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      data: classes.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        teacher_id: c.teacherId,
        teacher_name: c.teacher?.name ?? null,
        student_count: c._count.members,
      })),
    });
  } catch (e) {
    next(e);
  }
});

classesRouter.post(
  '/classes',
  requireRole('platform_admin', 'org_admin', 'teacher'),
  validateBody(createClassSchema),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const body = req.body as { name: string; teacher_id?: string; organization_id?: string };
      const organizationId = user.role === 'platform_admin' ? body.organization_id : user.organizationId;
      if (!organizationId) throw errors.validation({ organization_id: 'An organization is required.' });
      const teacherId = body.teacher_id ?? (user.role === 'teacher' ? user.id : undefined);
      if (teacherId) {
        const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
        if (!teacher || teacher.role !== 'teacher') throw errors.validation({ teacher_id: 'Not a teacher.' });
        if (teacher.organizationId !== organizationId) throw errors.tenantViolation();
      }
      const created = await prisma.class.create({
        data: { name: body.name, organizationId, teacherId },
      });
      await auditLog({
        organizationId,
        actorUserId: user.id,
        action: 'class_created',
        resourceType: 'class',
        resourceId: created.id,
      });
      res.status(201).json({ id: created.id, name: created.name, teacher_id: created.teacherId });
    } catch (e) {
      next(e);
    }
  },
);

classesRouter.patch(
  '/classes/:id',
  requireRole('platform_admin', 'org_admin', 'teacher'),
  validateBody(updateClassSchema),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const klass = await prisma.class.findUnique({ where: { id: req.params.id } });
      if (!klass) throw errors.notFound('Class');
      assertOrgScope(user, klass.organizationId);
      if (user.role === 'teacher' && klass.teacherId !== user.id) throw errors.forbidden();
      const body = req.body as { name?: string; teacher_id?: string | null; status?: 'active' | 'archived' };
      if (body.teacher_id) {
        const teacher = await prisma.user.findUnique({ where: { id: body.teacher_id } });
        if (!teacher || teacher.role !== 'teacher') throw errors.validation({ teacher_id: 'Not a teacher.' });
        if (teacher.organizationId !== klass.organizationId) throw errors.tenantViolation();
      }
      const updated = await prisma.class.update({
        where: { id: klass.id },
        data: { name: body.name, teacherId: body.teacher_id, status: body.status },
      });
      await auditLog({
        organizationId: klass.organizationId,
        actorUserId: user.id,
        action: 'class_updated',
        resourceType: 'class',
        resourceId: klass.id,
        metadata: { status: updated.status },
      });
      res.json({ id: updated.id, name: updated.name, teacher_id: updated.teacherId, status: updated.status });
    } catch (e) {
      next(e);
    }
  },
);

classesRouter.delete('/classes/:id', requireRole('platform_admin', 'org_admin'), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const klass = await prisma.class.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { assignments: true } } },
    });
    if (!klass) throw errors.notFound('Class');
    assertOrgScope(user, klass.organizationId);
    if (klass._count.assignments > 0) throw errors.conflict('This class has exam assignments. Archive it instead.');
    await prisma.class.delete({ where: { id: klass.id } });
    await auditLog({
      organizationId: klass.organizationId,
      actorUserId: user.id,
      action: 'class_deleted',
      resourceType: 'class',
      resourceId: klass.id,
      metadata: { name: klass.name },
    });
    res.json({ deleted: true });
  } catch (e) {
    next(e);
  }
});

classesRouter.get('/classes/:id/members', requireRole('platform_admin', 'org_admin', 'teacher'), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const klass = await prisma.class.findUnique({
      where: { id: req.params.id },
      include: { members: { include: { user: { select: { id: true, name: true, email: true, status: true } } } } },
    });
    if (!klass) throw errors.notFound('Class');
    assertOrgScope(user, klass.organizationId);
    res.json({
      data: klass.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        status: m.user.status,
        joined_at: m.joinedAt,
      })),
    });
  } catch (e) {
    next(e);
  }
});

classesRouter.post(
  '/classes/:id/members',
  requireRole('org_admin', 'teacher'),
  validateBody(addClassMembersSchema),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const klass = await prisma.class.findUnique({ where: { id: req.params.id } });
      if (!klass) throw errors.notFound('Class');
      assertOrgScope(user, klass.organizationId);
      const { user_ids } = req.body as { user_ids: string[] };
      const students = await prisma.user.findMany({ where: { id: { in: user_ids } } });
      for (const s of students) {
        assertOrgScope(user, s.organizationId);
      }
      let added = 0;
      for (const s of students) {
        await prisma.classMember.upsert({
          where: { classId_userId: { classId: klass.id, userId: s.id } },
          update: {},
          create: { classId: klass.id, userId: s.id },
        });
        added++;
      }
      await auditLog({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: 'class_members_added',
        resourceType: 'class',
        resourceId: klass.id,
        metadata: { added },
      });
      res.json({ added_count: added });
    } catch (e) {
      next(e);
    }
  },
);

classesRouter.delete('/classes/:id/members/:userId', requireRole('platform_admin', 'org_admin', 'teacher'), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const klass = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!klass) throw errors.notFound('Class');
    assertOrgScope(user, klass.organizationId);
    if (user.role === 'teacher' && klass.teacherId !== user.id) throw errors.forbidden();
    const member = await prisma.classMember.findUnique({
      where: { classId_userId: { classId: klass.id, userId: req.params.userId } },
    });
    if (!member) throw errors.notFound('Class member');
    await prisma.classMember.delete({ where: { id: member.id } });
    await auditLog({
      organizationId: klass.organizationId,
      actorUserId: user.id,
      action: 'class_member_removed',
      resourceType: 'class',
      resourceId: klass.id,
      metadata: { user_id: req.params.userId },
    });
    res.json({ deleted: true });
  } catch (e) {
    next(e);
  }
});
