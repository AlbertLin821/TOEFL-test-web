import type { AttemptState, ExamSectionDetail } from '../../lib/api';

export type ExamPhase =
  | 'section_intro'
  | 'module_intro'
  | 'module_scenario'
  | 'module_end'
  | 'listening_group_intro'
  | 'listening_audio'
  | 'writing_time_remaining'
  | 'item'
  | 'section_end';

export interface ExamPosition {
  sectionIdx: number;
  moduleIdx: number;
  itemIdx: number;
  phase: ExamPhase;
}

function findExamPositionForItem(sections: ExamSectionDetail[], itemId: string): ExamPosition | null {
  for (let sectionIdx = 0; sectionIdx < sections.length; sectionIdx += 1) {
    const section = sections[sectionIdx];
    for (let moduleIdx = 0; moduleIdx < section.modules.length; moduleIdx += 1) {
      const mod = section.modules[moduleIdx];
      const itemIdx = mod.items.findIndex((candidate) => candidate.id === itemId);
      if (itemIdx >= 0) return { sectionIdx, moduleIdx, itemIdx, phase: 'item' };
    }
  }
  return null;
}

export function findSavedExamPosition(attempt: AttemptState, sections: ExamSectionDetail[]): ExamPosition | null {
  const currentSectionState = attempt.current_section_id
    ? attempt.section_states.find((state) => state.section_id === attempt.current_section_id)
    : undefined;

  if (attempt.current_section_id) {
    const sectionIdx = sections.findIndex((candidate) => candidate.id === attempt.current_section_id);
    if (sectionIdx < 0) return null;

    if (currentSectionState?.current_item_id) {
      const position = findExamPositionForItem(sections, currentSectionState.current_item_id);
      if (position?.sectionIdx === sectionIdx) return position;
    }

    const section = sections[sectionIdx];
    const savedModuleIdx = currentSectionState?.module_id
      ? section.modules.findIndex((candidate) => candidate.id === currentSectionState.module_id)
      : 0;
    const phase: ExamPhase = currentSectionState?.status === 'completed' ? 'section_end' : 'module_intro';
    return { sectionIdx, moduleIdx: Math.max(0, savedModuleIdx), itemIdx: 0, phase };
  }

  const itemIds = [
    attempt.current_item_id,
    ...attempt.section_states.map((state) => state.current_item_id),
  ].filter((itemId): itemId is string => Boolean(itemId));

  for (const itemId of itemIds) {
    const position = findExamPositionForItem(sections, itemId);
    if (position) return position;
  }

  return null;
}

export function getRestoredListeningGroups(sections: ExamSectionDetail[], position: ExamPosition) {
  const section = sections[position.sectionIdx];
  const mod = section?.modules[position.moduleIdx];
  if (section?.section_type !== 'listening' || !mod || position.phase !== 'item') return {};

  const firstGroupIndex = mod.items.findIndex((candidate) => Boolean(candidate.content.group_audio));
  return firstGroupIndex >= 0 && position.itemIdx >= firstGroupIndex ? { [mod.id]: true } : {};
}
