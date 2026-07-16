import { describe, expect, it } from 'vitest';
import {
  practiceBandToCefr,
  scoreFillBlank,
  scoreSentenceOrder,
  scoreSingleChoice,
  scaledScoreToPracticeBand,
  speakingCompositeToPracticeBand,
  toScaledScore,
  writingRawToPracticeBand,
} from '../src/scoring.js';
import { constructedGradeBatchSchema } from '../src/ai-schema.js';

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

describe('practice score conversions', () => {
  it('converts 0-30 scores to the practice 1-6 band', () => {
    expect(scaledScoreToPracticeBand(0)).toBe(1);
    expect(scaledScoreToPracticeBand(3)).toBe(1.5);
    expect(scaledScoreToPracticeBand(27)).toBe(5.5);
    expect(scaledScoreToPracticeBand(30)).toBe(6);
  });

  it('uses the Writing raw-20 conversion from the prompt', () => {
    expect(writingRawToPracticeBand(0)).toBe(1);
    expect(writingRawToPracticeBand(10)).toBe(3.5);
    expect(writingRawToPracticeBand(18)).toBe(5.5);
    expect(writingRawToPracticeBand(20)).toBe(6);
  });

  it('uses the Speaking composite conversion from the prompt', () => {
    expect(speakingCompositeToPracticeBand(0.24)).toBe(1);
    expect(speakingCompositeToPracticeBand(0.25)).toBe(1.5);
    expect(speakingCompositeToPracticeBand(4.75)).toBe(6);
  });

  it('maps practice bands to CEFR levels', () => {
    expect(practiceBandToCefr(1.5)).toBe('A1');
    expect(practiceBandToCefr(2.5)).toBe('A2');
    expect(practiceBandToCefr(4.5)).toBe('B2');
    expect(practiceBandToCefr(6)).toBe('C2');
  });
});

describe('constructedGradeBatchSchema', () => {
  it('validates mock AI output', () => {
    const parsed = constructedGradeBatchSchema.parse({
      items: [{
        item_id: 'item-1',
        task_type: 'writing_email',
        item_score: 4,
        rubric_scores: [{ criterion: 'task_fulfillment', score: 4, comment: '完成主要要求' }],
        overall_comment: '整體表現良好。',
        strengths: [],
        weaknesses: [],
        improvement_suggestions: [],
        confidence_flag: 'normal',
        evidence_flags: [],
      }],
    });
    expect(parsed.items[0].item_score).toBe(4);
  });
});
