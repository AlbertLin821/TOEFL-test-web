import { Router } from 'express';
import { prisma } from '@toefl/database';
import {
  SCORE_CONVERSION_VERSION,
  emailReportSchema,
  practiceBandToCefr,
  scaledScoreToPracticeBand,
  teacherCommentSchema,
} from '@toefl/shared';
import { errors } from '../lib/errors.js';
import { requireAuth, requireRole, assertOrgScope, type AuthedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { auditLog } from '../lib/audit.js';
import { buckets, signedGetUrl } from '../lib/storage.js';
import { emailQueue, gradingQueue } from '../lib/queue.js';

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

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

reportsRouter.get('/reports/:attemptId', async (req, res, next) => {
  try {
    const attempt = await loadReport(req as unknown as AuthedRequest, req.params.attemptId);
    const report = attempt.scoreReports[0];
    if (!report) throw errors.business('REPORT_NOT_READY', 'Report is not ready yet.');

    const reportJson = (report.reportJson ?? {}) as Record<string, unknown>;
    const serializeSkill = (skill: 'reading' | 'listening' | 'writing' | 'speaking') =>
      attempt.aiGradeResults
        .filter((result) => result.skill === skill && result.locale === 'zh-TW')
        .map((result) => ({
          result_key: result.resultKey,
          exam_item_id: result.examItemId,
          overall_score: Number(result.overallScore),
          rubric: result.rubricJson,
          feedback: result.feedbackJson,
          status: result.status,
          model_name: result.modelName,
        }));
    const feedbackLocales = asRecord(reportJson.feedback_locales);
    const feedbackTranslations = asRecord(reportJson.feedback_translations);
    const englishTranslation = asRecord(feedbackTranslations.en);
    const scores = {
      reading: report.readingScore !== null ? Number(report.readingScore) : null,
      listening: report.listeningScore !== null ? Number(report.listeningScore) : null,
      writing: report.writingScore !== null ? Number(report.writingScore) : null,
      speaking: report.speakingScore !== null ? Number(report.speakingScore) : null,
      total: report.totalScore !== null ? Number(report.totalScore) : null,
    };
    const storedScoreProfile = asRecord(reportJson.score_profile);
    const scoreProfile = Object.keys(storedScoreProfile).length > 0
      ? storedScoreProfile
      : {
          conversion_version: `${SCORE_CONVERSION_VERSION}-legacy-fallback`,
          skills: Object.fromEntries(
            (['reading', 'listening', 'writing', 'speaking'] as const).map((skill) => {
              const score = scores[skill];
              if (score === null) return [skill, null];
              const band = scaledScoreToPracticeBand(score);
              return [skill, { score_30: score, band_6: band, cefr: practiceBandToCefr(band) }];
            }),
          ),
        };
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
      scores,
      objective_stats: reportJson.objective_stats ?? null,
      score_profile: scoreProfile,
      ai_feedback: {
        reading: serializeSkill('reading'),
        listening: serializeSkill('listening'),
        writing: serializeSkill('writing'),
        speaking: serializeSkill('speaking'),
      },
      feedback_locales: {
        'zh-TW': feedbackLocales['zh-TW'] ?? { status: 'succeeded' },
        en: {
          status: englishTranslation.status ?? asRecord(feedbackLocales.en).status ?? 'not_requested',
          generated_at: englishTranslation.generated_at ?? null,
          items: Array.isArray(englishTranslation.items) ? englishTranslation.items : [],
        },
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

reportsRouter.post('/reports/:attemptId/feedback-translations/en', async (req, res, next) => {
  try {
    const attempt = await loadReport(req as unknown as AuthedRequest, req.params.attemptId);
    const report = attempt.scoreReports[0];
    if (!report || report.status !== 'published') {
      throw errors.business('REPORT_NOT_READY', 'Report is not published yet.');
    }
    const requestResult = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "score_reports" WHERE "id" = ${report.id} FOR UPDATE`;
      const lockedReport = await tx.scoreReport.findUnique({ where: { id: report.id } });
      if (!lockedReport) throw errors.notFound('Report');

      const currentJson = asRecord(lockedReport.reportJson);
      const existingEnglish = asRecord(asRecord(currentJson.feedback_translations).en);
      if (existingEnglish.status === 'succeeded') {
        return { kind: 'cached' as const };
      }

      const existingJob = await tx.gradingJob.findFirst({
        where: {
          attemptId: attempt.id,
          jobType: 'feedback_translation',
          status: { in: ['queued', 'processing', 'retrying'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (existingJob) {
        return { kind: 'existing' as const, job: existingJob };
      }

      const job = await tx.gradingJob.create({
        data: {
          attemptId: attempt.id,
          jobType: 'feedback_translation',
          payloadJson: { target_locale: 'en' },
        },
      });
      const translations = asRecord(currentJson.feedback_translations);
      await tx.scoreReport.update({
        where: { id: report.id },
        data: {
          reportJson: {
            ...currentJson,
            feedback_translations: {
              ...translations,
              en: { status: 'queued', requested_at: new Date().toISOString() },
            },
          },
        },
      });
      return { kind: 'created' as const, job };
    });

    if (requestResult.kind === 'cached') {
      res.json({ status: 'succeeded', cached: true });
      return;
    }
    if (requestResult.kind === 'existing') {
      res.status(202).json({ status: requestResult.job.status, grading_job_id: requestResult.job.id });
      return;
    }

    const job = requestResult.job;
    await gradingQueue.add(
      'feedback_translation',
      { gradingJobId: job.id, attemptId: attempt.id },
      { jobId: job.id },
    );
    res.status(202).json({ status: 'queued', grading_job_id: job.id });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/reports/:attemptId/pdf', async (req, res, next) => {
  try {
    const attempt = await loadReport(req as unknown as AuthedRequest, req.params.attemptId);
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
      organization_id?: string;
    };
    const organizationId = req.query.organization_id as string | undefined;
    const attempts = await prisma.attempt.findMany({
      where: {
        ...(user.role === 'platform_admin' ? organizationId ? { organizationId } : {} : { organizationId: user.organizationId! }),
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
