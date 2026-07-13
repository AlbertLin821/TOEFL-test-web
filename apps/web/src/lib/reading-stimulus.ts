import type { ExamItemDetail } from './api';

export function parseEmailStimulus(text: string): { subject: string; body: string } {
  const match = text.match(/^Subject:\s*(.+?)(?:\r?\n\r?\n|\r?\n)/i);
  if (!match) {
    return { subject: '', body: text };
  }
  return {
    subject: match[1].trim(),
    body: text.slice(match[0].length).trim(),
  };
}

export function isEmailStimulus(
  instructions: string | undefined,
  stimulusTitle: string | undefined,
  stimulusText: string | undefined,
): boolean {
  const instructionText = String(instructions ?? '').toLowerCase();
  const title = String(stimulusTitle ?? '').toLowerCase();
  const text = String(stimulusText ?? '');
  return instructionText.includes('email') || title === 'email' || /^Subject:/im.test(text);
}

export function isNoticeStimulus(
  instructions: string | undefined,
  stimulusTitle: string | undefined,
): boolean {
  const instructionText = String(instructions ?? '').toLowerCase();
  const title = String(stimulusTitle ?? '').toLowerCase();
  return instructionText.includes('notice') || title === 'notice';
}

export function isAcademicPassageStimulus(instructions: string | undefined): boolean {
  return String(instructions ?? '').toLowerCase().includes('passage');
}

export function isAcademicPassageGroup(groupItems: ExamItemDetail[]): boolean {
  const instructions = groupItems.find((item) => item.content.instructions)?.content.instructions;
  return isAcademicPassageStimulus(instructions ? String(instructions) : undefined);
}

export type PassageTextSegment =
  | { type: 'text'; value: string }
  | { type: 'marker'; value: string };

export function splitPassageInsertionMarkers(text: string): PassageTextSegment[] {
  return text.split(/(\([A-D]\))/g).map((part) =>
    /^\([A-D]\)$/.test(part) ? { type: 'marker' as const, value: part } : { type: 'text' as const, value: part },
  );
}
