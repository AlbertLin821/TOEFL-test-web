import { prisma, Prisma } from '@toefl/database';
import {
  type ObjectiveItemResult,
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
  itemResults: ObjectiveItemResult[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function inferSkillTags(sectionType: string, questionText: string, questionNo: number): string[] {
  if (sectionType === 'listening' && questionNo <= 8) return ['appropriate_response'];
  const text = questionText.toLowerCase();
  if (text.includes('main purpose') || text.includes('main topic') || text.includes('mainly about')) return ['main_idea'];
  if (text.includes('infer') || text.includes('imply') || text.includes('indicate')) return ['inference'];
  if (text.includes('closest in meaning')) return ['vocabulary_in_context'];
  if (text.includes('why') && text.includes('mention')) return ['speaker_or_author_purpose'];
  if (text.includes('not mentioned') || text.includes('according to')) return ['detail'];
  if (text.includes('next')) return ['organization_and_prediction'];
  return ['detail_and_comprehension'];
}

function categoryFor(sectionType: string, questionNo: number): string {
  if (sectionType === 'reading') {
    if (questionNo <= 10) return 'complete_the_words';
    if (questionNo <= 15) return 'campus_context';
    return 'academic_reading';
  }
  if (sectionType === 'listening') {
    if (questionNo <= 8) return 'best_responses';
    if (questionNo <= 12) return 'campus_conversations';
    if (questionNo <= 14) return 'campus_announcements';
    return 'academic_talks';
  }
  return 'build_a_sentence';
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
    const itemResults: ObjectiveItemResult[] = [];

    const modules = [...section.modules].sort((a, b) => a.orderNo - b.orderNo);
    for (const mod of modules) {
      const items = [...mod.items].sort((a, b) => a.orderNo - b.orderNo);
      for (const item of items) {
        if (item.gradingType !== 'auto') continue;
        const key = item.answerKeys[0]?.answerJson as Record<string, unknown> | undefined;
        if (!key) continue;
        const content = asRecord(item.contentJson);
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

          const questionNo = Number(content.question_number ?? item.orderNo);
          const options = Array.isArray(content.options) ? content.options.map(String) : [];
          const selectedIndex = Number((responseJson as { selected_option_index?: number } | null)?.selected_option_index);
          const correctIndex = Number(key.correct_option_index);
          const questionText = typeof content.question_text === 'string' ? content.question_text : '';
          itemResults.push({
            item_id: item.id,
            item_label: `M${mod.orderNo}-Q${questionNo}`,
            section_type: section.sectionType as 'reading' | 'listening' | 'writing',
            module_no: mod.orderNo,
            module_title: mod.title,
            question_no: questionNo,
            task_type: item.itemType,
            category_key: categoryFor(section.sectionType, questionNo),
            skill_tags: Array.isArray(content.skill_tags)
              ? content.skill_tags.map(String)
              : inferSkillTags(section.sectionType, questionText, questionNo),
            student_answer: Number.isInteger(selectedIndex) && options[selectedIndex] !== undefined ? options[selectedIndex] : null,
            correct_answer: options[correctIndex] ?? String(correctIndex),
            is_correct: isCorrect,
            question_text: questionText || null,
            options,
            context_title: typeof content.stimulus_title === 'string' ? content.stimulus_title : null,
            context_text: typeof content.stimulus_text === 'string' ? content.stimulus_text : null,
            system_rationale: typeof key.rationale === 'string' ? key.rationale : null,
          });
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
          const blanks = (responseJson as { blanks?: (string | null)[] } | null)?.blanks ?? [];
          const acceptedAnswers = (key as { answers: string[][] }).answers;
          for (let blankIndex = 0; blankIndex < acceptedAnswers.length; blankIndex++) {
            const studentAnswer = String(blanks[blankIndex] ?? '').trim();
            const accepted = acceptedAnswers[blankIndex] ?? [];
            const blankCorrect = accepted.some((answer) => answer.trim().toLowerCase() === studentAnswer.toLowerCase());
            const questionNo = blankIndex + 1;
            itemResults.push({
              item_id: item.id,
              item_label: `M${mod.orderNo}-Q${questionNo}`,
              section_type: 'reading',
              module_no: mod.orderNo,
              module_title: mod.title,
              question_no: questionNo,
              task_type: item.itemType,
              category_key: 'complete_the_words',
              skill_tags: ['word_form', 'context_clue'],
              student_answer: studentAnswer || null,
              correct_answer: accepted,
              is_correct: blankCorrect,
              question_text: `Complete word ${questionNo}`,
              options: [],
              context_title: 'Complete the Words',
              context_text: typeof content.template === 'string' ? content.template : null,
              system_rationale: null,
            });
          }
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
          const questionNo = Number(content.question_number ?? item.orderNo);
          const orderedTokens = (responseJson as { ordered_tokens?: string[] } | null)?.ordered_tokens ?? [];
          const acceptedSentences = Array.isArray(key.accepted_sentences) ? key.accepted_sentences.map(String) : [];
          itemResults.push({
            item_id: item.id,
            item_label: `Q${questionNo}`,
            section_type: 'writing',
            module_no: mod.orderNo,
            module_title: mod.title,
            question_no: questionNo,
            task_type: item.itemType,
            category_key: 'build_a_sentence',
            skill_tags: ['sentence_structure', 'word_order'],
            student_answer: orderedTokens.join(' ') || null,
            correct_answer: acceptedSentences[0] ?? (key.correct_order as string[]).join(' '),
            is_correct: isCorrect,
            question_text: typeof content.question_text === 'string' ? content.question_text : null,
            options: Array.isArray(content.tokens) ? content.tokens.map(String) : [],
            context_title: null,
            context_text: null,
            system_rationale: null,
          });
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
        itemResults,
      });
    }
  }

  return stats;
}
