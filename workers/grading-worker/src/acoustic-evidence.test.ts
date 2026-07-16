import { describe, expect, it } from 'vitest';
import {
  acousticAssessmentSchema,
  mockAcousticEvidence,
  skippedAcousticEvidence,
} from './acoustic-evidence.js';

describe('acoustic evidence', () => {
  it('accepts the evidence-only assessment shape', () => {
    const evidence = mockAcousticEvidence();

    expect(evidence.status).toBe('succeeded');
    expect(acousticAssessmentSchema.parse(evidence.assessment).intelligibility_score).toBe(76);
  });

  it('rejects out-of-range evidence scores', () => {
    const assessment = mockAcousticEvidence().assessment!;

    expect(() => acousticAssessmentSchema.parse({ ...assessment, prosody_score: 101 })).toThrow();
  });

  it('skips the model for recordings with no usable speech', () => {
    const evidence = skippedAcousticEvidence('gpt-audio-1.5', ['mostly_silence']);

    expect(evidence).toMatchObject({
      provider: 'openai_gpt_audio',
      status: 'skipped_low_quality',
      assessment: null,
      warnings: ['mostly_silence'],
    });
  });
});
