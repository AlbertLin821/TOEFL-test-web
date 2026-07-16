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
  student_quota: z.number().int().min(0).optional(),
  exam_quota: z.number().int().min(0).optional(),
  ai_credit_quota: z.number().int().min(0).optional(),
});

const updateOrgSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    plan_type: z.string().max(50).nullable().optional(),
    status: z.enum(['active', 'suspended']).optional(),
    student_quota: z.number().int().min(0).optional(),
    exam_quota: z.number().int().min(0).optional(),
    ai_credit_quota: z.number().int().min(0).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required.' });

organizationsRouter.post(
  '/organizations',
  requireRole('platform_admin'),
  validateBody(createOrgSchema),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const body = req.body as { name: string; slug: string; plan_type?: string; student_quota?: number; exam_quota?: number; ai_credit_quota?: number };
      const existing = await prisma.organization.findUnique({ where: { slug: body.slug } });
      if (existing) throw errors.conflict('Slug already exists.');
      const created = await prisma.organization.create({
        data: {
          name: body.name,
          slug: body.slug,
          planType: body.plan_type,
          studentQuota: body.student_quota ?? 0,
          examQuota: body.exam_quota ?? 0,
          aiCreditQuota: body.ai_credit_quota ?? 0,
        },
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

organizationsRouter.patch(
  '/organizations/:id',
  requireRole('platform_admin'),
  validateBody(updateOrgSchema),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const existing = await prisma.organization.findUnique({ where: { id: req.params.id } });
      if (!existing) throw errors.notFound('Organization');
      const body = req.body as {
        name?: string;
        plan_type?: string | null;
        status?: 'active' | 'suspended';
        student_quota?: number;
        exam_quota?: number;
        ai_credit_quota?: number;
      };
      const updated = await prisma.organization.update({
        where: { id: existing.id },
        data: {
          name: body.name,
          planType: body.plan_type,
          status: body.status,
          studentQuota: body.student_quota,
          examQuota: body.exam_quota,
          aiCreditQuota: body.ai_credit_quota,
        },
      });
      await auditLog({
        organizationId: updated.id,
        actorUserId: user.id,
        action: 'organization_updated',
        resourceType: 'organization',
        resourceId: updated.id,
        metadata: { status: updated.status },
      });
      res.json({
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        status: updated.status,
        plan_type: updated.planType,
        student_quota: updated.studentQuota,
        exam_quota: updated.examQuota,
        ai_credit_quota: updated.aiCreditQuota,
      });
    } catch (e) {
      next(e);
    }
  },
);

organizationsRouter.delete('/organizations/:id', requireRole('platform_admin'), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { users: true, classes: true, examPapers: true, assignments: true, attempts: true } } },
    });
    if (!org) throw errors.notFound('Organization');
    const dependencies = Object.values(org._count).reduce((sum, count) => sum + count, 0);
    if (dependencies > 0) {
      throw errors.conflict('Organization contains accounts, classes, exams, assignments, or results. Suspend it instead.');
    }
    await prisma.organization.delete({ where: { id: org.id } });
    await auditLog({
      actorUserId: user.id,
      action: 'organization_deleted',
      resourceType: 'organization',
      resourceId: org.id,
      metadata: { name: org.name },
    });
    res.json({ deleted: true });
  } catch (e) {
    next(e);
  }
});
