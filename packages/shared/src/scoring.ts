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
