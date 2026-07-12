import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@toefl/database';
import { errors } from '../lib/errors.js';
import { requireAuth, requireRole, assertOrgScope, type AuthedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { auditLog } from '../lib/audit.js';

export const organizationsRouter = Router();

organizationsRouter.use('/organizations', requireAuth);

organizationsRouter.get('/organizations', requireRole('platform_admin'), async (_req, res, next) => {
  try {
    const orgs = await prisma.organization.findMany({
      include: { _count: { select: { users: true, classes: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      data: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        status: o.status,
        plan_type: o.planType,
        student_quota: o.studentQuota,
        exam_quota: o.examQuota,
        ai_credit_quota: o.aiCreditQuota,
        user_count: o._count.users,
        class_count: o._count.classes,
      })),
    });
  } catch (e) {
    next(e);
  }
});

organizationsRouter.get('/organizations/:id', requireRole('platform_admin', 'org_admin'), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) throw errors.notFound('Organization');
    assertOrgScope(user, org.id);
    res.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      plan_type: org.planType,
      student_quota: org.studentQuota,
      exam_quota: org.examQuota,
      ai_credit_quota: org.aiCreditQuota,
    });
  } catch (e) {
    next(e);
  }
});

const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  plan_type: z.string().max(50).optional(),
});

organizationsRouter.post(
  '/organizations',
  requireRole('platform_admin'),
  validateBody(createOrgSchema),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const body = req.body as { name: string; slug: string; plan_type?: string };
      const existing = await prisma.organization.findUnique({ where: { slug: body.slug } });
      if (existing) throw errors.conflict('Slug already exists.');
      const created = await prisma.organization.create({
        data: { name: body.name, slug: body.slug, planType: body.plan_type },
      });
      await auditLog({
        organizationId: created.id,
        actorUserId: user.id,
        action: 'organization_created',
        resourceType: 'organization',
        resourceId: created.id,
      });
      res.status(201).json({ id: created.id, name: created.name, slug: created.slug });
    } catch (e) {
      next(e);
    }
  },
);
