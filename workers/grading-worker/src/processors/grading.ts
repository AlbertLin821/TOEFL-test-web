import { prisma, Prisma } from '@toefl/database';
import { Queue } from 'bullmq';
import { gradeSpeaking, gradeWriting, transcribeAudio } from '../ai/provider.js';
import { getObjectBuffer } from '../lib/storage.js';
import { config } from '../config.js';

export interface GradingJobData {
  gradingJobId: string;
  attemptId: string;
}

export async function processWritingGrading(data: GradingJobData): Promise<void> {
  const job = await prisma.gradingJob.findUnique({ where: { id: data.gradingJobId } });
  if (!job) throw new Error('Grading job not found');
  await prisma.gradingJob.update({ where: { id: job.id }, data: { status: 'processing' } });

  const payload = job.payloadJson as { item_ids: string[] };
  for (const itemId of payload.item_ids) {
    const existing = await prisma.aiGradeResult.findFirst({
      where: { attemptId: data.attemptId, examItemId: itemId, status: 'succeeded' },
    });
    if (existing) continue;

    const item = await prisma.examItem.findUnique({
      where: { id: itemId },
      include: { answerKeys: true },
    });
    if (!item) continue;
    const response = await prisma.response.findUnique({
      where: { attemptId_examItemId: { attemptId: data.attemptId, examItemId: itemId } },
    });
    const responseJson = (response?.responseJson ?? {}) as { text?: string };
    const content = item.contentJson as Record<string, unknown>;
    const key = (item.answerKeys[0]?.answerJson ?? {}) as { prompt_summary?: string };

    const outcome = await gradeWriting({
      taskType: item.itemType as 'writing_email' | 'writing_academic_discussion',
      prompt: key.prompt_summary ?? JSON.stringify(content),
      studentResponse: responseJson.text ?? '',
    });

    await prisma.aiGradeResult.create({
      data: {
        attemptId: data.attemptId,
        examItemId: itemId,
        skill: 'writing',
        modelName: outcome.modelName,
        promptVersion: outcome.promptVersion,
        overallScore: new Prisma.Decimal(outcome.result.overall_score),
        rubricJson: outcome.result.rubric_scores,
        feedbackJson: {
          comments: outcome.result.comments,
          strengths: outcome.result.strengths,
          weaknesses: outcome.result.weaknesses,
          improvement_suggestions: outcome.result.improvement_suggestions,
          confidence_flag: outcome.result.confidence_flag,
          task_type: outcome.result.task_type,
        },
        tokenUsageJson: outcome.tokenUsage,
        costEstimate: new Prisma.Decimal(outcome.costEstimate),
        status: 'succeeded',
      },
    });
  }

  await prisma.gradingJob.update({ where: { id: job.id }, data: { status: 'succeeded' } });
}

export async function processSpeakingTranscription(data: GradingJobData, gradingQueue: Queue): Promise<void> {
  const job = await prisma.gradingJob.findUnique({ where: { id: data.gradingJobId } });
  if (!job) throw new Error('Grading job not found');
  await prisma.gradingJob.update({ where: { id: job.id }, data: { status: 'processing' } });

  const payload = job.payloadJson as { item_ids: string[] };
  for (const itemId of payload.item_ids) {
    const audio = await prisma.audioResponse.findUnique({
      where: { attemptId_examItemId: { attemptId: data.attemptId, examItemId: itemId } },
    });
    if (!audio || audio.status === 'transcribed') continue;
    const buffer = await getObjectBuffer(config.s3.bucketRecordings, audio.storageKey);
    const { text, model } = await transcribeAudio(buffer, audio.mimeType);
    await prisma.audioResponse.update({
      where: { id: audio.id },
      data: { transcriptText: text, transcriptModel: model, status: 'transcribed' },
    });
  }

  await prisma.gradingJob.update({ where: { id: job.id }, data: { status: 'succeeded' } });

  // Chain into speaking grading
  const next = await prisma.gradingJob.create({
    data: {
      attemptId: data.attemptId,
      jobType: 'speaking_grading',
      payloadJson: { item_ids: payload.item_ids },
    },
  });
  await gradingQueue.add('speaking_grading', { gradingJobId: next.id, attemptId: data.attemptId });
}

export async function processSpeakingGrading(data: GradingJobData): Promise<void> {
  const job = await prisma.gradingJob.findUnique({ where: { id: data.gradingJobId } });
  if (!job) throw new Error('Grading job not found');
  await prisma.gradingJob.update({ where: { id: job.id }, data: { status: 'processing' } });

  const payload = job.payloadJson as { item_ids: string[] };
  for (const itemId of payload.item_ids) {
    const existing = await prisma.aiGradeResult.findFirst({
      where: { attemptId: data.attemptId, examItemId: itemId, status: 'succeeded' },
    });
    if (existing) continue;

    const item = await prisma.examItem.findUnique({
      where: { id: itemId },
      include: { answerKeys: true },
    });
    if (!item) continue;
    const audio = await prisma.audioResponse.findUnique({
      where: { attemptId_examItemId: { attemptId: data.attemptId, examItemId: itemId } },
    });
    const key = (item.answerKeys[0]?.answerJson ?? {}) as {
      question_text?: string;
      expected_key_content?: string;
      response_time_seconds?: number;
    };
    const content = item.contentJson as { question_text?: string; response_seconds?: number };

    const outcome = await gradeSpeaking({
      taskType: item.itemType as 'speaking_listen_repeat' | 'speaking_interview',
      questionText: key.question_text ?? content.question_text ?? '(listen and repeat)',
      expectedKeyContent: key.expected_key_content ?? '',
      transcript: audio?.transcriptText ?? '',
      durationSeconds: audio?.durationMs ? Math.round(audio.durationMs / 1000) : null,
      responseTimeSeconds: key.response_time_seconds ?? content.response_seconds ?? 45,
    });

    await prisma.aiGradeResult.create({
      data: {
        attemptId: data.attemptId,
        examItemId: itemId,
        skill: 'speaking',
        modelName: outcome.modelName,
        promptVersion: outcome.promptVersion,
        overallScore: new Prisma.Decimal(outcome.result.overall_score),
        rubricJson: outcome.result.rubric_scores,
        feedbackJson: {
          comments: outcome.result.comments,
          strengths: outcome.result.strengths,
          weaknesses: outcome.result.weaknesses,
          improvement_suggestions: outcome.result.improvement_suggestions,
          confidence_flag: outcome.result.confidence_flag,
          task_type: outcome.result.task_type,
          transcript: audio?.transcriptText ?? null,
        },
        tokenUsageJson: outcome.tokenUsage,
        costEstimate: new Prisma.Decimal(outcome.costEstimate),
        status: 'succeeded',
      },
    });
  }

  await prisma.gradingJob.update({ where: { id: job.id }, data: { status: 'succeeded' } });
}

/**
 * When all AI grading jobs for an attempt succeeded, enqueue report generation once.
 */
export async function maybeEnqueueReport(attemptId: string, gradingQueue: Queue): Promise<void> {
  const jobs = await prisma.gradingJob.findMany({ where: { attemptId } });
  const aiJobs = jobs.filter((j) => j.jobType !== 'report_generation');
  const allDone = aiJobs.every((j) => j.status === 'succeeded');
  const hasSpeakingGrading =
    !aiJobs.some((j) => j.jobType === 'speaking_transcription') ||
    aiJobs.some((j) => j.jobType === 'speaking_grading');
  const reportJob = jobs.find((j) => j.jobType === 'report_generation');
  if (allDone && hasSpeakingGrading && !reportJob) {
    const job = await prisma.gradingJob.create({
      data: { attemptId, jobType: 'report_generation' },
    });
    await gradingQueue.add('report_generation', { gradingJobId: job.id, attemptId });
  }
}
