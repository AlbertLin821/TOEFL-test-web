import { Router } from 'express';
import { prisma } from '@toefl/database';
import { emailReportSchema, teacherCommentSchema } from '@toefl/shared';
import { errors } from '../lib/errors.js';
import { requireAuth, requireRole, assertOrgScope, type AuthedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { auditLog } from '../lib/audit.js';
import { buckets, signedGetUrl } from '../lib/storage.js';
import { emailQueue } from '../lib/queue.js';

export const reportsRouter = Router();

reportsRouter.use('/reports', requireAuth);
reportsRouter.use('/teacher', requireAuth);

async function loadReport(req: AuthedRequest, attemptId: string) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      student: { select: { id: true, name: true, email: true } },
      organization: { select: { id: true, name: true } },
      assignment: { include: { class: { select: { name: true } }, assigner: { select: { name: true } } } },
      examVersion: { include: { examPaper: true } },
      scoreReports: { include: { comments: { include: { teacher: { select: { name: true } } } } } },
      aiGradeResults: true,
    },
  });
  if (!attempt) throw errors.notFound('Attempt');
  assertOrgScope(req.user, attempt.organizationId);
  if (req.user.role === 'student' && attempt.studentId !== req.user.id) throw errors.forbidden();
  return attempt;
}

reportsRouter.get('/reports/:attemptId', async (req, res, next) => {
  try {
    const attempt = await loadReport(req as AuthedRequest, req.params.attemptId);
    const report = attempt.scoreReports[0];
    if (!report) throw errors.business('REPORT_NOT_READY', 'Report is not ready yet.');

    const reportJson = (report.reportJson ?? {}) as Record<string, unknown>;
    res.json({
      attempt_id: attempt.id,
      status: report.status,
      student: { name: attempt.student.name, email: attempt.student.email },
      organization: attempt.organization.name,
      class_name: attempt.assignment.class?.name ?? null,
      teacher_name: attempt.assignment.assigner?.name ?? null,
      exam_title: attempt.examVersion.examPaper.title,
      exam_version: attempt.examVersion.versionNo,
      completed_at: attempt.completedAt,
      scores: {
        reading: report.readingScore !== null ? Number(report.readingScore) : null,
        listening: report.listeningScore !== null ? Number(report.listeningScore) : null,
        writing: report.writingScore !== null ? Number(report.writingScore) : null,
        speaking: report.speakingScore !== null ? Number(report.speakingScore) : null,
        total: report.totalScore !== null ? Number(report.totalScore) : null,
      },
      objective_stats: reportJson.objective_stats ?? null,
      ai_feedback: {
        writing: attempt.aiGradeResults
          .filter((r) => r.skill === 'writing')
          .map((r) => ({
            exam_item_id: r.examItemId,
            overall_score: Number(r.overallScore),
            rubric: r.rubricJson,
            feedback: r.feedbackJson,
            status: r.status,
            model_name: r.modelName,
          })),
        speaking: attempt.aiGradeResults
          .filter((r) => r.skill === 'speaking')
          .map((r) => ({
            exam_item_id: r.examItemId,
            overall_score: Number(r.overallScore),
            rubric: r.rubricJson,
            feedback: r.feedbackJson,
            status: r.status,
            model_name: r.modelName,
          })),
      },
      teacher_comments: report.comments.map((c) => ({
        id: c.id,
        teacher_name: c.teacher.name,
        comment_text: c.commentText,
        created_at: c.createdAt,
      })),
      disclaimer: 'This is a mock test report and not an official TOEFL score report.',
    });
  } catch (e) {
    next(e);
  }
});

reportsRouter.get('/reports/:attemptId/pdf', async (req, res, next) => {
  try {
    const attempt = await loadReport(req as AuthedRequest, req.params.attemptId);
    const report = attempt.scoreReports[0];
    if (!report?.pdfStorageKey) throw errors.business('REPORT_NOT_READY', 'PDF is not ready yet.');
    const url = await signedGetUrl(buckets.reports, report.pdfStorageKey, 600);
    res.json({ download_url: url });
  } catch (e) {
    next(e);
  }
});

reportsRouter.post('/reports/:attemptId/email', validateBody(emailReportSchema), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const attempt = await loadReport(req as AuthedRequest, req.params.attemptId);
    const report = attempt.scoreReports[0];
    if (!report || report.status !== 'published') {
      throw errors.business('REPORT_NOT_READY', 'Report is not published yet.');
    }
    const { recipients } = req.body as { recipients: ('student' | 'teacher')[] };
    await emailQueue.add('report_completed', {
      attemptId: attempt.id,
      recipients,
      requestedBy: user.id,
    });
    res.json({ queued: true });
  } catch (e) {
    next(e);
  }
});

reportsRouter.patch(
  '/reports/:attemptId/teacher-comment',
  requireRole('teacher', 'org_admin', 'platform_admin'),
  validateBody(teacherCommentSchema),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const attempt = await loadReport(req as AuthedRequest, req.params.attemptId);
      const report = attempt.scoreReports[0];
      if (!report) throw errors.business('REPORT_NOT_READY', 'Report is not ready yet.');
      const { comment_text } = req.body as { comment_text: string };
      const comment = await prisma.teacherComment.create({
        data: { scoreReportId: report.id, teacherId: user.id, commentText: comment_text },
      });
      const versionCount = await prisma.reportVersion.count({ where: { scoreReportId: report.id } });
      await prisma.reportVersion.create({
        data: {
          scoreReportId: report.id,
          versionNo: versionCount + 1,
          reportJson: (report.reportJson ?? {}) as object,
          changedBy: user.id,
          changeReason: 'teacher_comment_added',
        },
      });
      await auditLog({
        organizationId: attempt.organizationId,
        actorUserId: user.id,
        action: 'teacher_comment_added',
        resourceType: 'score_report',
        resourceId: report.id,
      });
      res.json({ id: comment.id, comment_text: comment.commentText });
    } catch (e) {
      next(e);
    }
  },
);

// ---------- Teacher results ----------
reportsRouter.get('/teacher/results', requireRole('teacher', 'org_admin', 'platform_admin'), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const { class_id, assignment_id, status } = req.query as {
      class_id?: string;
      assignment_id?: string;
      status?: string;
    };
    const attempts = await prisma.attempt.findMany({
      where: {
        ...(user.role === 'platform_admin' ? {} : { organizationId: user.organizationId! }),
        ...(assignment_id ? { assignmentId: assignment_id } : {}),
        ...(class_id ? { assignment: { classId: class_id } } : {}),
        ...(status ? { status: status as 'completed' | 'grading' } : { status: { in: ['submitted', 'grading', 'completed'] } }),
        ...(user.role === 'teacher' ? { assignment: { class: { teacherId: user.id }, ...(class_id ? { classId: class_id } : {}) } } : {}),
      },
      include: {
        student: { select: { id: true, name: true } },
        scoreReports: true,
        assignment: { include: { class: { select: { id: true, name: true } }, examVersion: { include: { examPaper: true } } } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    res.json({
      data: attempts.map((a) => {
        const r = a.scoreReports[0];
        return {
          student_id: a.student.id,
          student_name: a.student.name,
          attempt_id: a.id,
          status: a.status,
          class_name: a.assignment.class?.name ?? null,
          exam_title: a.assignment.examVersion.examPaper.title,
          submitted_at: a.submittedAt,
          total_score: r?.totalScore !== null && r?.totalScore !== undefined ? Number(r.totalScore) : null,
          reading_score: r?.readingScore !== null && r?.readingScore !== undefined ? Number(r.readingScore) : null,
          listening_score: r?.listeningScore !== null && r?.listeningScore !== undefined ? Number(r.listeningScore) : null,
          writing_score: r?.writingScore !== null && r?.writingScore !== undefined ? Number(r.writingScore) : null,
          speaking_score: r?.speakingScore !== null && r?.speakingScore !== undefined ? Number(r.speakingScore) : null,
        };
      }),
    });
  } catch (e) {
    next(e);
  }
});
