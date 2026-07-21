import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';

interface SavedResponse {
  exam_item_id: string;
  response: unknown;
}

interface PendingAnswerSave {
  response: unknown;
  version: number;
  persistedVersion: number;
  inFlight: Promise<boolean> | null;
}

export function useAutosaveResponses(attemptId: string | undefined, savedResponses: SavedResponse[] | undefined) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [saveStatus, setSaveStatus] = useState('');
  const pendingAnswerSavesRef = useRef<Map<string, PendingAnswerSave>>(new Map());
  const saveDebounceRef = useRef<number | null>(null);

  const pumpAnswerSave = useCallback(
    (itemId: string): Promise<boolean> => {
      const state = pendingAnswerSavesRef.current.get(itemId);
      if (!attemptId || !state) return Promise.resolve(false);
      if (state.inFlight) return state.inFlight;

      const operation = (async () => {
        try {
          while (state.persistedVersion < state.version) {
            const response = state.response;
            const version = state.version;
            await api.saveResponse(attemptId, itemId, response);
            state.persistedVersion = version;
          }
          return true;
        } catch {
          return false;
        } finally {
          state.inFlight = null;
        }
      })();

      state.inFlight = operation;
      return operation;
    },
    [attemptId],
  );

  const flushPendingAnswers = useCallback(async () => {
    if (saveDebounceRef.current !== null) {
      window.clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }

    const dirtyItems = [...pendingAnswerSavesRef.current.entries()].filter(
      ([, state]) => state.persistedVersion < state.version,
    );
    if (dirtyItems.length === 0) return true;

    const results = await Promise.all(dirtyItems.map(([itemId]) => pumpAnswerSave(itemId)));
    const allSaved =
      results.every(Boolean) &&
      [...pendingAnswerSavesRef.current.values()].every((state) => state.persistedVersion >= state.version);
    setSaveStatus(allSaved ? 'Saved' : 'Save failed - select Next again to retry');
    return allSaved;
  }, [pumpAnswerSave]);

  const saveAnswer = useCallback(
    (itemId: string, response: unknown) => {
      setAnswers((previous) => ({ ...previous, [itemId]: response }));
      const existing = pendingAnswerSavesRef.current.get(itemId);
      const state: PendingAnswerSave = existing ?? {
        response,
        version: 0,
        persistedVersion: 0,
        inFlight: null,
      };
      state.response = response;
      state.version += 1;
      pendingAnswerSavesRef.current.set(itemId, state);
      setSaveStatus('Saving...');

      if (saveDebounceRef.current !== null) window.clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = window.setTimeout(() => {
        saveDebounceRef.current = null;
        void flushPendingAnswers();
      }, 300);
    },
    [flushPendingAnswers],
  );

  useEffect(
    () => () => {
      if (saveDebounceRef.current !== null) window.clearTimeout(saveDebounceRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!savedResponses) return;

    const map: Record<string, unknown> = {};
    for (const response of savedResponses) map[response.exam_item_id] = response.response;
    setAnswers(map);
  }, [savedResponses]);

  return {
    answers,
    flushPendingAnswers,
    saveAnswer,
    saveStatus,
    setSaveStatus,
  };
}
