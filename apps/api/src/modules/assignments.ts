import { Router } from 'express';
import { prisma } from '@toefl/database';
import { createAssignmentSchema } from '@toefl/shared';
import { errors } from '../lib/errors.js';
import { requireAuth, requireRole, assertOrgScope, type AuthedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { auditLog } from '../lib/audit.js';

export const assignmentsRouter = Router();

assignmentsRouter.use('/assignments', requireAuth);

assignmentsRouter.get('/assignments', requireRole('platform_admin', 'org_admin', 'teacher'), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const { class_id, status } = req.query as { class_id?: string; status?: string };
    const where = {
      ...(user.role === 'platform_admin' ? {} : { organizationId: user.organizationId! }),
      ...(class_id ? { classId: class_id } : {}),
      ...(status ? { status: status as 'scheduled' | 'active' | 'closed' } : {}),
    };
    const assignments = await prisma.examAssignment.findMany({
      where,
      include: {
        examVersion: { include: { examPaper: true } },
        class: { select: { id: true, name: true } },
        _count: { select: { attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      data: assignments.map((a) => ({
        id: a.id,
        exam_version_id: a.examVersionId,
        exam_title: a.examVersion.examPaper.title,
        version_no: a.examVersion.versionNo,
        class_id: a.classId,
        class_name: a.class?.name ?? null,
        opens_at: a.opensAt,
        closes_at: a.closesAt,
        max_attempts: a.maxAttempts,
        status: a.status,
        attempt_count: a._count.attempts,
      })),
    });
  } catch (e) {
    next(e);
  }
});

assignmentsRouter.post(
  '/assignments',
  requireRole('org_admin', 'teacher'),
  validateBody(createAssignmentSchema),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const body = req.body as {
        exam_version_id: string;
        class_id: string;
        opens_at: Date;
        closes_at: Date;
        max_attempts: number;
      };
      if (!user.organizationId) throw errors.forbidden();

      const version = await prisma.examVersion.findUnique({
        where: { id: body.exam_version_id },
        include: { examPaper: true },
      });
      if (!version) throw errors.notFound('Exam version');
      if (version.status !== 'published') {
        throw errors.business('EXAM_NOT_OPEN', 'Only published exam versions can be assigned.');
      }
      if (version.examPaper.organizationId) assertOrgScope(user, version.examPaper.organizationId);

      const klass = await prisma.class.findUnique({ where: { id: body.class_id } });
      if (!klass) throw errors.notFound('Class');
      assertOrgScope(user, klass.organizationId);

      const now = new Date();
      const created = await prisma.examAssignment.create({
        data: {
          organizationId: user.organizationId,
          examVersionId: version.id,
          classId: klass.id,
          assignedBy: user.id,
          opensAt: body.opens_at,
          closesAt: body.closes_at,
          maxAttempts: body.max_attempts,
          status: body.opens_at <= now ? 'active' : 'scheduled',
        },
      });
      await auditLog({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: 'assignment_created',
        resourceType: 'exam_assignment',
        resourceId: created.id,
        metadata: { exam_version_id: version.id, class_id: klass.id },
      });
      res.status(201).json({ id: created.id, status: created.status });
    } catch (e) {
      next(e);
    }
  },
);
