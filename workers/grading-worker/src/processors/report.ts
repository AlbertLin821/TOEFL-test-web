import { prisma, Prisma } from '@toefl/database';
import { Queue } from 'bullmq';
import PDFDocument from 'pdfkit';
import { MOCK_DISCLAIMER } from '@toefl/shared';
import { putObject } from '../lib/storage.js';
import { config } from '../config.js';
import type { GradingJobData } from './grading.js';

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export async function processReportGeneration(data: GradingJobData, emailQueue: Queue): Promise<void> {
  const job = await prisma.gradingJob.findUnique({ where: { id: data.gradingJobId } });
  if (!job) throw new Error('Grading job not found');
  await prisma.gradingJob.update({ where: { id: job.id }, data: { status: 'processing' } });

  const attempt = await prisma.attempt.findUnique({
    where: { id: data.attemptId },
    include: {
      student: true,
      organization: true,
      assignment: { include: { class: true, assigner: true } },
      examVersion: { include: { examPaper: true } },
      aiGradeResults: { where: { status: 'succeeded' } },
      scoreReports: true,
    },
  });
  if (!attempt) throw new Error('Attempt not found');
  const report = attempt.scoreReports[0];
  if (!report) throw new Error('Draft report not found');

  const reportJson = (report.reportJson ?? {}) as Record<string, unknown>;
  const objectiveStats = (reportJson.objective_stats ?? []) as {
    sectionType: string;
    scaledScore: number;
  }[];

  const readingScore = report.readingScore !== null ? Number(report.readingScore) : null;
  const listeningScore = report.listeningScore !== null ? Number(report.listeningScore) : null;

  // Writing = average of (Build a Sentence scaled score, each AI writing item score)
  const writingParts: number[] = [];
  const writingObjective = objectiveStats.find((s) => s.sectionType === 'writing');
  if (writingObjective) writingParts.push(writingObjective.scaledScore);
  for (const r of attempt.aiGradeResults.filter((r) => r.skill === 'writing')) {
    writingParts.push(Number(r.overallScore));
  }
  const writingScore = average(writingParts);

  const speakingScores = attempt.aiGradeResults.filter((r) => r.skill === 'speaking').map((r) => Number(r.overallScore));
  const speakingScore = average(speakingScores);

  const totalScore =
    (readingScore ?? 0) + (listeningScore ?? 0) + (writingScore ?? 0) + (speakingScore ?? 0);

  const now = new Date();

  // ---- PDF (simplified first version) ----
  const pdfBuffer = await buildPdf({
    platformName: config.platformName,
    studentName: attempt.student.name,
    studentEmail: attempt.student.email,
    organization: attempt.organization.name,
    className: attempt.assignment.class?.name ?? '-',
    teacherName: attempt.assignment.assigner?.name ?? '-',
    examTitle: attempt.examVersion.examPaper.title,
    examVersion: attempt.examVersion.versionNo,
    completedAt: now.toISOString(),
    scores: {
      reading: readingScore,
      listening: listeningScore,
      writing: writingScore,
      speaking: speakingScore,
      total: totalScore,
    },
  });
  const pdfKey = `reports/${attempt.id}/report-v1.pdf`;
  await putObject(config.s3.bucketReports, pdfKey, pdfBuffer, 'application/pdf');

  await prisma.scoreReport.update({
    where: { id: report.id },
    data: {
      writingScore: writingScore !== null ? new Prisma.Decimal(writingScore) : undefined,
      speakingScore: speakingScore !== null ? new Prisma.Decimal(speakingScore) : undefined,
      totalScore: new Prisma.Decimal(totalScore),
      status: 'published',
      pdfStorageKey: pdfKey,
      reportJson: {
        ...reportJson,
        published_at: now.toISOString(),
        disclaimer: MOCK_DISCLAIMER,
      },
    },
  });

  const versionCount = await prisma.reportVersion.count({ where: { scoreReportId: report.id } });
  await prisma.reportVersion.create({
    data: {
      scoreReportId: report.id,
      versionNo: versionCount + 1,
      reportJson: { published_at: now.toISOString() },
      changeReason: 'report_published',
    },
  });

  await prisma.attempt.update({
    where: { id: attempt.id },
    data: { status: 'completed', completedAt: now },
  });

  await prisma.gradingJob.update({ where: { id: job.id }, data: { status: 'succeeded' } });

  await emailQueue.add('report_completed', {
    attemptId: attempt.id,
    recipients: ['student', 'teacher'],
  });
}

interface PdfInput {
  platformName: string;
  studentName: string;
  studentEmail: string;
  organization: string;
  className: string;
  teacherName: string;
  examTitle: string;
  examVersion: string;
  completedAt: string;
  scores: {
    reading: number | null;
    listening: number | null;
    writing: number | null;
    speaking: number | null;
    total: number;
  };
}

function buildPdf(input: PdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(input.platformName, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).text('Four-Skill English Mock Test Report', { align: 'center' });
    doc.moveDown(0.25);
    doc.fontSize(9).fillColor('#666666').text(MOCK_DISCLAIMER, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1.5);

    doc.fontSize(11);
    const info: [string, string][] = [
      ['Student Name', input.studentName],
      ['Email', input.studentEmail],
      ['Organization', input.organization],
      ['Class', input.className],
      ['Teacher', input.teacherName],
      ['Exam Name', input.examTitle],
      ['Exam Version', input.examVersion],
      ['Completed At', input.completedAt],
    ];
    for (const [label, value] of info) {
      doc.text(`${label}: ${value}`);
    }

    doc.moveDown(1.5);
    doc.fontSize(13).text('Score Overview');
    doc.moveDown(0.5);
    doc.fontSize(11);
    const scores: [string, string][] = [
      ['Reading', input.scores.reading !== null ? `${input.scores.reading} / 30` : 'Pending'],
      ['Listening', input.scores.listening !== null ? `${input.scores.listening} / 30` : 'Pending'],
      ['Writing', input.scores.writing !== null ? `${input.scores.writing} / 30` : 'Pending'],
      ['Speaking', input.scores.speaking !== null ? `${input.scores.speaking} / 30` : 'Pending'],
      ['Total', `${input.scores.total} / 120`],
    ];
    for (const [label, value] of scores) {
      doc.text(`${label}: ${value}`);
    }

    doc.moveDown(2);
    doc
      .fontSize(9)
      .fillColor('#666666')
      .text(`Report generated at ${new Date().toISOString()} - Report version 1`, { align: 'center' });

    doc.end();
  });
}
