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
      scoreProfile: {
        conversion_version: 'practice-v2.0',
        skills: {
          reading: { score_30: 24, band_6: 5, cefr: 'C1' },
          listening: { score_30: 23, band_6: 4.5, cefr: 'B2' },
          writing: { score_30: 22, band_6: 4.5, cefr: 'B2' },
          speaking: { score_30: 21, band_6: 4.5, cefr: 'B2' },
        },
      },
      objectiveStats: [
        { sectionType: 'reading', correctCount: 18, totalQuestions: 20, scaledScore: 24 },
      ],
      aiFeedback: [
        {
          skill: 'writing',
          taskLabel: 'Write an Email',
          overallScore: 4,
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
