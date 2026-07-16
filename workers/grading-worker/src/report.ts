import { prisma, Prisma } from '@toefl/database';
import {
  MOCK_DISCLAIMER,
  PROMPT_VERSION,
  practiceBandToCefr,
  scaledScoreToPracticeBand,
  SCORE_CONVERSION_VERSION,
  speakingCompositeToPracticeBand,
  toScaledScore,
  writingRawToPracticeBand,
} from '@toefl/shared';
import { workerConfig } from './config.js';
import { buildReportHtml, type AiFeedbackSummary } from './pdf-template.js';
import { renderPdfFromHtml } from './pdf-generator.js';

const TASK_LABEL: Record<string, string> = {
  reading_analysis: 'Reading Analysis',
  listening_analysis: 'Listening Analysis',
  writing_email: 'Write an Email',
  writing_academic_discussion: 'Academic Discussion',
  speaking_listen_repeat: 'Listen and Repeat',
  speaking_interview: 'Take an Interview',
};

function extractAiFeedback(
  results: { skill: string; feedbackJson: unknown; overallScore: Prisma.Decimal | number }[],
): AiFeedbackSummary[] {
  return results.map((r) => {
    const feedback = (r.feedbackJson ?? {}) as {
      task_type?: string;
      comments?: { overall?: string };
    };
    const taskType = feedback.task_type ?? r.skill;
    return {
      skill: r.skill as 'reading' | 'listening' | 'writing' | 'speaking',
      taskLabel: TASK_LABEL[taskType] ?? taskType,
      overallScore: Number(r.overallScore),
      overallComment: feedback.comments?.overall,
    };
  });
}

export async function finalizeReport(attemptId: string): Promise<void> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      student: true,
      organization: true,
      assignment: { include: { class: true, assigner: true } },
      examVersion: { include: { examPaper: true } },
      aiGradeResults: true,
      scoreReports: true,
    },
  });
  if (!attempt) throw new Error('Attempt not found');

  const report = attempt.scoreReports[0];
  const existingReportJson = (report?.reportJson ?? {}) as Record<string, unknown>;
  const objectiveStats = (existingReportJson.objective_stats ?? []) as {
    sectionType: string;
    totalQuestions: number;
    correctCount: number;
    rawEarned: number;
    rawMax: number;
    scaledScore: number;
  }[];

  const readingScore = report?.readingScore !== null && report?.readingScore !== undefined
    ? Number(report.readingScore)
    : objectiveStats.find((s) => s.sectionType === 'reading')?.scaledScore ?? null;

  const listeningScore = report?.listeningScore !== null && report?.listeningScore !== undefined
    ? Number(report.listeningScore)
    : objectiveStats.find((s) => s.sectionType === 'listening')?.scaledScore ?? null;

  const acceptedStatuses = new Set(['succeeded', 'manual_review_required']);
  const readingResults = attempt.aiGradeResults.filter((r) => r.skill === 'reading' && acceptedStatuses.has(r.status));
  const listeningResults = attempt.aiGradeResults.filter((r) => r.skill === 'listening' && acceptedStatuses.has(r.status));
  const writingResults = attempt.aiGradeResults.filter((r) => r.skill === 'writing' && acceptedStatuses.has(r.status));
  const speakingResults = attempt.aiGradeResults.filter((r) => r.skill === 'speaking' && acceptedStatuses.has(r.status));

  const avg = (scores: number[]) =>
    scores.length === 0 ? null : Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;

  const writingObjective = objectiveStats.find((stats) => stats.sectionType === 'writing');
  const writingRawEarned = (writingObjective?.rawEarned ?? 0)
    + writingResults.reduce((sum, result) => sum + Number(result.overallScore), 0);
  const writingRawMax = (writingObjective?.rawMax ?? 0) + writingResults.length * 5;
  const writingScore = writingRawMax > 0 ? toScaledScore(writingRawEarned, writingRawMax) : null;

  const speakingTaskType = (result: (typeof speakingResults)[number]) => {
    const feedback = (result.feedbackJson ?? {}) as { task_type?: string };
    return feedback.task_type ?? '';
  };
  const repeatScores = speakingResults
    .filter((result) => speakingTaskType(result) === 'speaking_listen_repeat')
    .map((result) => Number(result.overallScore));
  const interviewScores = speakingResults
    .filter((result) => speakingTaskType(result) === 'speaking_interview')
    .map((result) => Number(result.overallScore));
  const repeatAverage = avg(repeatScores);
  const interviewAverage = avg(interviewScores);
  const speakingComposite = repeatAverage !== null && interviewAverage !== null
    ? (repeatAverage + interviewAverage) / 2
    : repeatAverage ?? interviewAverage;
  const speakingScore = speakingComposite === null ? null : Math.round((speakingComposite / 5) * 30);

  const readingBand = readingScore === null ? null : scaledScoreToPracticeBand(readingScore);
  const listeningBand = listeningScore === null ? null : scaledScoreToPracticeBand(listeningScore);
  const writingBand = writingScore === null ? null : writingRawToPracticeBand(writingRawEarned, writingRawMax);
  const speakingBand = speakingComposite === null ? null : speakingCompositeToPracticeBand(speakingComposite);

  const scoreProfile = {
    conversion_version: SCORE_CONVERSION_VERSION,
    skills: {
      reading: readingScore === null || readingBand === null ? null : {
        score_30: readingScore, band_6: readingBand, cefr: practiceBandToCefr(readingBand),
      },
      listening: listeningScore === null || listeningBand === null ? null : {
        score_30: listeningScore, band_6: listeningBand, cefr: practiceBandToCefr(listeningBand),
      },
      writing: writingScore === null || writingBand === null ? null : {
        score_30: writingScore,
        band_6: writingBand,
        cefr: practiceBandToCefr(writingBand),
        raw_score: Math.round(writingRawEarned * 100) / 100,
        raw_max: writingRawMax,
      },
      speaking: speakingScore === null || speakingBand === null ? null : {
        score_30: speakingScore,
        band_6: speakingBand,
        cefr: practiceBandToCefr(speakingBand),
        repeat_average_5: repeatAverage,
        interview_average_5: interviewAverage,
        composite_5: speakingComposite,
      },
    },
  };

  const parts = [readingScore, listeningScore, writingScore, speakingScore].filter((s) => s !== null) as number[];
  const totalScore = parts.length > 0 ? parts.reduce((a, b) => a + b, 0) : null;
  const completedAt = new Date().toISOString();

  const feedbackLocales = (existingReportJson.feedback_locales ?? {}) as Record<string, unknown>;
  const reportJson = {
    ...existingReportJson,
    disclaimer: MOCK_DISCLAIMER,
    student: { name: attempt.student.name, email: attempt.student.email },
    organization: attempt.organization.name,
    class_name: attempt.assignment.class?.name ?? null,
    teacher_name: attempt.assignment.assigner?.name ?? null,
    exam_title: attempt.examVersion.examPaper.title,
    exam_version: attempt.examVersion.versionNo,
    completed_at: completedAt,
    objective_stats: objectiveStats,
    score_profile: scoreProfile,
    feedback_locales: {
      ...feedbackLocales,
      'zh-TW': { status: 'succeeded', generated_at: completedAt, prompt_version: PROMPT_VERSION },
      en: feedbackLocales.en ?? { status: 'not_requested' },
    },
    ai_results: {
      reading: readingResults.map((r) => ({ result_key: r.resultKey, feedback: r.feedbackJson })),
      listening: listeningResults.map((r) => ({ result_key: r.resultKey, feedback: r.feedbackJson })),
      writing: writingResults.map((r) => ({ item_id: r.examItemId, feedback: r.feedbackJson })),
      speaking: speakingResults.map((r) => ({ item_id: r.examItemId, feedback: r.feedbackJson })),
    },
  };

  const upserted = await prisma.scoreReport.upsert({
    where: { attemptId },
    update: {
      readingScore: readingScore !== null ? new Prisma.Decimal(readingScore) : undefined,
      listeningScore: listeningScore !== null ? new Prisma.Decimal(listeningScore) : undefined,
      writingScore: writingScore !== null ? new Prisma.Decimal(writingScore) : undefined,
      speakingScore: speakingScore !== null ? new Prisma.Decimal(speakingScore) : undefined,
      totalScore: totalScore !== null ? new Prisma.Decimal(totalScore) : undefined,
      reportJson,
      status: 'published',
    },
    create: {
      attemptId,
      studentId: attempt.studentId,
      examVersionId: attempt.examVersionId,
      readingScore: readingScore !== null ? new Prisma.Decimal(readingScore) : null,
      listeningScore: listeningScore !== null ? new Prisma.Decimal(listeningScore) : null,
      writingScore: writingScore !== null ? new Prisma.Decimal(writingScore) : null,
      speakingScore: speakingScore !== null ? new Prisma.Decimal(speakingScore) : null,
      totalScore: totalScore !== null ? new Prisma.Decimal(totalScore) : null,
      reportJson,
      status: 'published',
    },
  });

  const versionCount = await prisma.reportVersion.count({ where: { scoreReportId: upserted.id } });
  const reportVersion = versionCount + 1;

  await prisma.reportVersion.create({
    data: {
      scoreReportId: upserted.id,
      versionNo: reportVersion,
      reportJson: reportJson as object,
      changeReason: 'auto_generated',
    },
  });

  const aiFeedback = extractAiFeedback([
    ...readingResults.map((r) => ({ skill: r.skill, feedbackJson: r.feedbackJson, overallScore: r.overallScore })),
    ...listeningResults.map((r) => ({ skill: r.skill, feedbackJson: r.feedbackJson, overallScore: r.overallScore })),
    ...writingResults.map((r) => ({ skill: r.skill, feedbackJson: r.feedbackJson, overallScore: r.overallScore })),
    ...speakingResults.map((r) => ({ skill: r.skill, feedbackJson: r.feedbackJson, overallScore: r.overallScore })),
  ]);

  const html = buildReportHtml({
    platformName: workerConfig.platformName,
    studentName: attempt.student.name,
    studentEmail: attempt.student.email,
    organization: attempt.organization.name,
    className: attempt.assignment.class?.name ?? null,
    teacherName: attempt.assignment.assigner?.name ?? null,
    examTitle: attempt.examVersion.examPaper.title,
    examVersion: attempt.examVersion.versionNo,
    completedAt,
    scores: {
      reading: readingScore,
      listening: listeningScore,
      writing: writingScore,
      speaking: speakingScore,
      total: totalScore,
    },
    scoreProfile,
    objectiveStats,
    aiFeedback,
    reportVersion,
  });

  const pdfBuffer = await renderPdfFromHtml(html);
  const pdfKey = `reports/${attemptId}/report-v${reportVersion}.pdf`;

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = new S3Client({
    endpoint: workerConfig.s3.endpoint,
    region: workerConfig.s3.region,
    credentials: {
      accessKeyId: workerConfig.s3.accessKey,
      secretAccessKey: workerConfig.s3.secretKey,
    },
    forcePathStyle: workerConfig.s3.forcePathStyle,
  });
  await s3.send(
    new PutObjectCommand({
      Bucket: workerConfig.s3.bucketReports,
      Key: pdfKey,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }),
  );

  await prisma.scoreReport.update({ where: { id: upserted.id }, data: { pdfStorageKey: pdfKey } });

  await prisma.attempt.update({
    where: { id: attemptId },
    data: { status: 'completed', completedAt: new Date() },
  });
}
