import { prisma } from '@toefl/database';
import nodemailer from 'nodemailer';
import { config } from '../config.js';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false,
  auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
});

export interface EmailJobData {
  attemptId: string;
  recipients: ('student' | 'teacher')[];
}

export async function processReportEmail(data: EmailJobData): Promise<void> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: data.attemptId },
    include: {
      student: true,
      organization: true,
      assignment: { include: { class: true, assigner: true } },
      examVersion: { include: { examPaper: true } },
      scoreReports: true,
    },
  });
  if (!attempt) throw new Error('Attempt not found');
  const report = attempt.scoreReports[0];
  if (!report || report.status !== 'published') throw new Error('Report not published');

  const reportUrl = `${config.webUrl}/reports/${attempt.id}`;
  const scores = {
    reading: report.readingScore !== null ? Number(report.readingScore) : '-',
    listening: report.listeningScore !== null ? Number(report.listeningScore) : '-',
    writing: report.writingScore !== null ? Number(report.writingScore) : '-',
    speaking: report.speakingScore !== null ? Number(report.speakingScore) : '-',
    total: report.totalScore !== null ? Number(report.totalScore) : '-',
  };
  const scoreBlock = `成績摘要：
Reading：${scores.reading}
Listening：${scores.listening}
Writing：${scores.writing}
Speaking：${scores.speaking}
Total：${scores.total}`;

  const targets: { email: string; subject: string; body: string; templateKey: string }[] = [];

  if (data.recipients.includes('student')) {
    // Avoid duplicate sends for the same report + recipient
    const already = await prisma.emailLog.findFirst({
      where: { toEmail: attempt.student.email, templateKey: 'report_completed_student', status: 'sent', metadataJson: { path: ['attempt_id'], equals: attempt.id } },
    });
    if (!already) {
      targets.push({
        email: attempt.student.email,
        subject: '[模擬考結果] 你的四技能測驗報告已完成',
        templateKey: 'report_completed_student',
        body: `Hi ${attempt.student.name},

你的四技能英語模擬測驗報告已完成。

考試名稱：${attempt.examVersion.examPaper.title}
完成時間：${attempt.completedAt?.toISOString() ?? ''}

${scoreBlock}

查看完整報告：
${reportUrl}

提醒：此報告為模擬測驗結果，並非 ETS 官方 TOEFL 成績。

${config.platformName}`,
      });
    }
  }

  const teacher = attempt.assignment.assigner;
  if (data.recipients.includes('teacher') && teacher) {
    const already = await prisma.emailLog.findFirst({
      where: { toEmail: teacher.email, templateKey: 'report_completed_teacher', status: 'sent', metadataJson: { path: ['attempt_id'], equals: attempt.id } },
    });
    if (!already) {
      targets.push({
        email: teacher.email,
        subject: `[學生模考完成] ${attempt.student.name} 的四技能測驗報告已完成`,
        templateKey: 'report_completed_teacher',
        body: `Hi ${teacher.name},

${attempt.student.name} 已完成 ${attempt.examVersion.examPaper.title}，報告已產生。

班級：${attempt.assignment.class?.name ?? '-'}

${scoreBlock}

查看學生報告：
${reportUrl}

此報告為模擬測驗結果，並非 ETS 官方 TOEFL 成績。

${config.platformName}`,
      });
    }
  }

  for (const t of targets) {
    const log = await prisma.emailLog.create({
      data: {
        organizationId: attempt.organizationId,
        toEmail: t.email,
        subject: t.subject,
        templateKey: t.templateKey,
        status: 'queued',
        metadataJson: { attempt_id: attempt.id },
      },
    });
    try {
      await transporter.sendMail({
        from: config.emailFrom,
        to: t.email,
        subject: t.subject,
        text: t.body,
      });
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: 'sent', sentAt: new Date() },
      });
    } catch (e) {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: 'failed', errorMessage: e instanceof Error ? e.message : String(e) },
      });
      throw e;
    }
  }
}
