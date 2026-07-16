import { SCORE_SCALE_MAX } from './constants.js';

export interface AutoScoreResult {
  isCorrect: boolean;
  scoreAwarded: number;
}

/** Single choice: answerKey = { correct_option_index: number } ; response = { selected_option_index: number } */
export function scoreSingleChoice(
  answerKey: { correct_option_index: number },
  response: { selected_option_index?: number | null } | null | undefined,
  scoreMax: number,
): AutoScoreResult {
  const selected = response?.selected_option_index;
  const isCorrect = selected !== null && selected !== undefined && selected === answerKey.correct_option_index;
  return { isCorrect, scoreAwarded: isCorrect ? scoreMax : 0 };
}

/** Fill blank: answerKey = { answers: string[][] } (per-blank accepted answers); response = { blanks: string[] } */
export function scoreFillBlank(
  answerKey: { answers: string[][]; case_sensitive?: boolean },
  response: { blanks?: (string | null)[] } | null | undefined,
  scoreMax: number,
): AutoScoreResult & { correctBlanks: number; totalBlanks: number } {
  const totalBlanks = answerKey.answers.length;
  const blanks = response?.blanks ?? [];
  let correctBlanks = 0;
  for (let i = 0; i < totalBlanks; i++) {
    const given = (blanks[i] ?? '').trim();
    const accepted = answerKey.answers[i] ?? [];
    const match = accepted.some((a) =>
      answerKey.case_sensitive ? a.trim() === given : a.trim().toLowerCase() === given.toLowerCase(),
    );
    if (match) correctBlanks++;
  }
  const ratio = totalBlanks === 0 ? 0 : correctBlanks / totalBlanks;
  return {
    isCorrect: correctBlanks === totalBlanks && totalBlanks > 0,
    scoreAwarded: round2(ratio * scoreMax),
    correctBlanks,
    totalBlanks,
  };
}

/** Sentence order (Build a Sentence): answerKey = { correct_order: string[] }; response = { ordered_tokens: string[] } */
export function scoreSentenceOrder(
  answerKey: { correct_order: string[]; accepted_sentences?: string[] },
  response: { ordered_tokens?: string[] } | null | undefined,
  scoreMax: number,
): AutoScoreResult {
  const tokens = response?.ordered_tokens ?? [];
  const normalize = (arr: string[]) => arr.map((t) => t.trim().toLowerCase()).join(' ');
  const given = normalize(tokens);
  let isCorrect = given.length > 0 && given === normalize(answerKey.correct_order);
  if (!isCorrect && answerKey.accepted_sentences) {
    const givenSentence = given.replace(/\s+/g, ' ');
    isCorrect = answerKey.accepted_sentences.some(
      (s) => s.trim().toLowerCase().replace(/[.?!]$/, '').replace(/\s+/g, ' ') === givenSentence.replace(/[.?!]$/, ''),
    );
  }
  return { isCorrect, scoreAwarded: isCorrect ? scoreMax : 0 };
}

/** Convert raw points earned to the 0-30 scale, linear mapping. */
export function toScaledScore(rawEarned: number, rawMax: number): number {
  if (rawMax <= 0) return 0;
  const scaled = (rawEarned / rawMax) * SCORE_SCALE_MAX;
  return Math.round(Math.min(SCORE_SCALE_MAX, Math.max(0, scaled)));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Practice-only 0-30 to 1-6 conversion used for Reading and Listening.
 * The AI never performs this conversion; it is kept deterministic and versioned.
 */
export function scaledScoreToPracticeBand(score: number): number {
  const normalized = Math.min(30, Math.max(0, score));
  if (normalized >= 30) return 6;
  if (normalized >= 27) return 5.5;
  if (normalized >= 24) return 5;
  if (normalized >= 21) return 4.5;
  if (normalized >= 18) return 4;
  if (normalized >= 15) return 3.5;
  if (normalized >= 12) return 3;
  if (normalized >= 9) return 2.5;
  if (normalized >= 6) return 2;
  if (normalized >= 3) return 1.5;
  return 1;
}

/** Cosmos practice conversion from the Writing prompt (raw maximum 20). */
export function writingRawToPracticeBand(rawScore: number, rawMax = 20): number {
  if (rawMax <= 0) return 1;
  const normalized = Math.min(20, Math.max(0, (rawScore / rawMax) * 20));
  if (normalized >= 20) return 6;
  if (normalized >= 18) return 5.5;
  if (normalized >= 16) return 5;
  if (normalized >= 14) return 4.5;
  if (normalized >= 12) return 4;
  if (normalized >= 10) return 3.5;
  if (normalized >= 8) return 3;
  if (normalized >= 6) return 2.5;
  if (normalized >= 4) return 2;
  if (normalized >= 2) return 1.5;
  return 1;
}

/** Speaking prompt conversion based on the 0-5 composite average. */
export function speakingCompositeToPracticeBand(composite: number): number {
  const normalized = Math.min(5, Math.max(0, composite));
  if (normalized >= 4.75) return 6;
  if (normalized >= 4.25) return 5.5;
  if (normalized >= 3.75) return 5;
  if (normalized >= 3.25) return 4.5;
  if (normalized >= 2.75) return 4;
  if (normalized >= 2.25) return 3.5;
  if (normalized >= 1.75) return 3;
  if (normalized >= 1.25) return 2.5;
  if (normalized >= 0.75) return 2;
  if (normalized >= 0.25) return 1.5;
  return 1;
}

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export function practiceBandToCefr(band: number): CefrLevel {
  if (band >= 6) return 'C2';
  if (band >= 5) return 'C1';
  if (band >= 4) return 'B2';
  if (band >= 3) return 'B1';
  if (band >= 2) return 'A2';
  return 'A1';
}
