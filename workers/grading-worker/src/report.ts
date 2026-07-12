import { prisma, Prisma } from '@toefl/database';
import { MOCK_DISCLAIMER } from '@toefl/shared';
import { workerConfig } from './config.js';
import { buildReportHtml, type AiFeedbackSummary } from './pdf-template.js';
import { renderPdfFromHtml } from './pdf-generator.js';

const TASK_LABEL: Record<string, string> = {
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
      skill: r.skill as 'writing' | 'speaking',
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
  const objectiveStats = ((report?.reportJson as Record<string, unknown>)?.objective_stats ?? []) as {
    sectionType: string;
    totalQuestions: number;
    correctCount: number;
    scaledScore: number;
  }[];

  const readingScore = report?.readingScore !== null && report?.readingScore !== undefined
    ? Number(report.readingScore)
    : objectiveStats.find((s) => s.sectionType === 'reading')?.scaledScore ?? null;

  const listeningScore = report?.listeningScore !== null && report?.listeningScore !== undefined
    ? Number(report.listeningScore)
    : objectiveStats.find((s) => s.sectionType === 'listening')?.scaledScore ?? null;

  const writingResults = attempt.aiGradeResults.filter((r) => r.skill === 'writing' && r.status === 'succeeded');
  const speakingResults = attempt.aiGradeResults.filter((r) => r.skill === 'speaking' && r.status === 'succeeded');

  const avg = (scores: number[]) =>
    scores.length === 0 ? null : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const writingScore = avg(writingResults.map((r) => Number(r.overallScore)));
  const speakingScore = avg(speakingResults.map((r) => Number(r.overallScore)));

  const parts = [readingScore, listeningScore, writingScore, speakingScore].filter((s) => s !== null) as number[];
  const totalScore = parts.length > 0 ? parts.reduce((a, b) => a + b, 0) : null;
  const completedAt = new Date().toISOString();

  const reportJson = {
    disclaimer: MOCK_DISCLAIMER,
    student: { name: attempt.student.name, email: attempt.student.email },
    organization: attempt.organization.name,
    class_name: attempt.assignment.class?.name ?? null,
    teacher_name: attempt.assignment.assigner?.name ?? null,
    exam_title: attempt.examVersion.examPaper.title,
    exam_version: attempt.examVersion.versionNo,
    completed_at: completedAt,
    objective_stats: objectiveStats,
    ai_results: {
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
