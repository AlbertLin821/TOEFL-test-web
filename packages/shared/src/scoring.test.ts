import { describe, expect, it } from 'vitest';
import { scoreFillBlank, scoreSentenceOrder, scoreSingleChoice, toScaledScore } from '../src/scoring.js';
import { aiGradeResultSchema } from '../src/ai-schema.js';

describe('scoreSingleChoice', () => {
  it('marks correct answer', () => {
    const r = scoreSingleChoice({ correct_option_index: 1 }, { selected_option_index: 1 }, 1);
    expect(r.isCorrect).toBe(true);
    expect(r.scoreAwarded).toBe(1);
  });

  it('marks wrong answer', () => {
    const r = scoreSingleChoice({ correct_option_index: 2 }, { selected_option_index: 0 }, 1);
    expect(r.isCorrect).toBe(false);
    expect(r.scoreAwarded).toBe(0);
  });
});

describe('scoreSentenceOrder', () => {
  it('accepts correct token order', () => {
    const r = scoreSentenceOrder(
      { correct_order: ['he', 'wanted', 'to know'] },
      { ordered_tokens: ['he', 'wanted', 'to know'] },
      1,
    );
    expect(r.isCorrect).toBe(true);
  });
});

describe('scoreFillBlank', () => {
  it('scores partial blanks', () => {
    const r = scoreFillBlank({ answers: [['ey'], ['ticated']] }, { blanks: ['ey', 'wrong'] }, 2);
    expect(r.correctBlanks).toBe(1);
    expect(r.scoreAwarded).toBe(1);
  });
});

describe('toScaledScore', () => {
  it('maps linearly to 0-30', () => {
    expect(toScaledScore(15, 30)).toBe(15);
    expect(toScaledScore(30, 30)).toBe(30);
  });
});

describe('aiGradeResultSchema', () => {
  it('validates mock AI output', () => {
    const parsed = aiGradeResultSchema.parse({
      skill: 'writing',
      task_type: 'writing_email',
      overall_score: 22,
      score_scale: '0-30',
      rubric_scores: { task_fulfillment: 4 },
      comments: { overall: 'Good' },
      strengths: [],
      weaknesses: [],
      improvement_suggestions: [],
      confidence_flag: 'normal',
    });
    expect(parsed.overall_score).toBe(22);
  });
});
