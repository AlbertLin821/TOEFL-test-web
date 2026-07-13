import type { ExamItemDetail, ExamSectionDetail } from './api';

export function getSpeakingQuestionLabel(section: ExamSectionDetail, item: ExamItemDetail): string {
  const total = section.modules.reduce((sum, mod) => sum + mod.items.length, 0);
  const questionNumber = Number(item.content.question_number ?? item.order_no);
  return `Question ${questionNumber} of ${total}`;
}

export function getSpeakingVolumeControl(
  volume: number,
  volumeOpen: boolean,
  setVolume: (level: number) => void,
  setVolumeOpen: (open: boolean | ((value: boolean) => boolean)) => void,
) {
  return {
    open: volumeOpen,
    level: volume,
    onToggle: () => setVolumeOpen((open) => !open),
    onChange: setVolume,
  };
}

export function getSpeakingResponseSeconds(item: ExamItemDetail): number {
  const fromContent = Number(item.content.response_seconds);
  if (Number.isFinite(fromContent) && fromContent > 0) return fromContent;

  const fromLimit = Number(item.time_limit_seconds);
  if (Number.isFinite(fromLimit) && fromLimit > 0) return fromLimit;

  return item.item_type === 'speaking_interview' ? 45 : 8;
}

export const SPEAKING_STOP_DIALOG_MIN_MS = 2500;

export async function waitForSpeakingStopDialogMinimum(shownAtMs: number): Promise<void> {
  const remaining = SPEAKING_STOP_DIALOG_MIN_MS - (Date.now() - shownAtMs);
  if (remaining > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, remaining));
  }
}
