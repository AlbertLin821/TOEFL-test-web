import { prisma, Prisma } from '@toefl/database';
import {
  scoreFillBlank,
  scoreSentenceOrder,
  scoreSingleChoice,
  toScaledScore,
} from '@toefl/shared';

export interface ObjectiveSectionStats {
  sectionType: string;
  totalQuestions: number;
  correctCount: number;
  rawEarned: number;
  rawMax: number;
  scaledScore: number;
}

/**
 * Scores all auto-graded items of an attempt and stores per-response results.
 * Returns per-section statistics for reading/listening/writing(auto part).
 */
export async function scoreObjectiveItems(attemptId: string): Promise<ObjectiveSectionStats[]> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      examVersion: {
        include: {
          sections: {
            include: {
              modules: {
                include: {
                  items: { include: { answerKeys: true } },
                },
              },
            },
          },
        },
      },
      responses: true,
    },
  });
  if (!attempt) throw new Error('Attempt not found');

  const responseByItem = new Map(attempt.responses.map((r) => [r.examItemId, r]));
  const stats: ObjectiveSectionStats[] = [];

  for (const section of attempt.examVersion.sections) {
    let rawEarned = 0;
    let rawMax = 0;
    let totalQuestions = 0;
    let correctCount = 0;

    for (const mod of section.modules) {
      for (const item of mod.items) {
        if (item.gradingType !== 'auto') continue;
        const key = item.answerKeys[0]?.answerJson as Record<string, unknown> | undefined;
        if (!key) continue;
        const scoreMax = Number(item.scoreMax);
        rawMax += scoreMax;
        const response = responseByItem.get(item.id);
        const responseJson = (response?.responseJson ?? null) as Record<string, unknown> | null;

        let isCorrect = false;
        let awarded = 0;

        if (item.itemType.endsWith('single_choice')) {
          const r = scoreSingleChoice(
            key as { correct_option_index: number },
            responseJson as { selected_option_index?: number } | null,
            scoreMax,
          );
          isCorrect = r.isCorrect;
          awarded = r.scoreAwarded;
          totalQuestions += 1;
          if (isCorrect) correctCount += 1;
        } else if (item.itemType === 'reading_fill_blank') {
          const r = scoreFillBlank(
            key as { answers: string[][]; case_sensitive?: boolean },
            responseJson as { blanks?: string[] } | null,
            scoreMax,
          );
          isCorrect = r.isCorrect;
          awarded = r.scoreAwarded;
          totalQuestions += r.totalBlanks;
          correctCount += r.correctBlanks;
        } else if (item.itemType === 'writing_sentence_order') {
          const r = scoreSentenceOrder(
            key as { correct_order: string[]; accepted_sentences?: string[] },
            responseJson as { ordered_tokens?: string[] } | null,
            scoreMax,
          );
          isCorrect = r.isCorrect;
          awarded = r.scoreAwarded;
          totalQuestions += 1;
          if (isCorrect) correctCount += 1;
        } else {
          continue;
        }

        rawEarned += awarded;
        if (response) {
          await prisma.response.update({
            where: { id: response.id },
            data: { isCorrect, scoreAwarded: new Prisma.Decimal(awarded) },
          });
        } else {
          await prisma.response.create({
            data: {
              attemptId,
              examItemId: item.id,
              responseJson: Prisma.JsonNull,
              isCorrect: false,
              scoreAwarded: new Prisma.Decimal(0),
            },
          });
        }
      }
    }

    if (rawMax > 0) {
      stats.push({
        sectionType: section.sectionType,
        totalQuestions,
        correctCount,
        rawEarned,
        rawMax,
        scaledScore: toScaledScore(rawEarned, rawMax),
      });
    }
  }

  return stats;
}
