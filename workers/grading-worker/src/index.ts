import { createHash } from 'node:crypto';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { prisma, Prisma } from '@toefl/database';
import {
  PROMPT_VERSION,
  QUEUE_NAMES,
  SPEAKING_RUBRICS,
  WRITING_RUBRICS,
  type ConstructedGradeItem,
  type ObjectiveItemResult,
} from '@toefl/shared';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';
import {
  gradeObjectiveSection,
  gradeSpeakingBatch,
  gradeWritingBatch,
  analyzeSpeechAcoustics,
  transcribeAudio,
  translateFeedback,
} from './ai.js';
import { analyzeWavQuality, convertToAssessmentWav, formatTranscriptForDisplay } from './audio-utils.js';
import { workerConfig } from './config.js';
import { sendReportEmails } from './email.js';
import { finalizeReport } from './report.js';

const redis = new Redis(workerConfig.redisUrl, { maxRetriesPerRequest: null });
const connection = redis as unknown as ConnectionOptions;
const gradingQueue = new Queue(QUEUE_NAMES.grading, { connection });
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

type JobStatus = 'processing' | 'succeeded' | 'failed' | 'retrying';

function hashInput(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function getAudioBuffer(storageKey: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await s3.send(new GetObjectCommand({
    Bucket: workerConfig.s3.bucketRecordings,
    Key: storageKey,
  }));
  const bytes = await response.Body!.transformToByteArray();
  return { buffer: Buffer.from(bytes), mimeType: response.ContentType ?? 'audio/webm' };
}

async function markJob(jobId: string, status: JobStatus, error?: string) {
  await prisma.gradingJob.update({
    where: { id: jobId },
    data: { status, errorMessage: error ?? null, updatedAt: new Date() },
  });
}

async function mapWithConcurrency<T>(
  values: T[],
  concurrency: number,
  handler: (value: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, values.length)) }, async () => {
    while (nextIndex < values.length) {
      const value = values[nextIndex++];
      await handler(value);
    }
  });
  await Promise.all(workers);
}

function storedConstructedFeedback(grade: ConstructedGradeItem, extras: Record<string, unknown> = {}) {
  const comments: Record<string, string> = { overall: grade.overall_comment };
  const rubricScores: Record<string, number> = {};
  for (const rubric of grade.rubric_scores) {
    comments[rubric.criterion] = rubric.comment;
    rubricScores[rubric.criterion] = rubric.score;
  }
  return {
    rubricScores,
    feedback: {
      task_type: grade.task_type,
      item_score: grade.item_score,
      score_scale: '0-5',
      comments,
      strengths: grade.strengths,
      weaknesses: grade.weaknesses,
      improvement_suggestions: grade.improvement_suggestions,
      confidence_flag: grade.confidence_flag,
      evidence_flags: grade.evidence_flags,
      ...extras,
    },
  };
}

async function upsertAiResult(params: {
  attemptId: string;
  examItemId: string | null;
  skill: 'reading' | 'listening' | 'writing' | 'speaking';
  resultKey: string;
  model: string;
  overallScore: number;
  rubricJson: Prisma.InputJsonValue;
  feedbackJson: Prisma.InputJsonValue;
  tokenUsage: Record<string, number>;
  costEstimate: number | null;
  input: unknown;
  confidenceFlag: 'normal' | 'low_confidence';
}) {
  const key = {
    attemptId: params.attemptId,
    resultKey: params.resultKey,
    promptVersion: PROMPT_VERSION,
    locale: 'zh-TW',
  };
  const data = {
    examItemId: params.examItemId,
    skill: params.skill,
    resultKey: params.resultKey,
    locale: 'zh-TW',
    modelName: params.model,
    promptVersion: PROMPT_VERSION,
    inputHash: hashInput(params.input),
    overallScore: new Prisma.Decimal(params.overallScore),
    rubricJson: params.rubricJson,
    feedbackJson: params.feedbackJson,
    tokenUsageJson: params.tokenUsage,
    costEstimate: params.costEstimate === null ? null : new Prisma.Decimal(params.costEstimate),
    status: params.confidenceFlag === 'low_confidence' ? 'manual_review_required' as const : 'succeeded' as const,
  };
  await prisma.aiGradeResult.upsert({
    where: { attemptId_resultKey_promptVersion_locale: key },
    create: { attemptId: params.attemptId, ...data },
    update: data,
  });
}

async function handleObjectiveFeedback(gradingJobId: string, attemptId: string) {
  await markJob(gradingJobId, 'processing');
  const job = await prisma.gradingJob.findUnique({ where: { id: gradingJobId } });
  const sectionType = asRecord(job?.payloadJson).section_type;
  if (sectionType !== 'reading' && sectionType !== 'listening') {
    throw new Error('Objective feedback job is missing a supported section_type');
  }
  const report = await prisma.scoreReport.findUnique({ where: { attemptId } });
  if (!report) throw new Error('Draft report not found');
  const reportJson = asRecord(report.reportJson);
  const stats = (Array.isArray(reportJson.objective_stats) ? reportJson.objective_stats : [])
    .map(asRecord)
    .find((value) => value.sectionType === sectionType);
  if (!stats) throw new Error(`Objective stats not found for ${sectionType}`);
  const items = (Array.isArray(reportJson.objective_item_results) ? reportJson.objective_item_results : [])
    .filter((value) => asRecord(value).section_type === sectionType) as ObjectiveItemResult[];
  const systemScore = Number(stats.scaledScore ?? 0);
  const graded = await gradeObjectiveSection({
    sectionType,
    systemScore,
    correctCount: Number(stats.correctCount ?? 0),
    totalQuestions: Number(stats.totalQuestions ?? items.length),
    items,
  });
  const categoryStats = [...new Set(items.map((item) => item.category_key))].map((categoryKey) => {
    const categoryItems = items.filter((item) => item.category_key === categoryKey);
    return {
      category_key: categoryKey,
      correct_count: categoryItems.filter((item) => item.is_correct).length,
      total_questions: categoryItems.length,
    };
  });
  const feedbackJson = {
    task_type: `${sectionType}_analysis`,
    score_scale: 'system_0-30',
    comments: { overall: graded.result.overall_comment },
    category_stats: categoryStats,
    categories: graded.result.categories,
    item_feedback: graded.result.item_feedback,
    strengths: graded.result.strengths,
    weaknesses: graded.result.weaknesses,
    improvement_suggestions: graded.result.improvement_suggestions,
    confidence_flag: graded.result.confidence_flag,
    evidence_flags: graded.result.evidence_flags,
  };
  await upsertAiResult({
    attemptId,
    examItemId: null,
    skill: sectionType,
    resultKey: `section:${sectionType}`,
    model: graded.model,
    overallScore: systemScore,
    rubricJson: {},
    feedbackJson,
    tokenUsage: graded.tokenUsage,
    costEstimate: graded.costEstimate,
    input: { stats, items },
    confidenceFlag: graded.result.confidence_flag,
  });
  await markJob(gradingJobId, 'succeeded');
  await maybeEnqueueReport(attemptId);
}

async function handleWritingGrading(gradingJobId: string, attemptId: string) {
  await markJob(gradingJobId, 'processing');
  const job = await prisma.gradingJob.findUnique({ where: { id: gradingJobId } });
  const itemIds = (asRecord(job?.payloadJson).item_ids ?? []) as string[];
  const [items, responses] = await Promise.all([
    prisma.examItem.findMany({ where: { id: { in: itemIds } }, include: { answerKeys: true } }),
    prisma.response.findMany({ where: { attemptId, examItemId: { in: itemIds } } }),
  ]);
  const responseMap = new Map(responses.map((response) => [response.examItemId, response]));
  const inputs = items.map((item) => {
    const content = asRecord(item.contentJson);
    const answerKey = asRecord(item.answerKeys[0]?.answerJson);
    const response = asRecord(responseMap.get(item.id)?.responseJson);
    const taskType = String(answerKey.task_type ?? item.itemType);
    return {
      itemId: item.id,
      taskType,
      prompt: String(answerKey.prompt_summary ?? content.scenario ?? content.professor_question ?? ''),
      responseText: typeof response.text === 'string' ? response.text : '',
      rubric: WRITING_RUBRICS[item.itemType] ?? WRITING_RUBRICS.writing_email,
    };
  });
  const graded = await gradeWritingBatch(inputs);
  const gradeMap = new Map(graded.result.items.map((grade) => [grade.item_id, grade]));
  for (const input of inputs) {
    const grade = gradeMap.get(input.itemId);
    if (!grade) throw new Error(`Writing grade missing for item ${input.itemId}`);
    const stored = storedConstructedFeedback(grade);
    await upsertAiResult({
      attemptId,
      examItemId: input.itemId,
      skill: 'writing',
      resultKey: `item:${input.itemId}`,
      model: graded.model,
      overallScore: grade.item_score,
      rubricJson: stored.rubricScores,
      feedbackJson: stored.feedback,
      tokenUsage: graded.tokenUsage,
      costEstimate: graded.costEstimate,
      input,
      confidenceFlag: grade.confidence_flag,
    });
  }
  await markJob(gradingJobId, 'succeeded');
  await maybeEnqueueReport(attemptId);
}

async function handleSpeakingTranscription(gradingJobId: string, attemptId: string) {
  await markJob(gradingJobId, 'processing');
  const job = await prisma.gradingJob.findUnique({ where: { id: gradingJobId } });
  const itemIds = (asRecord(job?.payloadJson).item_ids ?? []) as string[];
  const [audios, items] = await Promise.all([
    prisma.audioResponse.findMany({ where: { attemptId, examItemId: { in: itemIds } } }),
    prisma.examItem.findMany({ where: { id: { in: itemIds } }, include: { answerKeys: true } }),
  ]);
  const itemMap = new Map(items.map((item) => [item.id, item]));

  await mapWithConcurrency(audios, workerConfig.transcriptionConcurrency, async (audio) => {
    const item = itemMap.get(audio.examItemId);
    if (!item) return;
    try {
      const storedAcoustic = asRecord(audio.acousticJson);
      if (
        audio.status === 'transcribed'
        && audio.transcriptText
        && audio.transcriptModel === workerConfig.transcriptionModel
        && audio.acousticStatus === 'succeeded'
        && storedAcoustic.model === workerConfig.audioModel
      ) {
        return;
      }
      const answerKey = asRecord(item.answerKeys[0]?.answerJson);
      const scripted = item.itemType === 'speaking_listen_repeat';
      const referenceText = scripted ? String(answerKey.expected_key_content ?? '') : '';
      const taskType = String(answerKey.task_type ?? item.itemType);
      const { buffer, mimeType } = await getAudioBuffer(audio.storageKey);
      const transcriptionPromise = transcribeAudio(buffer, mimeType);
      const wav = await convertToAssessmentWav(buffer, workerConfig.ffmpegPath);
      const quality = analyzeWavQuality(wav);
      const [transcription, acoustic] = await Promise.all([
        transcriptionPromise,
        analyzeSpeechAcoustics({
          wav,
          taskType,
          referenceText,
          durationSeconds: audio.durationMs ? audio.durationMs / 1000 : quality.duration_seconds,
          audioQuality: quality as unknown as Record<string, unknown>,
          qualityFlags: quality.quality_flags,
        }),
      ]);
      await prisma.audioResponse.update({
        where: { id: audio.id },
        data: {
          transcriptText: transcription.text,
          displayTranscript: formatTranscriptForDisplay(transcription.text),
          transcriptModel: transcription.model,
          transcriptConfidence: transcription.confidence === null ? null : new Prisma.Decimal(transcription.confidence),
          transcriptMetaJson: transcription.meta as Prisma.InputJsonValue,
          audioQualityJson: quality as unknown as Prisma.InputJsonValue,
          acousticProvider: acoustic.provider,
          acousticStatus: acoustic.status,
          acousticJson: acoustic as unknown as Prisma.InputJsonValue,
          status: 'transcribed',
        },
      });
    } catch (error) {
      await prisma.audioResponse.update({ where: { id: audio.id }, data: { status: 'failed' } });
      throw error;
    }
  });

  await markJob(gradingJobId, 'succeeded');
  let gradeJob = await prisma.gradingJob.findFirst({
    where: { attemptId, jobType: 'speaking_grading' },
    orderBy: { createdAt: 'desc' },
  });
  if (!gradeJob) {
    gradeJob = await prisma.gradingJob.create({
      data: { attemptId, jobType: 'speaking_grading', payloadJson: { item_ids: itemIds } },
    });
  }
  if (gradeJob.status !== 'succeeded') {
    await gradingQueue.add(
      'speaking_grading',
      { gradingJobId: gradeJob.id, attemptId },
      { jobId: gradeJob.id },
    );
  }
}

async function handleSpeakingGrading(gradingJobId: string, attemptId: string) {
  await markJob(gradingJobId, 'processing');
  const job = await prisma.gradingJob.findUnique({ where: { id: gradingJobId } });
  const itemIds = (asRecord(job?.payloadJson).item_ids ?? []) as string[];
  const [items, audios] = await Promise.all([
    prisma.examItem.findMany({ where: { id: { in: itemIds } }, include: { answerKeys: true } }),
    prisma.audioResponse.findMany({ where: { attemptId, examItemId: { in: itemIds } } }),
  ]);
  const audioMap = new Map(audios.map((audio) => [audio.examItemId, audio]));
  const inputs = items.map((item) => {
    const answerKey = asRecord(item.answerKeys[0]?.answerJson);
    const content = asRecord(item.contentJson);
    const audio = audioMap.get(item.id);
    return {
      itemId: item.id,
      taskType: String(answerKey.task_type ?? item.itemType),
      questionText: String(answerKey.question_text ?? content.question_text ?? ''),
      expectedText: String(answerKey.expected_key_content ?? ''),
      transcript: audio?.transcriptText ?? '',
      displayTranscript: audio?.displayTranscript ?? audio?.transcriptText ?? '',
      durationSeconds: audio?.durationMs ? audio.durationMs / 1000 : 0,
      responseTimeSeconds: Number(answerKey.response_time_seconds ?? content.response_seconds ?? 45),
      rubric: SPEAKING_RUBRICS[item.itemType] ?? SPEAKING_RUBRICS.speaking_interview,
      acousticEvidence: audio?.acousticJson ?? {
        provider: 'none', status: audio ? audio.acousticStatus ?? 'missing' : 'missing_audio',
      },
      audioQuality: audio?.audioQualityJson ?? { quality_flags: ['missing_audio'] },
      transcriptConfidence: audio?.transcriptConfidence ? Number(audio.transcriptConfidence) : null,
    };
  });
  const graded = await gradeSpeakingBatch(inputs);
  const gradeMap = new Map(graded.result.items.map((grade) => [grade.item_id, grade]));
  for (const input of inputs) {
    const grade = gradeMap.get(input.itemId);
    if (!grade) throw new Error(`Speaking grade missing for item ${input.itemId}`);
    const stored = storedConstructedFeedback(grade, {
      transcript: input.transcript,
      display_transcript: input.displayTranscript,
      transcript_confidence: input.transcriptConfidence,
      acoustic_evidence: input.acousticEvidence,
      audio_quality: input.audioQuality,
    });
    await upsertAiResult({
      attemptId,
      examItemId: input.itemId,
      skill: 'speaking',
      resultKey: `item:${input.itemId}`,
      model: graded.model,
      overallScore: grade.item_score,
      rubricJson: stored.rubricScores,
      feedbackJson: stored.feedback,
      tokenUsage: graded.tokenUsage,
      costEstimate: graded.costEstimate,
      input,
      confidenceFlag: grade.confidence_flag,
    });
  }
  await markJob(gradingJobId, 'succeeded');
  await maybeEnqueueReport(attemptId);
}

async function maybeEnqueueReport(attemptId: string) {
  const reportJob = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "attempts" WHERE id = ${attemptId} FOR UPDATE`;
    const jobs = await tx.gradingJob.findMany({ where: { attemptId } });
    const prerequisites = jobs.filter((job) => [
      'objective_feedback',
      'writing_grading',
      'speaking_transcription',
      'speaking_grading',
    ].includes(job.jobType));
    if (prerequisites.some((job) => ['queued', 'processing', 'retrying'].includes(job.status))) return null;
    if (prerequisites.some((job) => job.status === 'failed')) return null;
    const hasTranscription = prerequisites.some((job) => job.jobType === 'speaking_transcription');
    const speakingCompleted = prerequisites.some(
      (job) => job.jobType === 'speaking_grading' && job.status === 'succeeded',
    );
    if (hasTranscription && !speakingCompleted) return null;
    const existing = jobs.find((job) => job.jobType === 'report_generation');
    if (existing) return null;
    return tx.gradingJob.create({ data: { attemptId, jobType: 'report_generation' } });
  });
  if (reportJob) {
    await gradingQueue.add(
      'report_generation',
      { gradingJobId: reportJob.id, attemptId },
      { jobId: reportJob.id },
    );
  }
}

async function handleReportGeneration(gradingJobId: string, attemptId: string) {
  await markJob(gradingJobId, 'processing');
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { scoreReports: true },
  });
  if (attempt?.status === 'completed' && attempt.scoreReports.some((report) => report.status === 'published')) {
    await markJob(gradingJobId, 'succeeded');
    return;
  }
  await finalizeReport(attemptId);
  await markJob(gradingJobId, 'succeeded');
  await emailQueue.add('report_completed', { attemptId, recipients: ['student', 'teacher'] });
}

async function handleFeedbackTranslation(gradingJobId: string, attemptId: string) {
  await markJob(gradingJobId, 'processing');
  const [report, results] = await Promise.all([
    prisma.scoreReport.findUnique({ where: { attemptId } }),
    prisma.aiGradeResult.findMany({
      where: { attemptId, locale: 'zh-TW', status: { in: ['succeeded', 'manual_review_required'] } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  if (!report) throw new Error('Published report not found for translation');
  const translationInput = results.map((result) => ({
    result_key: result.resultKey,
    skill: result.skill,
    feedback: result.feedbackJson,
  }));
  const translated = await translateFeedback(translationInput);
  const reportJson = asRecord(report.reportJson);
  const feedbackTranslations = asRecord(reportJson.feedback_translations);
  await prisma.scoreReport.update({
    where: { id: report.id },
    data: {
      reportJson: {
        ...reportJson,
        feedback_translations: {
          ...feedbackTranslations,
          en: {
            status: 'succeeded',
            generated_at: new Date().toISOString(),
            model: translated.model,
            prompt_version: PROMPT_VERSION,
            items: translated.result.items,
          },
        },
      } as Prisma.InputJsonValue,
    },
  });
  await markJob(gradingJobId, 'succeeded');
}

async function markEnglishTranslationFailed(attemptId: string, message: string) {
  const report = await prisma.scoreReport.findUnique({ where: { attemptId } });
  if (!report) return;
  const reportJson = asRecord(report.reportJson);
  const feedbackTranslations = asRecord(reportJson.feedback_translations);
  await prisma.scoreReport.update({
    where: { id: report.id },
    data: {
      reportJson: {
        ...reportJson,
        feedback_translations: {
          ...feedbackTranslations,
          en: {
            status: 'failed',
            failed_at: new Date().toISOString(),
            error: message,
          },
        },
      } as Prisma.InputJsonValue,
    },
  });
}

const gradingWorker = new Worker(
  QUEUE_NAMES.grading,
  async (job) => {
    const { gradingJobId, attemptId } = job.data as { gradingJobId: string; attemptId: string };
    try {
      switch (job.name) {
        case 'objective_feedback':
          await handleObjectiveFeedback(gradingJobId, attemptId);
          break;
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
        case 'feedback_translation':
          await handleFeedbackTranslation(gradingJobId, attemptId);
          break;
        default:
          throw new Error(`Unknown grading job name: ${job.name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const row = await prisma.gradingJob.findUnique({ where: { id: gradingJobId } });
      const retryCount = (row?.retryCount ?? 0) + 1;
      const maxAttempts = Math.max(1, job.opts.attempts ?? workerConfig.aiMaxRetries + 1);
      const exhausted = job.attemptsMade + 1 >= maxAttempts;
      await prisma.gradingJob.update({
        where: { id: gradingJobId },
        data: {
          status: exhausted ? 'failed' : 'retrying',
          retryCount,
          errorMessage: message,
        },
      });
      if (exhausted && job.name !== 'feedback_translation') {
        await prisma.attempt.update({ where: { id: attemptId }, data: { status: 'error' } });
      }
      if (exhausted && job.name === 'feedback_translation') {
        await markEnglishTranslationFailed(attemptId, message);
      }
      throw error;
    }
  },
  { connection, concurrency: workerConfig.gradingConcurrency },
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
gradingWorker.on('failed', (job, error) => console.error('Grading job failed', job?.name, error.message));
emailWorker.on('failed', (job, error) => console.error('Email job failed', job?.name, error.message));

console.log(`Worker started (AI_MODE=${workerConfig.aiMode}, PROMPT_VERSION=${PROMPT_VERSION})`);
