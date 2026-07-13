import type { ExamItemDetail, ExamSectionDetail } from './api';
import { getReadingChoiceGroupBounds } from './reading-choice-group';

export function countReadingQuestions(section: ExamSectionDetail): number {
  let total = 0;
  for (const mod of section.modules) {
    for (const it of mod.items) {
      if (it.item_type === 'reading_fill_blank') {
        total += Number(it.content.blank_count ?? 10);
      } else {
        total += 1;
      }
    }
  }
  return total;
}

export function getReadingQuestionLabel(
  section: ExamSectionDetail,
  item: ExamItemDetail,
  moduleItems: ExamItemDetail[],
  itemIdx: number,
): string {
  const total = countReadingQuestions(section);

  if (item.item_type === 'reading_fill_blank') {
    const range = String(item.content.question_label ?? 'Questions 1-10');
    return `${range} of ${total}`;
  }

  if (item.item_type === 'reading_single_choice') {
    const { start, end } = getReadingChoiceGroupBounds(moduleItems, itemIdx);
    const groupItems = moduleItems.slice(start, end + 1);
    const startNumber = groupItems[0].content.question_number ?? start + 1;
    if (groupItems.length === 1) {
      return `Question ${startNumber} of ${total}`;
    }
    const endNumber = groupItems[groupItems.length - 1].content.question_number ?? end + 1;
    return `Questions ${startNumber}-${endNumber} of ${total}`;
  }

  const questionNumber = item.content.question_number ?? item.order_no;
  return `Question ${questionNumber} of ${total}`;
}

export function formatTimeHms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export interface ReadingReviewEntry {
  label: string;
  itemIdx: number;
  answered: boolean;
}

export function buildReadingReviewEntries(
  moduleItems: ExamItemDetail[],
  answers: Record<string, unknown>,
): ReadingReviewEntry[] {
  const entries: ReadingReviewEntry[] = [];

  moduleItems.forEach((item, itemIdx) => {
    if (item.item_type === 'reading_fill_blank') {
      const blankCount = Number(item.content.blank_count ?? 10);
      const blanks = ((answers[item.id] as { blanks?: string[] } | undefined)?.blanks) ?? [];
      for (let q = 0; q < blankCount; q += 1) {
        entries.push({
          label: `Question ${q + 1}`,
          itemIdx,
          answered: !!(blanks[q]?.trim()),
        });
      }
      return;
    }

    if (item.item_type === 'reading_single_choice') {
      const questionNumber = item.content.question_number ?? itemIdx + 1;
      const { start } = getReadingChoiceGroupBounds(moduleItems, itemIdx);
      const ans = answers[item.id] as { selected_option_index?: number } | undefined;
      entries.push({
        label: `Question ${questionNumber}`,
        itemIdx: start,
        answered: ans?.selected_option_index !== undefined,
      });
    }
  });

  return entries;
}
