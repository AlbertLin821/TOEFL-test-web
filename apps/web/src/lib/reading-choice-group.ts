import type { ExamItemDetail } from './api';

function readingChoiceGroupKey(item: ExamItemDetail): string {
  return [String(item.content.stimulus_title ?? ''), String(item.content.stimulus_text ?? '')].join('\0');
}

export function getReadingChoiceGroupBounds(
  items: ExamItemDetail[],
  itemIdx: number,
): { start: number; end: number } {
  const item = items[itemIdx];
  if (!item || item.item_type !== 'reading_single_choice') {
    return { start: itemIdx, end: itemIdx };
  }

  const key = readingChoiceGroupKey(item);
  let start = itemIdx;
  while (
    start > 0 &&
    items[start - 1].item_type === 'reading_single_choice' &&
    readingChoiceGroupKey(items[start - 1]) === key
  ) {
    start -= 1;
  }

  let end = itemIdx;
  while (
    end < items.length - 1 &&
    items[end + 1].item_type === 'reading_single_choice' &&
    readingChoiceGroupKey(items[end + 1]) === key
  ) {
    end += 1;
  }

  return { start, end };
}

export const READING_OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

export function isStackedReadingGroup(items: ExamItemDetail[], itemIdx: number): boolean {
  if (items[itemIdx]?.item_type !== 'reading_single_choice') return false;
  const { start, end } = getReadingChoiceGroupBounds(items, itemIdx);
  return end > start;
}
