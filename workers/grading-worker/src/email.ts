import nodemailer from 'nodemailer';
import { prisma } from '@toefl/database';
import { MOCK_DISCLAIMER } from '@toefl/shared';
import { workerConfig } from './config.js';

const transporter = nodemailer.createTransport({
  host: workerConfig.smtp.host,
  port: workerConfig.smtp.port,
  secure: false,
  auth: workerConfig.smtp.user ? { user: workerConfig.smtp.user, pass: workerConfig.smtp.pass } : undefined,
});

export async function sendReportEmails(attemptId: string, recipients: ('student' | 'teacher')[]): Promise<void> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      student: true,
      scoreReports: true,
      assignment: { include: { assigner: true, examVersion: { include: { examPaper: true } } } },
    },
  });
  if (!attempt?.scoreReports[0]) return;
  const report = attempt.scoreReports[0];
  const reportUrl = `${workerConfig.webUrl}/reports/${attemptId}`;

  const targets: { email: string; name: string; template: string; subject: string; body: string }[] = [];

  if (recipients.includes('student')) {
    targets.push({
      email: attempt.student.email,
      name: attempt.student.name,
      template: 'report_completed_student',
      subject: '[模擬考結果] 你的四技能測驗報告已完成',
      body: buildStudentEmail(attempt.student.name, attempt.assignment.examVersion.examPaper.title, report, reportUrl),
    });
  }
  if (recipients.includes('teacher') && attempt.assignment.assigner) {
    targets.push({
      email: attempt.assignment.assigner.email,
      name: attempt.assignment.assigner.name,
      template: 'report_completed_teacher',
      subject: `[學生模考完成] ${attempt.student.name} 的四技能測驗報告已完成`,
      body: buildTeacherEmail(
        attempt.assignment.assigner.name,
        attempt.student.name,
        attempt.assignment.examVersion.examPaper.title,
        report,
        reportUrl,
      ),
    });
  }

  for (const t of targets) {
    const log = await prisma.emailLog.create({
      data: {
        organizationId: attempt.organizationId,
        toEmail: t.email,
        subject: t.subject,
        templateKey: t.template,
        status: 'queued',
        metadataJson: { attempt_id: attemptId },
      },
    });
    try {
      await transporter.sendMail({
        from: workerConfig.smtp.from,
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

function buildStudentEmail(
  studentName: string,
  examTitle: string,
  report: { readingScore: unknown; listeningScore: unknown; writingScore: unknown; speakingScore: unknown; totalScore: unknown },
  reportUrl: string,
): string {
  return [
    `Hi ${studentName},`,
    '',
    '你的四技能英語模擬測驗報告已完成。',
    '',
    `考試名稱：${examTitle}`,
    '',
    '成績摘要：',
    `Reading：${report.readingScore ?? '批改中'}`,
    `Listening：${report.listeningScore ?? '批改中'}`,
    `Writing：${report.writingScore ?? '批改中'}`,
    `Speaking：${report.speakingScore ?? '批改中'}`,
    `Total：${report.totalScore ?? '批改中'}`,
    '',
    `查看完整報告：${reportUrl}`,
    '',
    `提醒：${MOCK_DISCLAIMER}`,
    '',
    workerConfig.platformName,
  ].join('\n');
}

function buildTeacherEmail(
  teacherName: string,
  studentName: string,
  examTitle: string,
  report: { readingScore: unknown; listeningScore: unknown; writingScore: unknown; speakingScore: unknown; totalScore: unknown },
  reportUrl: string,
): string {
  return [
    `Hi ${teacherName},`,
    '',
    `${studentName} 已完成 ${examTitle}，報告已產生。`,
    '',
    '成績摘要：',
    `Reading：${report.readingScore ?? '批改中'}`,
    `Listening：${report.listeningScore ?? '批改中'}`,
    `Writing：${report.writingScore ?? '批改中'}`,
    `Speaking：${report.speakingScore ?? '批改中'}`,
    `Total：${report.totalScore ?? '批改中'}`,
    '',
    `查看學生報告：${reportUrl}`,
    '',
    workerConfig.platformName,
  ].join('\n');
}
