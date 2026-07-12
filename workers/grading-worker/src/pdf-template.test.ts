import { describe, expect, it } from 'vitest';
import { buildReportHtml } from './pdf-template.js';

describe('buildReportHtml', () => {
  it('includes disclaimer and score overview', () => {
    const html = buildReportHtml({
      platformName: 'Demo Platform',
      studentName: 'Test Student',
      studentEmail: 'student@test.local',
      organization: 'Demo Org',
      className: 'Class A',
      teacherName: 'Teacher',
      examTitle: 'Mock Test 01',
      examVersion: 'v1.0',
      completedAt: '2026-07-07T12:00:00.000Z',
      scores: { reading: 24, listening: 23, writing: 22, speaking: 21, total: 90 },
      objectiveStats: [
        { sectionType: 'reading', correctCount: 18, totalQuestions: 20, scaledScore: 24 },
      ],
      aiFeedback: [
        {
          skill: 'writing',
          taskLabel: 'Write an Email',
          overallScore: 22,
          overallComment: 'Good structure.',
        },
      ],
      reportVersion: 1,
    });

    expect(html).toContain('mock test report');
    expect(html).toContain('24 / 30');
    expect(html).toContain('90 / 120');
    expect(html).toContain('Write an Email');
  });
});
