import { Router } from 'express';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { prisma, Prisma } from '@toefl/database';
import { saveResponseSchema, startAttemptSchema, updateSectionStateSchema } from '@toefl/shared';
import { errors } from '../lib/errors.js';
import { requireAuth, requireRole, assertOrgScope, type AuthedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { auditLog } from '../lib/audit.js';
import { buckets, putObject } from '../lib/storage.js';
import { gradingQueue } from '../lib/queue.js';
import { scoreObjectiveItems } from './scoring.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'video/webm'].some((t) =>
      file.mimetype.startsWith(t),
    );
    cb(null, ok);
  },
});

export const attemptsRouter = Router();

attemptsRouter.use(['/student', '/attempts'], requireAuth);

// ---------- Student: available exams ----------
attemptsRouter.get('/student/available-exams', requireRole('student'), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const memberships = await prisma.classMember.findMany({ where: { userId: user.id }, select: { classId: true } });
    const classIds = memberships.map((m) => m.classId);
    const now = new Date();
    const assignments = await prisma.examAssignment.findMany({
      where: { classId: { in: classIds }, organizationId: user.organizationId! },
      include: {
        examVersion: { include: { examPaper: true } },
        assigner: { select: { name: true } },
        attempts: { where: { studentId: user.id }, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { opensAt: 'desc' },
    });

    res.json({
      data: assignments.map((a) => {
        const active = a.attempts.find((t) =>
          ['hardware_check', 'in_progress', 'not_started'].includes(t.status),
        );
        const finished = a.attempts.filter((t) =>
          ['submitted', 'grading', 'completed'].includes(t.status),
        );
        let status: string;
        if (active) status = 'in_progress';
        else if (finished.some((t) => t.status === 'completed')) status = 'report_ready';
        else if (finished.length > 0) status = 'grading';
        else if (now < a.opensAt) status = 'not_open';
        else if (now > a.closesAt) status = 'closed';
        else if (a.attempts.length >= a.maxAttempts) status = 'max_attempts_reached';
        else status = 'available';
        const latestFinished = finished[0];
        return {
          assignment_id: a.id,
          exam_title: a.examVersion.examPaper.title,
          version_no: a.examVersion.versionNo,
          teacher_name: a.assigner?.name ?? null,
          opens_at: a.opensAt,
          closes_at: a.closesAt,
          max_attempts: a.maxAttempts,
          attempts_used: a.attempts.length,
          status,
          active_attempt_id: active?.id ?? null,
          latest_attempt_id: latestFinished?.id ?? active?.id ?? null,
        };
      }),
    });
  } catch (e) {
    next(e);
  }
});

// ---------- Start attempt ----------
attemptsRouter.post('/attempts/start', requireRole('student'), validateBody(startAttemptSchema), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const { assignment_id } = req.body as { assignment_id: string };
    const assignment = await prisma.examAssignment.findUnique({
      where: { id: assignment_id },
      include: { class: { include: { members: { where: { userId: user.id } } } } },
    });
    if (!assignment) throw errors.notFound('Assignment');
    assertOrgScope(user, assignment.organizationId);
    if (!assignment.class || assignment.class.members.length === 0) {
      throw errors.forbidden('You are not a member of this class.');
    }
    const now = new Date();
    if (now < assignment.opensAt) throw errors.business('EXAM_NOT_OPEN', 'The exam is not open yet.');
    if (now > assignment.closesAt) throw errors.business('EXAM_CLOSED', 'The exam has closed.');

    const existing = await prisma.attempt.findFirst({
      where: {
        assignmentId: assignment.id,
        studentId: user.id,
        status: { in: ['not_started', 'hardware_check', 'in_progress'] },
      },
    });
    if (existing) {
      res.json({ attempt_id: existing.id, status: existing.status, exam_version_id: existing.examVersionId });
      return;
    }

    const usedCount = await prisma.attempt.count({
      where: { assignmentId: assignment.id, studentId: user.id },
    });
    if (usedCount >= assignment.maxAttempts) {
      throw errors.business('MAX_ATTEMPTS_REACHED', 'Maximum attempts reached.');
    }

    const attempt = await prisma.attempt.create({
      data: {
        organizationId: assignment.organizationId,
        assignmentId: assignment.id,
        studentId: user.id,
        examVersionId: assignment.examVersionId,
        status: 'hardware_check',
        startedAt: now,
      },
    });
    await auditLog({
      organizationId: assignment.organizationId,
      actorUserId: user.id,
      action: 'attempt_started',
      resourceType: 'attempt',
      resourceId: attempt.id,
    });
    res.status(201).json({ attempt_id: attempt.id, status: attempt.status, exam_version_id: attempt.examVersionId });
  } catch (e) {
    next(e);
  }
});

async function loadOwnedAttempt(req: AuthedRequest, attemptId: string) {
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw errors.notFound('Attempt');
  assertOrgScope(req.user, attempt.organizationId);
  if (req.user.role === 'student' && attempt.studentId !== req.user.id) throw errors.forbidden();
  return attempt;
}

// ---------- Get attempt state ----------
attemptsRouter.get('/attempts/:id', async (req, res, next) => {
  try {
    const attempt = await loadOwnedAttempt(req as AuthedRequest, req.params.id);
    const [sectionStates, responses, audioResponses] = await Promise.all([
      prisma.attemptSectionState.findMany({ where: { attemptId: attempt.id } }),
      prisma.response.findMany({
        where: { attemptId: attempt.id },
        select: { examItemId: true, responseJson: true, savedAt: true },
      }),
      prisma.audioResponse.findMany({
        where: { attemptId: attempt.id },
        select: { examItemId: true, status: true, durationMs: true },
      }),
    ]);
    res.json({
      id: attempt.id,
      status: attempt.status,
      exam_version_id: attempt.examVersionId,
      current_section_id: attempt.currentSectionId,
      current_item_id: attempt.currentItemId,
      started_at: attempt.startedAt,
      submitted_at: attempt.submittedAt,
      last_saved_at: attempt.lastSavedAt,
      section_states: sectionStates.map((s) => ({
        section_id: s.sectionId,
        module_id: s.moduleId,
        status: s.status,
        remaining_seconds: s.remainingSeconds,
        current_item_id: s.currentItemId,
      })),
      responses: responses.map((r) => ({
        exam_item_id: r.examItemId,
        response: r.responseJson,
        saved_at: r.savedAt,
      })),
      audio_responses: audioResponses.map((a) => ({
        exam_item_id: a.examItemId,
        status: a.status,
        duration_ms: a.durationMs,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// ---------- Mark hardware check done ----------
attemptsRouter.post('/attempts/:id/hardware-check-complete', requireRole('student'), async (req, res, next) => {
  try {
    const attempt = await loadOwnedAttempt(req as AuthedRequest, req.params.id);
    if (attempt.status !== 'hardware_check') throw errors.conflict('Attempt is not in hardware check.');
    const updated = await prisma.attempt.update({
      where: { id: attempt.id },
      data: { status: 'in_progress' },
    });
    res.json({ id: updated.id, status: updated.status });
  } catch (e) {
    next(e);
  }
});

// ---------- Save response ----------
attemptsRouter.patch('/attempts/:id/response', requireRole('student'), validateBody(saveResponseSchema), async (req, res, next) => {
  try {
    const attempt = await loadOwnedAttempt(req as AuthedRequest, req.params.id);
    if (!['in_progress', 'hardware_check'].includes(attempt.status)) {
      throw errors.conflict('Attempt already submitted.');
    }
    const { exam_item_id, response_json } = req.body as { exam_item_id: string; response_json: unknown };
    const item = await prisma.examItem.findUnique({ where: { id: exam_item_id } });
    if (!item) throw errors.notFound('Exam item');
    const now = new Date();
    await prisma.$transaction([
      prisma.response.upsert({
        where: { attemptId_examItemId: { attemptId: attempt.id, examItemId: exam_item_id } },
        update: { responseJson: response_json as object, savedAt: now },
        create: {
          attemptId: attempt.id,
          examItemId: exam_item_id,
          responseJson: response_json as object,
          savedAt: now,
        },
      }),
      prisma.attempt.update({
        where: { id: attempt.id },
        data: { lastSavedAt: now, currentItemId: exam_item_id },
      }),
    ]);
    res.json({ saved: true, server_saved_at: now });
  } catch (e) {
    next(e);
  }
});

// ---------- Save section state ----------
attemptsRouter.patch('/attempts/:id/section-state', requireRole('student'), validateBody(updateSectionStateSchema), async (req, res, next) => {
  try {
    const attempt = await loadOwnedAttempt(req as AuthedRequest, req.params.id);
    if (!['in_progress', 'hardware_check'].includes(attempt.status)) {
      throw errors.conflict('Attempt already submitted.');
    }
    const body = req.body as {
      section_id: string;
      module_id?: string | null;
      status?: 'not_started' | 'in_progress' | 'completed';
      remaining_seconds?: number;
      current_item_id?: string | null;
    };
    const now = new Date();
    const state = await prisma.attemptSectionState.upsert({
      where: { attemptId_sectionId: { attemptId: attempt.id, sectionId: body.section_id } },
      update: {
        ...(body.module_id !== undefined ? { moduleId: body.module_id } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.status === 'completed' ? { completedAt: now } : {}),
        ...(body.remaining_seconds !== undefined ? { remainingSeconds: body.remaining_seconds } : {}),
        ...(body.current_item_id !== undefined ? { currentItemId: body.current_item_id } : {}),
      },
      create: {
        attemptId: attempt.id,
        sectionId: body.section_id,
        moduleId: body.module_id ?? null,
        status: body.status ?? 'in_progress',
        startedAt: now,
        remainingSeconds: body.remaining_seconds,
        currentItemId: body.current_item_id ?? null,
      },
    });
    await prisma.attempt.update({
      where: { id: attempt.id },
      data: { currentSectionId: body.section_id, lastSavedAt: now },
    });
    res.json({ saved: true, section_state_id: state.id });
  } catch (e) {
    next(e);
  }
});

// ---------- Upload speaking audio ----------
attemptsRouter.post('/attempts/:id/audio', requireRole('student'), upload.single('audio'), async (req, res, next) => {
  try {
    const attempt = await loadOwnedAttempt(req as AuthedRequest, req.params.id);
    if (!['in_progress', 'hardware_check'].includes(attempt.status)) {
      throw errors.conflict('Attempt already submitted.');
    }
    const examItemId = req.body.exam_item_id as string | undefined;
    const durationMs = req.body.duration_ms ? Number(req.body.duration_ms) : null;
    if (!examItemId) throw errors.validation({ exam_item_id: 'Required' });
    if (!req.file) throw errors.business('AUDIO_UPLOAD_FAILED', 'No audio file received.');

    const item = await prisma.examItem.findUnique({ where: { id: examItemId } });
    if (!item) throw errors.notFound('Exam item');

    const ext = req.file.mimetype.includes('ogg') ? 'ogg' : req.file.mimetype.includes('mp4') ? 'm4a' : 'webm';
    const storageKey = `recordings/${attempt.id}/${examItemId}-${nanoid(8)}.${ext}`;
    await putObject(buckets.recordings, storageKey, req.file.buffer, req.file.mimetype);

    const audio = await prisma.audioResponse.upsert({
      where: { attemptId_examItemId: { attemptId: attempt.id, examItemId } },
      update: { storageKey, mimeType: req.file.mimetype, durationMs, status: 'uploaded' },
      create: {
        attemptId: attempt.id,
        examItemId,
        storageKey,
        mimeType: req.file.mimetype,
        durationMs,
        status: 'uploaded',
      },
    });
    await prisma.attempt.update({ where: { id: attempt.id }, data: { lastSavedAt: new Date() } });
    res.json({ audio_response_id: audio.id, status: audio.status });
  } catch (e) {
    next(e);
  }
});

// ---------- Submit ----------
attemptsRouter.post('/attempts/:id/submit', requireRole('student'), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const attempt = await loadOwnedAttempt(req as AuthedRequest, req.params.id);
    if (['submitted', 'grading', 'completed'].includes(attempt.status)) {
      throw errors.conflict('Attempt already submitted.');
    }
    const now = new Date();
    await prisma.attempt.update({
      where: { id: attempt.id },
      data: { status: 'submitted', submittedAt: now },
    });

    // 1) Objective scoring (reading / listening / build-a-sentence)
    const objectiveStats = await scoreObjectiveItems(attempt.id);

    // 2) Create grading jobs for AI items
    const aiItems = await prisma.examItem.findMany({
      where: {
        gradingType: 'ai',
        module: { section: { examVersionId: attempt.examVersionId } },
      },
      include: { module: { include: { section: true } } },
    });

    const jobIds: string[] = [];
    const writingItems = aiItems.filter((i) => i.module.section.sectionType === 'writing');
    const speakingItems = aiItems.filter((i) => i.module.section.sectionType === 'speaking');

    if (writingItems.length > 0) {
      const job = await prisma.gradingJob.create({
        data: {
          attemptId: attempt.id,
          jobType: 'writing_grading',
          payloadJson: { item_ids: writingItems.map((i) => i.id) },
        },
      });
      jobIds.push(job.id);
      await gradingQueue.add('writing_grading', { gradingJobId: job.id, attemptId: attempt.id });
    }
    if (speakingItems.length > 0) {
      const job = await prisma.gradingJob.create({
        data: {
          attemptId: attempt.id,
          jobType: 'speaking_transcription',
          payloadJson: { item_ids: speakingItems.map((i) => i.id) },
        },
      });
      jobIds.push(job.id);
      await gradingQueue.add('speaking_transcription', { gradingJobId: job.id, attemptId: attempt.id });
    }

    // 3) Store objective stats snapshot on a draft report
    const report = await prisma.scoreReport.upsert({
      where: { attemptId: attempt.id },
      update: {},
      create: {
        attemptId: attempt.id,
        studentId: attempt.studentId,
        examVersionId: attempt.examVersionId,
        status: 'draft',
      },
    });
    const reading = objectiveStats.find((s) => s.sectionType === 'reading');
    const listening = objectiveStats.find((s) => s.sectionType === 'listening');
    await prisma.scoreReport.update({
      where: { id: report.id },
      data: {
        readingScore: reading ? new Prisma.Decimal(reading.scaledScore) : undefined,
        listeningScore: listening ? new Prisma.Decimal(listening.scaledScore) : undefined,
        reportJson: { objective_stats: JSON.parse(JSON.stringify(objectiveStats)) },
      },
    });

    await prisma.attempt.update({ where: { id: attempt.id }, data: { status: 'grading' } });

    // If there are no AI items at all, finalize report immediately via report job
    if (jobIds.length === 0) {
      const job = await prisma.gradingJob.create({
        data: { attemptId: attempt.id, jobType: 'report_generation' },
      });
      await gradingQueue.add('report_generation', { gradingJobId: job.id, attemptId: attempt.id });
      jobIds.push(job.id);
    }

    await auditLog({
      organizationId: attempt.organizationId,
      actorUserId: user.id,
      action: 'attempt_submitted',
      resourceType: 'attempt',
      resourceId: attempt.id,
      metadata: { grading_job_ids: jobIds },
    });

    res.json({ attempt_id: attempt.id, status: 'grading', grading_job_ids: jobIds });
  } catch (e) {
    next(e);
  }
});
