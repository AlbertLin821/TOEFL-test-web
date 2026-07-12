import { MOCK_DISCLAIMER } from '@toefl/shared';

export interface ReportPdfScores {
  reading: number | null;
  listening: number | null;
  writing: number | null;
  speaking: number | null;
  total: number | null;
}

export interface AiFeedbackSummary {
  skill: 'writing' | 'speaking';
  taskLabel: string;
  overallScore: number;
  overallComment?: string;
}

export interface ReportPdfInput {
  platformName: string;
  studentName: string;
  studentEmail: string;
  organization: string;
  className: string | null;
  teacherName: string | null;
  examTitle: string;
  examVersion: string;
  completedAt: string;
  scores: ReportPdfScores;
  objectiveStats: { sectionType: string; correctCount: number; totalQuestions: number; scaledScore: number }[];
  aiFeedback: AiFeedbackSummary[];
  reportVersion: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scoreCell(score: number | null): string {
  return score !== null ? `${score} / 30` : 'Pending';
}

export function buildReportHtml(input: ReportPdfInput): string {
  const objectiveRows = input.objectiveStats
    .filter((s) => s.sectionType === 'reading' || s.sectionType === 'listening')
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.sectionType === 'reading' ? 'Reading' : 'Listening')} objective</td><td>${s.correctCount} / ${s.totalQuestions} correct (scaled ${s.scaledScore})</td></tr>`,
    )
    .join('');

  const aiRows = input.aiFeedback
    .map((item) => {
      const comment = item.overallComment ? `<p class="muted">${escapeHtml(item.overallComment)}</p>` : '';
      return `<div class="ai-item"><strong>${escapeHtml(item.taskLabel)}</strong> — ${item.overallScore} / 30${comment}</div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Mock Test Report</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #111827; margin: 0; padding: 32px; font-size: 12px; line-height: 1.5; }
    h1 { font-size: 22px; margin: 0 0 4px; text-align: center; }
    h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .subtitle { text-align: center; font-size: 14px; margin-bottom: 8px; }
    .disclaimer { text-align: center; color: #6b7280; font-size: 10px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    td:first-child { width: 38%; color: #4b5563; font-weight: 600; }
    .scores td:last-child { text-align: right; font-weight: 600; }
    .total td { font-size: 14px; background: #eef2ff; }
    .ai-item { margin-bottom: 10px; }
    .muted { color: #6b7280; margin: 4px 0 0; }
    footer { margin-top: 32px; text-align: center; color: #9ca3af; font-size: 10px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(input.platformName)}</h1>
  <p class="subtitle">Four-Skill English Mock Test Report</p>
  <p class="disclaimer">${escapeHtml(MOCK_DISCLAIMER)}</p>

  <h2>Student Information</h2>
  <table>
    <tr><td>Student Name</td><td>${escapeHtml(input.studentName)}</td></tr>
    <tr><td>Email</td><td>${escapeHtml(input.studentEmail)}</td></tr>
    <tr><td>Organization</td><td>${escapeHtml(input.organization)}</td></tr>
    <tr><td>Class</td><td>${escapeHtml(input.className ?? '-')}</td></tr>
    <tr><td>Teacher</td><td>${escapeHtml(input.teacherName ?? '-')}</td></tr>
    <tr><td>Exam Name</td><td>${escapeHtml(input.examTitle)}</td></tr>
    <tr><td>Exam Version</td><td>${escapeHtml(input.examVersion)}</td></tr>
    <tr><td>Completed At</td><td>${escapeHtml(input.completedAt)}</td></tr>
  </table>

  <h2>Score Overview</h2>
  <table class="scores">
    <tr><td>Reading</td><td>${scoreCell(input.scores.reading)}</td></tr>
    <tr><td>Listening</td><td>${scoreCell(input.scores.listening)}</td></tr>
    <tr><td>Writing</td><td>${scoreCell(input.scores.writing)}</td></tr>
    <tr><td>Speaking</td><td>${scoreCell(input.scores.speaking)}</td></tr>
    <tr class="total"><td>Total</td><td>${input.scores.total !== null ? `${input.scores.total} / 120` : 'Pending'}</td></tr>
  </table>

  ${objectiveRows ? `<h2>Objective Question Stats</h2><table>${objectiveRows}</table>` : ''}
  ${aiRows ? `<h2>AI Feedback Summary</h2>${aiRows}` : ''}

  <footer>Report generated at ${escapeHtml(new Date().toISOString())} — version ${input.reportVersion}</footer>
</body>
</html>`;
}
