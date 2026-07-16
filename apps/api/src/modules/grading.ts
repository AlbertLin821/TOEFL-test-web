import { Router } from 'express';
import { prisma } from '@toefl/database';
import { errors } from '../lib/errors.js';
import { requireAuth, requireRole, assertOrgScope, type AuthedRequest } from '../middleware/auth.js';
import { auditLog } from '../lib/audit.js';
import { gradingQueue } from '../lib/queue.js';

export const gradingRouter = Router();

gradingRouter.use('/grading-jobs', requireAuth);

gradingRouter.get('/grading-jobs/:id', async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const job = await prisma.gradingJob.findUnique({
      where: { id: req.params.id },
      include: { attempt: true },
    });
    if (!job) throw errors.notFound('Grading job');
    assertOrgScope(user, job.attempt.organizationId);
    if (user.role === 'student' && job.attempt.studentId !== user.id) throw errors.forbidden();
    res.json({
      id: job.id,
      status: job.status,
      job_type: job.jobType,
      retry_count: job.retryCount,
      error_message: job.errorMessage,
    });
  } catch (e) {
    next(e);
  }
});

gradingRouter.get('/attempts/:id/grading-status', requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const attempt = await prisma.attempt.findUnique({
      where: { id: req.params.id },
      include: { gradingJobs: true },
    });
    if (!attempt) throw errors.notFound('Attempt');
    assertOrgScope(user, attempt.organizationId);
    if (user.role === 'student' && attempt.studentId !== user.id) throw errors.forbidden();
    res.json({
      attempt_id: attempt.id,
      attempt_status: attempt.status,
      jobs: attempt.gradingJobs.map((j) => ({
        id: j.id,
        job_type: j.jobType,
        status: j.status,
        retry_count: j.retryCount,
      })),
    });
  } catch (e) {
    next(e);
  }
});

gradingRouter.post(
  '/grading-jobs/:id/retry',
  requireRole('teacher', 'org_admin', 'platform_admin'),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const job = await prisma.gradingJob.findUnique({
        where: { id: req.params.id },
        include: { attempt: true },
      });
      if (!job) throw errors.notFound('Grading job');
      assertOrgScope(user, job.attempt.organizationId);
      if (!['failed'].includes(job.status)) {
        throw errors.conflict('Only failed jobs can be retried.');
      }
      await prisma.$transaction([
        prisma.gradingJob.update({
          where: { id: job.id },
          data: { status: 'queued', retryCount: 0, errorMessage: null },
        }),
        ...(job.jobType === 'feedback_translation'
          ? []
          : [prisma.attempt.update({ where: { id: job.attemptId }, data: { status: 'grading' as const } })]),
      ]);
      await gradingQueue.add(job.jobType, { gradingJobId: job.id, attemptId: job.attemptId }, {
        jobId: `${job.id}-retry-${Date.now()}`,
      });
      await auditLog({
        organizationId: job.attempt.organizationId,
        actorUserId: user.id,
        action: 'grading_job_retried',
        resourceType: 'grading_job',
        resourceId: job.id,
      });
      res.json({ id: job.id, status: 'queued' });
    } catch (e) {
      next(e);
    }
  },
);
