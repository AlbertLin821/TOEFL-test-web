import { z } from 'zod';

export const acousticAssessmentSchema = z.object({
  intelligibility_score: z.number().min(0).max(100),
  rhythm_score: z.number().min(0).max(100),
  pausing_score: z.number().min(0).max(100),
  prosody_score: z.number().min(0).max(100),
  speech_rate: z.enum(['slow', 'appropriate', 'fast', 'variable', 'unknown']),
  filler_count_estimate: z.number().int().min(0),
  observations: z.object({
    intelligibility: z.string(),
    rhythm: z.string(),
    pausing: z.string(),
    prosody: z.string(),
  }).strict(),
  possible_word_level_issues: z.array(z.object({
    reference_word: z.string(),
    heard_as: z.string(),
    observation: z.string(),
    confidence: z.enum(['low', 'medium', 'high']),
  }).strict()).max(5),
  confidence: z.enum(['low', 'medium', 'high']),
  evidence_flags: z.array(z.string()),
}).strict();

export type AcousticAssessment = z.infer<typeof acousticAssessmentSchema>;

export interface AcousticEvidence {
  provider: 'openai_gpt_audio' | 'mock';
  status: 'succeeded' | 'skipped_low_quality';
  model: string;
  assessment: AcousticAssessment | null;
  token_usage: { input: number; output: number };
  warnings: string[];
}

export const ACOUSTIC_ASSESSMENT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intelligibility_score: { type: 'number', minimum: 0, maximum: 100 },
    rhythm_score: { type: 'number', minimum: 0, maximum: 100 },
    pausing_score: { type: 'number', minimum: 0, maximum: 100 },
    prosody_score: { type: 'number', minimum: 0, maximum: 100 },
    speech_rate: { type: 'string', enum: ['slow', 'appropriate', 'fast', 'variable', 'unknown'] },
    filler_count_estimate: { type: 'integer', minimum: 0 },
    observations: {
      type: 'object',
      additionalProperties: false,
      properties: {
        intelligibility: { type: 'string' },
        rhythm: { type: 'string' },
        pausing: { type: 'string' },
        prosody: { type: 'string' },
      },
      required: ['intelligibility', 'rhythm', 'pausing', 'prosody'],
    },
    possible_word_level_issues: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          reference_word: { type: 'string' },
          heard_as: { type: 'string' },
          observation: { type: 'string' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['reference_word', 'heard_as', 'observation', 'confidence'],
      },
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    evidence_flags: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'intelligibility_score',
    'rhythm_score',
    'pausing_score',
    'prosody_score',
    'speech_rate',
    'filler_count_estimate',
    'observations',
    'possible_word_level_issues',
    'confidence',
    'evidence_flags',
  ],
} as const;

export function mockAcousticEvidence(): AcousticEvidence {
  return {
    provider: 'mock',
    status: 'succeeded',
    model: 'mock-audio',
    assessment: {
      intelligibility_score: 76,
      rhythm_score: 72,
      pausing_score: 70,
      prosody_score: 71,
      speech_rate: 'appropriate',
      filler_count_estimate: 1,
      observations: {
        intelligibility: '本機模擬聲學觀察。',
        rhythm: '本機模擬聲學觀察。',
        pausing: '本機模擬聲學觀察。',
        prosody: '本機模擬聲學觀察。',
      },
      possible_word_level_issues: [],
      confidence: 'medium',
      evidence_flags: ['mock_acoustic_evidence'],
    },
    token_usage: { input: 0, output: 0 },
    warnings: ['mock_acoustic_evidence'],
  };
}

export function skippedAcousticEvidence(model: string, qualityFlags: string[]): AcousticEvidence {
  return {
    provider: 'openai_gpt_audio',
    status: 'skipped_low_quality',
    model,
    assessment: null,
    token_usage: { input: 0, output: 0 },
    warnings: qualityFlags,
  };
}
