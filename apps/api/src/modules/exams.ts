import { Router } from 'express';
import { prisma } from '@toefl/database';
import { createExamPaperSchema, createExamVersionSchema } from '@toefl/shared';
import { errors } from '../lib/errors.js';
import { requireAuth, requireRole, assertOrgScope, type AuthedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { auditLog } from '../lib/audit.js';
import { buckets, signedGetUrl } from '../lib/storage.js';

export const examsRouter = Router();

examsRouter.use(['/exam-papers', '/exam-versions'], requireAuth);

/** Papers visible to an org: platform-shared papers (organizationId null) + own papers. */
examsRouter.get('/exam-papers', requireRole('platform_admin', 'org_admin', 'teacher'), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const where =
      user.role === 'platform_admin'
        ? {}
        : { OR: [{ organizationId: null }, { organizationId: user.organizationId! }] };
    const papers = await prisma.examPaper.findMany({
      where,
      include: { versions: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      data: papers.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        organization_id: p.organizationId,
        latest_version: p.versions[0]?.versionNo ?? null,
        versions: p.versions.map((v) => ({
          id: v.id,
          version_no: v.versionNo,
          status: v.status,
          total_score: v.totalScore,
        })),
      })),
    });
  } catch (e) {
    next(e);
  }
});

examsRouter.post(
  '/exam-papers',
  requireRole('platform_admin', 'org_admin'),
  validateBody(createExamPaperSchema),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const body = req.body as { title: string; description?: string };
      const created = await prisma.examPaper.create({
        data: {
          title: body.title,
          description: body.description,
          organizationId: user.role === 'platform_admin' ? null : user.organizationId,
          createdBy: user.id,
        },
      });
      await auditLog({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: 'exam_paper_created',
        resourceType: 'exam_paper',
        resourceId: created.id,
      });
      res.status(201).json({ id: created.id, title: created.title, status: created.status });
    } catch (e) {
      next(e);
    }
  },
);

examsRouter.post(
  '/exam-papers/:id/versions',
  requireRole('platform_admin', 'org_admin'),
  validateBody(createExamVersionSchema),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const paper = await prisma.examPaper.findUnique({ where: { id: req.params.id } });
      if (!paper) throw errors.notFound('Exam paper');
      if (paper.organizationId) assertOrgScope(user, paper.organizationId);
      else if (user.role !== 'platform_admin') throw errors.forbidden();

      const body = req.body as {
        version_no: string;
        total_score?: number;
        sections?: { section_type: 'reading' | 'listening' | 'writing' | 'speaking'; title: string; order_no: number; score_max: number }[];
      };
      const existing = await prisma.examVersion.findUnique({
        where: { examPaperId_versionNo: { examPaperId: paper.id, versionNo: body.version_no } },
      });
      if (existing) throw errors.conflict('Version already exists.');

      const version = await prisma.examVersion.create({
        data: {
          examPaperId: paper.id,
          versionNo: body.version_no,
          totalScore: body.total_score ?? 120,
          sections: body.sections
            ? {
                create: body.sections.map((s) => ({
                  sectionType: s.section_type,
                  title: s.title,
                  orderNo: s.order_no,
                  scoreMax: s.score_max,
                })),
              }
            : undefined,
        },
      });
      await auditLog({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: 'exam_version_created',
        resourceType: 'exam_version',
        resourceId: version.id,
      });
      res.status(201).json({ id: version.id, version_no: version.versionNo, status: version.status });
    } catch (e) {
      next(e);
    }
  },
);

/** Full exam version structure. Answer keys are NEVER included. */
examsRouter.get('/exam-versions/:id', async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const version = await prisma.examVersion.findUnique({
      where: { id: req.params.id },
      include: {
        examPaper: true,
        sections: {
          orderBy: { orderNo: 'asc' },
          include: {
            modules: {
              orderBy: { orderNo: 'asc' },
              include: {
                items: {
                  orderBy: { orderNo: 'asc' },
                  include: { assets: true },
                },
              },
            },
          },
        },
      },
    });
    if (!version) throw errors.notFound('Exam version');
    if (version.examPaper.organizationId) assertOrgScope(user, version.examPaper.organizationId);

    const sections = await Promise.all(
      version.sections.map(async (s) => ({
        id: s.id,
        section_type: s.sectionType,
        title: s.title,
        order_no: s.orderNo,
        score_max: s.scoreMax,
        modules: await Promise.all(
          s.modules.map(async (m) => ({
            id: m.id,
            module_type: m.moduleType,
            title: m.title,
            description: m.description,
            order_no: m.orderNo,
            time_limit_seconds: m.timeLimitSeconds,
            allow_back: m.allowBack,
            allow_review: m.allowReview,
            allow_replay: m.allowReplay,
            items: await Promise.all(
              m.items.map(async (it) => ({
                id: it.id,
                item_type: it.itemType,
                order_no: it.orderNo,
                content: it.contentJson,
                grading_type: it.gradingType,
                time_limit_seconds: it.timeLimitSeconds,
                score_max: Number(it.scoreMax),
                assets: await Promise.all(
                  it.assets.map(async (a) => ({
                    id: a.id,
                    asset_type: a.assetType,
                    mime_type: a.mimeType,
                    url: await signedGetUrl(buckets.assets, a.storageKey, 4 * 3600),
                  })),
                ),
              })),
            ),
          })),
        ),
      })),
    );

    res.json({
      id: version.id,
      exam_paper_id: version.examPaperId,
      exam_title: version.examPaper.title,
      version_no: version.versionNo,
      status: version.status,
      total_score: version.totalScore,
      sections,
    });
  } catch (e) {
    next(e);
  }
});
