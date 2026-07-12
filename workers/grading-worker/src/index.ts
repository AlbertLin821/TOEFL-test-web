import { Worker, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { prisma, Prisma } from '@toefl/database';
import { QUEUE_NAMES } from '@toefl/shared';
import { workerConfig } from './config.js';
import { gradeSpeaking, gradeWriting, PROMPT_VERSION, transcribeAudio } from './ai.js';
import { finalizeReport } from './report.js';
import { sendReportEmails } from './email.js';

const connection = new Redis(workerConfig.redisUrl, { maxRetriesPerRequest: null });
const emailQueue = new Queue(QUEUE_NAMES.email, { connection });

const s3 = new S3Client({
  endpoint: workerConfig.s3.endpoint,
  region: workerConfig.s3.region,
  credentials: {
    accessKeyId: workerConfig.s3.accessKey,
    secretAccessKey: workerConfig.s3.secretKey,
  },
  forcePathStyle: workerConfig.s3.forcePathStyle,
});

async function getAudioBuffer(storageKey: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const resp = await s3.send(new GetObjectCommand({ Bucket: workerConfig.s3.bucketRecordings, Key: storageKey }));
  const bytes = await resp.Body!.transformToByteArray();
  return { buffer: Buffer.from(bytes), mimeType: resp.ContentType ?? 'audio/webm' };
}

async function markJob(jobId: string, status: 'processing' | 'succeeded' | 'failed' | 'retrying', error?: string) {
  await prisma.gradingJob.update({
    where: { id: jobId },
    data: { status, errorMessage: error ?? null, updatedAt: new Date() },
  });
}

async function handleWritingGrading(gradingJobId: string, attemptId: string) {
  await markJob(gradingJobId, 'processing');
  const job = await prisma.gradingJob.findUnique({ where: { id: gradingJobId } });
  const itemIds = ((job?.payloadJson as { item_ids?: string[] })?.item_ids ?? []) as string[];

  const items = await prisma.examItem.findMany({
    where: { id: { in: itemIds } },
    include: { answerKeys: true },
  });
  const responses = await prisma.response.findMany({ where: { attemptId, examItemId: { in: itemIds } } });
  const responseMap = new Map(responses.map((r) => [r.examItemId, r]));

  for (const item of items) {
    const resp = responseMap.get(item.id);
    const text =
      typeof resp?.responseJson === 'object' && resp.responseJson !== null && 'text' in resp.responseJson
        ? String((resp.responseJson as { text: string }).text)
        : JSON.stringify(resp?.responseJson ?? '');
    const content = item.contentJson as Record<string, unknown>;
    const key = item.answerKeys[0]?.answerJson as Record<string, unknown> | undefined;
    const taskType = String(key?.task_type ?? item.itemType);
    const prompt = String(key?.prompt_summary ?? content.scenario ?? content.professor_question ?? '');

    const graded = await gradeWriting({
      taskType,
      prompt,
      studentResponse: text,
      rubricKey: item.itemType,
    });

    await prisma.aiGradeResult.create({
      data: {
        attemptId,
        examItemId: item.id,
        skill: 'writing',
        modelName: graded.model,
        promptVersion: PROMPT_VERSION,
        overallScore: new Prisma.Decimal(graded.result.overall_score),
        rubricJson: graded.result.rubric_scores,
        feedbackJson: graded.result as object,
        tokenUsageJson: graded.tokenUsage,
        costEstimate: new Prisma.Decimal(graded.costEstimate),
        status: 'succeeded',
      },
    });
  }

  await markJob(gradingJobId, 'succeeded');
  const reportJob = await prisma.gradingJob.create({
    data: { attemptId, jobType: 'report_generation' },
  });
  await new Queue(QUEUE_NAMES.grading, { connection }).add('report_generation', {
    gradingJobId: reportJob.id,
    attemptId,
  });
}

async function handleSpeakingTranscription(gradingJobId: string, attemptId: string) {
  await markJob(gradingJobId, 'processing');
  const job = await prisma.gradingJob.findUnique({ where: { id: gradingJobId } });
  const itemIds = ((job?.payloadJson as { item_ids?: string[] })?.item_ids ?? []) as string[];

  const audios = await prisma.audioResponse.findMany({
    where: { attemptId, examItemId: { in: itemIds } },
  });

  for (const audio of audios) {
    const { buffer, mimeType } = await getAudioBuffer(audio.storageKey);
    const { text, model } = await transcribeAudio(buffer, mimeType);
    await prisma.audioResponse.update({
      where: { id: audio.id },
      data: { transcriptText: text, transcriptModel: model, status: 'transcribed' },
    });
  }

  await markJob(gradingJobId, 'succeeded');

  const gradeJob = await prisma.gradingJob.create({
    data: {
      attemptId,
      jobType: 'speaking_grading',
      payloadJson: { item_ids: itemIds },
    },
  });
  await new Queue(QUEUE_NAMES.grading, { connection }).add('speaking_grading', {
    gradingJobId: gradeJob.id,
    attemptId,
  });
}

async function handleSpeakingGrading(gradingJobId: string, attemptId: string) {
  await markJob(gradingJobId, 'processing');
  const job = await prisma.gradingJob.findUnique({ where: { id: gradingJobId } });
  const itemIds = ((job?.payloadJson as { item_ids?: string[] })?.item_ids ?? []) as string[];

  const items = await prisma.examItem.findMany({
    where: { id: { in: itemIds } },
    include: { answerKeys: true },
  });
  const audios = await prisma.audioResponse.findMany({ where: { attemptId, examItemId: { in: itemIds } } });
  const audioMap = new Map(audios.map((a) => [a.examItemId, a]));

  for (const item of items) {
    const audio = audioMap.get(item.id);
    const key = item.answerKeys[0]?.answerJson as Record<string, unknown> | undefined;
    const content = item.contentJson as Record<string, unknown>;
    const taskType = String(key?.task_type ?? item.itemType);
    const questionText = String(key?.question_text ?? content.question_text ?? '');
    const expected = String(key?.expected_key_content ?? '');
    const transcript = audio?.transcriptText ?? '';
    const durationSeconds = audio?.durationMs ? Math.round(audio.durationMs / 1000) : 0;
    const responseTime = Number(key?.response_time_seconds ?? content.response_seconds ?? 45);

    const graded = await gradeSpeaking({
      taskType,
      questionText,
      expectedKeyContent: expected,
      transcript,
      durationSeconds,
      responseTimeSeconds: responseTime,
      rubricKey: item.itemType,
    });

    await prisma.aiGradeResult.create({
      data: {
        attemptId,
        examItemId: item.id,
        skill: 'speaking',
        modelName: graded.model,
        promptVersion: PROMPT_VERSION,
        overallScore: new Prisma.Decimal(graded.result.overall_score),
        rubricJson: graded.result.rubric_scores,
        feedbackJson: graded.result as object,
        tokenUsageJson: graded.tokenUsage,
        costEstimate: new Prisma.Decimal(graded.costEstimate),
        status: 'succeeded',
      },
    });
  }

  await markJob(gradingJobId, 'succeeded');
  const reportJob = await prisma.gradingJob.create({
    data: { attemptId, jobType: 'report_generation' },
  });
  await new Queue(QUEUE_NAMES.grading, { connection }).add('report_generation', {
    gradingJobId: reportJob.id,
    attemptId,
  });
}

async function handleReportGeneration(gradingJobId: string, attemptId: string) {
  await markJob(gradingJobId, 'processing');
  await finalizeReport(attemptId);
  await markJob(gradingJobId, 'succeeded');
  await emailQueue.add('report_completed', { attemptId, recipients: ['student', 'teacher'] });
}

const gradingWorker = new Worker(
  QUEUE_NAMES.grading,
  async (job) => {
    const { gradingJobId, attemptId } = job.data as { gradingJobId: string; attemptId: string };
    try {
      switch (job.name) {
        case 'writing_grading':
          await handleWritingGrading(gradingJobId, attemptId);
          break;
        case 'speaking_transcription':
          await handleSpeakingTranscription(gradingJobId, attemptId);
          break;
        case 'speaking_grading':
          await handleSpeakingGrading(gradingJobId, attemptId);
          break;
        case 'report_generation':
          await handleReportGeneration(gradingJobId, attemptId);
          break;
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const jobRow = await prisma.gradingJob.findUnique({ where: { id: gradingJobId } });
      const retryCount = (jobRow?.retryCount ?? 0) + 1;
      if (retryCount >= workerConfig.aiMaxRetries) {
        await prisma.gradingJob.update({
          where: { id: gradingJobId },
          data: { status: 'failed', retryCount, errorMessage: msg },
        });
        // Mark AI results as manual review if applicable
        throw e;
      }
      await prisma.gradingJob.update({
        where: { id: gradingJobId },
        data: { status: 'retrying', retryCount, errorMessage: msg },
      });
      throw e;
    }
  },
  { connection, concurrency: 3 },
);

const emailWorker = new Worker(
  QUEUE_NAMES.email,
  async (job) => {
    if (job.name === 'report_completed') {
      const { attemptId, recipients } = job.data as {
        attemptId: string;
        recipients?: ('student' | 'teacher')[];
      };
      await sendReportEmails(attemptId, recipients ?? ['student', 'teacher']);
    }
  },
  { connection, concurrency: 2 },
);

gradingWorker.on('ready', () => console.log('Grading worker ready'));
emailWorker.on('ready', () => console.log('Email worker ready'));
gradingWorker.on('failed', (job, err) => console.error('Grading job failed', job?.name, err.message));
emailWorker.on('failed', (job, err) => console.error('Email job failed', job?.name, err.message));

console.log(`Worker started (AI_MODE=${workerConfig.aiMode})`);
