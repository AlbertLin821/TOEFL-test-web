import { useEffect, useRef, useState } from 'react';
import type { AttemptState, ExamSectionDetail } from '../../lib/api';
import {
  findSavedExamPosition,
  getRestoredListeningGroups,
  type ExamPhase,
} from './exam-position';

interface RestoreSideEffects {
  listeningGroups: Record<string, boolean>;
  listeningLocked: boolean;
}

interface UseExamFlowStateOptions {
  attemptId: string | undefined;
  attempt: AttemptState | undefined;
  sections: ExamSectionDetail[];
  debugStartAtSpeaking: boolean;
  onRestoreSideEffects: (effects: RestoreSideEffects) => void;
}

export function useExamFlowState({
  attemptId,
  attempt,
  sections,
  debugStartAtSpeaking,
  onRestoreSideEffects,
}: UseExamFlowStateOptions) {
  const [sectionIdx, setSectionIdx] = useState(0);
  const [moduleIdx, setModuleIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);
  const [phase, setPhase] = useState<ExamPhase>('section_intro');
  const [examPositionReady, setExamPositionReady] = useState(false);
  const [debugReady, setDebugReady] = useState(!debugStartAtSpeaking);
  const restoredAttemptIdRef = useRef<string | null>(null);

  useEffect(() => {
    restoredAttemptIdRef.current = null;
    setExamPositionReady(false);
    setDebugReady(!debugStartAtSpeaking);
  }, [attemptId, debugStartAtSpeaking]);

  useEffect(() => {
    if (!debugStartAtSpeaking || sections.length === 0) return;

    const speakingIdx = sections.findIndex((section) => section.section_type === 'speaking');
    if (speakingIdx < 0) {
      setExamPositionReady(true);
      setDebugReady(true);
      return;
    }

    setSectionIdx(speakingIdx);
    setModuleIdx(0);
    setItemIdx(0);
    setPhase('section_intro');
    setExamPositionReady(true);
    setDebugReady(true);
  }, [debugStartAtSpeaking, sections]);

  useEffect(() => {
    if (debugStartAtSpeaking || !attempt || sections.length === 0) return;
    if (restoredAttemptIdRef.current === attempt.id) return;

    const position = findSavedExamPosition(attempt, sections);
    if (position) {
      setSectionIdx(position.sectionIdx);
      setModuleIdx(position.moduleIdx);
      setItemIdx(position.itemIdx);
      setPhase(position.phase);
      onRestoreSideEffects({
        listeningGroups: getRestoredListeningGroups(sections, position),
        listeningLocked: false,
      });
    } else {
      setSectionIdx(0);
      setModuleIdx(0);
      setItemIdx(0);
      setPhase('section_intro');
      onRestoreSideEffects({
        listeningGroups: {},
        listeningLocked: true,
      });
    }

    restoredAttemptIdRef.current = attempt.id;
    setExamPositionReady(true);
  }, [attempt, debugStartAtSpeaking, onRestoreSideEffects, sections]);

  return {
    debugReady,
    examPositionReady,
    itemIdx,
    moduleIdx,
    phase,
    sectionIdx,
    setItemIdx,
    setModuleIdx,
    setPhase,
    setSectionIdx,
  };
}
