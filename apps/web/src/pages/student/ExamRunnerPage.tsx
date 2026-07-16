import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Volume2 } from 'lucide-react';
import ExamTopBar from '../../components/exam/ExamTopBar';
import ExamFlowShell from '../../components/exam/ExamFlowShell';
import HardwareCheckFlow from '../../components/exam/HardwareCheckFlow';
import ReadingExamTopBar from '../../components/exam/ReadingExamTopBar';
import ReadingFillBlankQuestion from '../../components/exam/ReadingFillBlankQuestion';
import ReadingChoiceGroupQuestion from '../../components/exam/ReadingChoiceGroupQuestion';
import ReadingSectionIntro from '../../components/exam/ReadingSectionIntro';
import ReadingModuleIntro from '../../components/exam/ReadingModuleIntro';
import ReadingModuleEnd from '../../components/exam/ReadingModuleEnd';
import ReadingSectionEnd from '../../components/exam/ReadingSectionEnd';
import {
  LISTENING_GROUP_VISUAL,
  LISTENING_RESPONSE_VISUAL,
  ListeningAudioScene,
  ListeningGroupIntro,
  ListeningModuleEnd,
  ListeningModuleIntro,
  ListeningQuestion,
  ListeningSectionEnd,
  ListeningSectionIntro,
} from '../../components/exam/ListeningExam';
import {
  WritingEssayQuestion,
  WritingModuleIntro,
  WritingSectionEnd,
  WritingSectionIntro,
  WritingSentenceQuestion,
  WritingTimeRemaining,
} from '../../components/exam/WritingExam';
import SpeakingSectionIntro from '../../components/exam/SpeakingSectionIntro';
import SpeakingModuleIntro from '../../components/exam/SpeakingModuleIntro';
import SpeakingModuleEnd from '../../components/exam/SpeakingModuleEnd';
import SpeakingSectionEnd from '../../components/exam/SpeakingSectionEnd';
import SpeakingExamTopBar from '../../components/exam/SpeakingExamTopBar';
import SpeakingQuestionPanel from '../../components/exam/SpeakingQuestionPanel';
import SpeakingStopDialog from '../../components/exam/SpeakingStopDialog';
import { getReadingChoiceGroupBounds, isStackedReadingGroup } from '../../lib/reading-choice-group';
import { getReadingQuestionLabel, buildReadingReviewEntries } from '../../lib/reading-exam-utils';
import { getSpeakingQuestionLabel, getSpeakingResponseSeconds, getSpeakingVolumeControl, waitForSpeakingStopDialogMinimum } from '../../lib/speaking-exam-utils';
import { useCountdown } from '../../hooks/useCountdown';
import { api, type ExamItemDetail, type ExamModuleDetail, type ExamSectionDetail } from '../../lib/api';
import { EXAM_DEBUG_START_AT_SPEAKING } from '../../lib/exam-debug';

interface PendingAnswerSave {
  response: unknown;
  version: number;
  persistedVersion: number;
  inFlight: Promise<boolean> | null;
}

interface PendingExamTimeout {
  kind: 'writing_module' | 'listening_item';
  key: string;
}

export default function ExamRunnerPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [sectionIdx, setSectionIdx] = useState(0);
  const [moduleIdx, setModuleIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);
  const [phase, setPhase] = useState<
    | 'section_intro'
    | 'module_intro'
    | 'module_scenario'
    | 'module_end'
    | 'listening_group_intro'
    | 'listening_audio'
    | 'writing_time_remaining'
    | 'item'
    | 'section_end'
  >('section_intro');
  const [showTimer, setShowTimer] = useState(true);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [listeningLocked, setListeningLocked] = useState(true);
  const [listeningGroupIntroSeen, setListeningGroupIntroSeen] = useState<Record<string, boolean>>({});
  const [listeningAudioError, setListeningAudioError] = useState('');
  const [volume, setVolume] = useState(1);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const speakingPromptAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const activeSpeakItemIdRef = useRef<string | null>(null);
  const speakingTimedOutRef = useRef(false);
  const speakingStopDialogShownAtRef = useRef(0);
  const stopSpeakingRef = useRef<(timedOut?: boolean) => void>(() => {});
  const [speakingPhase, setSpeakingPhase] = useState<'idle' | 'playing' | 'recording' | 'uploading'>('idle');
  const [speakingResponseLimit, setSpeakingResponseLimit] = useState(0);
  const [showSpeakingStopDialog, setShowSpeakingStopDialog] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [answeringFrozen, setAnsweringFrozen] = useState(false);
  const [navigationPending, setNavigationPending] = useState(false);
  const transitionLockRef = useRef(false);
  const answeringTimedOutRef = useRef(false);
  const pendingExamTimeoutRef = useRef<PendingExamTimeout | null>(null);
  const pendingAnswerSavesRef = useRef<Map<string, PendingAnswerSave>>(new Map());
  const saveDebounceRef = useRef<number | null>(null);
  const [debugReady, setDebugReady] = useState(!EXAM_DEBUG_START_AT_SPEAKING);

  const beginNavigation = useCallback(() => {
    if (transitionLockRef.current) return false;
    transitionLockRef.current = true;
    setNavigationPending(true);
    return true;
  }, []);

  const releaseNavigation = useCallback(() => {
    transitionLockRef.current = false;
    setNavigationPending(false);
  }, []);

  const attemptQuery = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => api.getAttempt(attemptId!),
    enabled: !!attemptId,
  });

  const attemptStatus = attemptQuery.data?.status;
  const pendingHardwareCheck = !!attemptId && attemptStatus === 'hardware_check';

  const examQuery = useQuery({
    queryKey: ['exam-version', attemptQuery.data?.exam_version_id],
    queryFn: () => api.getExamVersion(attemptQuery.data!.exam_version_id),
    enabled: !!attemptQuery.data?.exam_version_id && !pendingHardwareCheck,
  });

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
    if (attemptQuery.data?.responses) {
      const map: Record<string, unknown> = {};
      for (const r of attemptQuery.data.responses) map[r.exam_item_id] = r.response;
      setAnswers(map);
    }
  }, [attemptQuery.data]);

  useEffect(() => {
    if (!EXAM_DEBUG_START_AT_SPEAKING || !examQuery.data) return;

    const speakingIdx = examQuery.data.sections.findIndex((s) => s.section_type === 'speaking');
    if (speakingIdx < 0) {
      setDebugReady(true);
      return;
    }

    setSectionIdx(speakingIdx);
    setModuleIdx(0);
    setItemIdx(0);
    setPhase('section_intro');
    setDebugReady(true);
  }, [examQuery.data]);

  const sections = examQuery.data?.sections ?? [];
  const section: ExamSectionDetail | undefined = sections[sectionIdx];
  const mod: ExamModuleDetail | undefined = section?.modules[moduleIdx];
  const item: ExamItemDetail | undefined = mod?.items[itemIdx];

  async function advanceBeyondCurrentModule(lockOnFailure = false) {
    if (!section || !beginNavigation()) return;
    setAnsweringFrozen(true);
    if (!(await flushPendingAnswers())) {
      if (!lockOnFailure && !answeringTimedOutRef.current) setAnsweringFrozen(false);
      releaseNavigation();
      return;
    }
    if (moduleIdx < section.modules.length - 1) {
      setModuleIdx((current) => current + 1);
      setItemIdx(0);
      setPhase('module_intro');
      return;
    }
    setPhase('section_end');
  }

  const moduleTimerActive =
    !!mod?.time_limit_seconds &&
    (phase === 'item' || (section?.section_type === 'writing' && phase === 'writing_time_remaining'));
  const listeningAnswering =
    section?.section_type === 'listening' &&
    phase === 'item' &&
    !listeningLocked &&
    !listeningAudioError &&
    !answeringFrozen;

  const moduleTimer = useCountdown(
    mod?.time_limit_seconds ?? 0,
    moduleTimerActive,
    () => {
      answeringTimedOutRef.current = true;
      if (section?.section_type === 'writing' && mod) {
        pendingExamTimeoutRef.current = { kind: 'writing_module', key: mod.id };
      }
      setAnsweringFrozen(true);
      if (section?.section_type === 'writing') void advanceBeyondCurrentModule(true);
      else void goNext();
    },
    mod?.id ?? 'no-module',
  );

  const itemTimer = useCountdown(
    item?.time_limit_seconds ?? 0,
    !!item?.time_limit_seconds && listeningAnswering,
    () => {
      answeringTimedOutRef.current = true;
      if (item) pendingExamTimeoutRef.current = { kind: 'listening_item', key: item.id };
      setAnsweringFrozen(true);
      void goNext();
    },
    item?.id ?? 'no-item',
  );

  const stopSpeaking = useCallback((timedOut = false) => {
    speakingTimedOutRef.current = timedOut;
    if (timedOut) {
      speakingStopDialogShownAtRef.current = Date.now();
      setShowSpeakingStopDialog(true);
    }

    const mr = mediaRecorder.current;
    if (!mr || mr.state !== 'recording') {
      if (timedOut) {
        setSpeakingResponseLimit(0);
        setSpeakingPhase('uploading');
      }
      return;
    }

    setSpeakingResponseLimit(0);
    setSpeakingPhase('uploading');
    mr.stop();
  }, []);

  stopSpeakingRef.current = stopSpeaking;

  const [speakingResponseRemaining, setSpeakingResponseRemaining] = useState(0);

  useEffect(() => {
    if (speakingPhase !== 'recording' || speakingResponseLimit <= 0) {
      setSpeakingResponseRemaining(0);
      return;
    }

    setSpeakingResponseRemaining(speakingResponseLimit);
    const timer = window.setInterval(() => {
      setSpeakingResponseRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          stopSpeakingRef.current(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [speakingPhase, speakingResponseLimit]);

  const persistSection = useCallback(async () => {
    if (!attemptId || !section) return;
    await api.saveSectionState(attemptId, {
      section_id: section.id,
      module_id: mod?.id ?? null,
      status: 'in_progress',
      current_item_id: item?.id ?? null,
    });
  }, [attemptId, section, mod, item]);

  useEffect(() => {
    persistSection();
  }, [sectionIdx, moduleIdx, itemIdx, persistSection]);

  const finishExam = async (transitionAlreadyLocked = false) => {
    if (!attemptId || (!transitionAlreadyLocked && !beginNavigation())) return;
    if (!(await flushPendingAnswers())) {
      releaseNavigation();
      return;
    }
    try {
      await api.submitAttempt(attemptId);
      navigate(`/exam/${attemptId}/grading`);
    } catch {
      setSaveStatus('Submission failed - select Next again to retry');
      releaseNavigation();
    }
  };

  const exitExam = async () => {
    if (!beginNavigation()) return;
    const preserveFreeze = answeringFrozen;
    setAnsweringFrozen(true);
    if (!(await flushPendingAnswers())) {
      if (!preserveFreeze && !answeringTimedOutRef.current) setAnsweringFrozen(false);
      releaseNavigation();
      return;
    }
    navigate('/student/exams');
  };

  const playListeningItem = useCallback((targetItem: ExamItemDetail, audioScene: boolean) => {
    const audioAsset = targetItem.assets.find((asset) => asset.asset_type === 'audio');
    if (!audioAsset) {
      setListeningLocked(true);
      setListeningAudioError('The listening audio is unavailable. Select Retry after checking the connection.');
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(audioAsset.url);
    audio.volume = volumeRef.current;
    audioRef.current = audio;
    setListeningLocked(true);
    setListeningAudioError('');

    const fail = (reason?: unknown) => {
      if (audioRef.current !== audio) return;
      console.error('Listening audio playback failed.', reason, audio.error);
      setListeningLocked(true);
      setListeningAudioError('The listening audio could not be played. Select Retry to try again.');
    };

    audio.onended = () => {
      if (audioRef.current !== audio) return;
      audioRef.current = null;
      setListeningLocked(false);
      if (audioScene) setPhase('item');
    };
    audio.onerror = () => fail(audio.error);
    void audio.play().catch(fail);
  }, []);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  const goNext = async () => {
    if (!section || !mod || !beginNavigation()) return;
    if (!(await flushPendingAnswers())) {
      releaseNavigation();
      return;
    }
    setReviewOpen(false);

    if (section.section_type === 'writing' && answeringTimedOutRef.current) {
      if (moduleIdx < section.modules.length - 1) {
        setModuleIdx((current) => current + 1);
        setItemIdx(0);
        setPhase('module_intro');
      } else {
        setPhase('section_end');
      }
      return;
    }

    if (section.section_type === 'writing') {
      if (itemIdx < mod.items.length - 1) {
        setItemIdx((current) => current + 1);
        return;
      }
      setPhase('writing_time_remaining');
      return;
    }

    if (section.section_type === 'listening') {
      if (itemIdx < mod.items.length - 1) {
        const nextIndex = itemIdx + 1;
        const nextItem = mod.items[nextIndex];
        const startsAudioGroup = Boolean(nextItem.content.group_audio);
        setItemIdx(nextIndex);
        setListeningAudioError('');

        if (startsAudioGroup && !listeningGroupIntroSeen[mod.id]) {
          setPhase('listening_group_intro');
          setListeningLocked(true);
          return;
        }

        if (startsAudioGroup) {
          setPhase('listening_audio');
          setListeningLocked(true);
          playListeningItem(nextItem, true);
          return;
        }

        const hasAudio = Boolean(nextItem.assets.find((asset) => asset.asset_type === 'audio'));
        setPhase('item');
        setListeningLocked(hasAudio);
        if (hasAudio) playListeningItem(nextItem, false);
        return;
      }

      if (moduleIdx < section.modules.length - 1) {
        setPhase('module_end');
      } else {
        setPhase('section_end');
      }
      return;
    }

    if (section.section_type === 'reading' && isStackedReadingGroup(mod.items, itemIdx)) {
      const { end } = getReadingChoiceGroupBounds(mod.items, itemIdx);
      const nextIdx = end + 1;
      if (nextIdx < mod.items.length) {
        setItemIdx(nextIdx);
        return;
      }
    } else if (itemIdx < mod.items.length - 1) {
      setItemIdx((i) => i + 1);
      return;
    }
    if (moduleIdx < section.modules.length - 1) {
      if (section.section_type === 'reading' || section.section_type === 'speaking') {
        setPhase('module_end');
        return;
      }
      setModuleIdx((m) => m + 1);
      setItemIdx(0);
      setPhase('module_intro');
      return;
    }
    if (section.section_type === 'speaking') {
      setPhase('section_end');
      return;
    }
    if (sectionIdx < sections.length - 1) {
      setPhase('section_end');
      return;
    }
    await finishExam(true);
  };

  const goBack = () => {
    if (!mod?.allow_back || itemIdx === 0) return;
    if (!beginNavigation()) return;

    if (section?.section_type === 'reading' && isStackedReadingGroup(mod.items, itemIdx)) {
      const { start } = getReadingChoiceGroupBounds(mod.items, itemIdx);
      if (start > 0) {
        setItemIdx(start - 1);
        return;
      }
      releaseNavigation();
      return;
    }

    setItemIdx((i) => i - 1);
  };

  const nextSection = () => {
    if (!beginNavigation()) return;
    setSectionIdx((s) => s + 1);
    setModuleIdx(0);
    setItemIdx(0);
    setPhase('section_intro');
    setListeningLocked(true);
  };

  const startSection = () => {
    if (!beginNavigation()) return;
    setPhase('module_intro');
  };

  const startModule = () => {
    if (!beginNavigation()) return;
    setPhase('item');
    setListeningAudioError('');
    if (section?.section_type === 'listening' && item) {
      setListeningLocked(true);
      playListeningItem(item, false);
      return;
    }
    setListeningLocked(false);
  };

  const startListeningGroup = () => {
    if (!mod || !beginNavigation()) return;
    setListeningGroupIntroSeen((seen) => ({ ...seen, [mod.id]: true }));
    setListeningLocked(true);
    setListeningAudioError('');
    setPhase('listening_audio');
    if (item) playListeningItem(item, true);
  };

  const continueFromModuleIntro = () => {
    if (section?.section_type === 'speaking' && mod?.module_type === 'speaking_listen_repeat') {
      if (!beginNavigation()) return;
      setPhase('module_scenario');
      return;
    }
    startModule();
  };

  const continueFromModuleEnd = () => {
    if (!beginNavigation()) return;
    setModuleIdx((m) => m + 1);
    setItemIdx(0);
    setPhase('module_intro');
    setListeningLocked(true);
    setListeningAudioError('');
  };

  useEffect(() => {
    releaseNavigation();
    const pendingTimeout = pendingExamTimeoutRef.current;
    const timeoutStillApplies =
      (pendingTimeout?.kind === 'writing_module' &&
        section?.section_type === 'writing' &&
        pendingTimeout.key === mod?.id &&
        (phase === 'item' || phase === 'writing_time_remaining')) ||
      (pendingTimeout?.kind === 'listening_item' &&
        section?.section_type === 'listening' &&
        pendingTimeout.key === item?.id &&
        phase === 'item');

    if (!timeoutStillApplies || !pendingTimeout) {
      pendingExamTimeoutRef.current = null;
      answeringTimedOutRef.current = false;
      setAnsweringFrozen(false);
      return;
    }

    setAnsweringFrozen(true);
    const retry = window.setTimeout(() => {
      if (transitionLockRef.current) return;
      if (pendingTimeout.kind === 'writing_module') void advanceBeyondCurrentModule(true);
      else void goNext();
    }, 0);
    return () => window.clearTimeout(retry);
    // The timeout continuation intentionally runs only after navigation state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIdx, moduleIdx, itemIdx, phase, releaseNavigation]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const runSpeakingItem = useCallback(
    async (speakItem: ExamItemDetail) => {
      speakingTimedOutRef.current = false;
      speakingStopDialogShownAtRef.current = 0;
      setShowSpeakingStopDialog(false);
      setSpeakingPhase('playing');
      setSpeakingResponseLimit(0);
      const promptUrl = speakItem.assets[0]?.url;
      const responseSeconds = getSpeakingResponseSeconds(speakItem);

      const startRecording = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mr = new MediaRecorder(stream);
          mediaRecorder.current = mr;
          activeSpeakItemIdRef.current = speakItem.id;
          const chunks: Blob[] = [];
          mr.ondataavailable = (e) => chunks.push(e.data);
          mr.onstop = async () => {
            if (activeSpeakItemIdRef.current !== speakItem.id) {
              stream.getTracks().forEach((t) => t.stop());
              return;
            }
            stream.getTracks().forEach((t) => t.stop());
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const timedOut = speakingTimedOutRef.current;
            if (timedOut) {
              if (speakingStopDialogShownAtRef.current === 0) {
                speakingStopDialogShownAtRef.current = Date.now();
              }
              setShowSpeakingStopDialog(true);
            }
            setSpeakingPhase('uploading');
            try {
              if (attemptId) {
                await api.uploadAudio(attemptId, speakItem.id, blob, responseSeconds * 1000);
              }
            } finally {
              if (timedOut) {
                await waitForSpeakingStopDialogMinimum(speakingStopDialogShownAtRef.current);
              }
              speakingTimedOutRef.current = false;
              speakingStopDialogShownAtRef.current = 0;
              setShowSpeakingStopDialog(false);
              setSpeakingResponseLimit(0);
              setSpeakingPhase('idle');
            }
          };
          mr.start();
          setSpeakingResponseLimit(responseSeconds);
          setSpeakingPhase('recording');
        } catch {
          setSpeakingResponseLimit(0);
          setSpeakingPhase('idle');
          alert('麥克風無法使用，請返回 Hardware Check 重新測試。');
        }
      };

      if (promptUrl) {
        speakingPromptAudioRef.current?.pause();
        const audio = new Audio(promptUrl);
        speakingPromptAudioRef.current = audio;
        audio.volume = volumeRef.current;
        audio.onended = () => void startRecording();
        audio.onerror = () => {
          setSpeakingPhase('idle');
        };
        try {
          await audio.play();
        } catch {
          setSpeakingPhase('idle');
        }
      } else {
        await startRecording();
      }
    },
    [attemptId],
  );

  useEffect(() => {
    if (phase !== 'item' || section?.section_type !== 'speaking' || !item) return;

    void runSpeakingItem(item);

    return () => {
      activeSpeakItemIdRef.current = null;
      speakingTimedOutRef.current = false;
      speakingStopDialogShownAtRef.current = 0;
      setShowSpeakingStopDialog(false);
      speakingPromptAudioRef.current?.pause();
      speakingPromptAudioRef.current = null;
      setSpeakingResponseLimit(0);
      setSpeakingResponseRemaining(0);
      const mr = mediaRecorder.current;
      if (mr && mr.state === 'recording') {
        mr.stop();
      }
      mediaRecorder.current = null;
    };
  }, [item?.id, phase, section?.section_type, runSpeakingItem]);

  if (attemptQuery.isLoading) return <div className="p-8">Loading exam...</div>;

  if (pendingHardwareCheck && attemptId && attemptStatus) {
    return (
      <HardwareCheckFlow
        attemptId={attemptId}
        attemptStatus={attemptStatus}
        onComplete={() => {
          void attemptQuery.refetch();
        }}
      />
    );
  }

  if (examQuery.isLoading || (EXAM_DEBUG_START_AT_SPEAKING && !debugReady)) {
    return <div className="p-8">Loading exam...</div>;
  }

  if (!section) return <div className="p-8">Exam data unavailable.</div>;

  const questionLabel = (() => {
    if (!item || !mod) return section.title;
    if (section.section_type === 'reading') return getReadingQuestionLabel(section, item, mod.items, itemIdx);
    if (section.section_type === 'speaking') return getSpeakingQuestionLabel(section, item);
    if (section.section_type === 'listening') return `Question ${itemIdx + 1} of ${mod.items.length}`;
    if (section.section_type === 'writing') {
      if (mod.module_type === 'writing_build_sentence') return `Question ${itemIdx + 1} of ${mod.items.length}`;
      return mod.module_type === 'writing_email' ? 'Question 1 of 2' : 'Question 2 of 2';
    }
    return `Question ${item.content.question_number ?? item.order_no}`;
  })();

  const timer =
    section.section_type === 'listening'
      ? listeningAnswering
        ? itemTimer
        : 0
      : section.section_type === 'writing'
        ? moduleTimer
        : mod?.time_limit_seconds
          ? moduleTimer
          : null;

  const isReadingItem = section.section_type === 'reading' && phase === 'item';
  const isSpeakingItem = section.section_type === 'speaking' && phase === 'item';
  const speakingResponseSeconds = item && isSpeakingItem ? getSpeakingResponseSeconds(item) : 0;
  const speakingVolumeControl = getSpeakingVolumeControl(volume, volumeOpen, setVolume, setVolumeOpen);
  const listeningVolumeControl = {
    open: volumeOpen,
    level: volume,
    onToggle: () => setVolumeOpen((open) => !open),
    onChange: setVolume,
  };

  const reviewEntries =
    section.section_type === 'reading' && mod
      ? buildReadingReviewEntries(mod.items, answers)
      : mod?.items.map((it, i) => ({
          label: `Question ${i + 1}`,
          itemIdx: i,
          answered: !!answers[it.id],
        })) ?? [];

  const renderItem = () => {
    if (!item) return null;
    const ans = answers[item.id] as Record<string, unknown> | undefined;

    if (item.item_type === 'reading_fill_blank') {
      const template = String(item.content.template ?? '');
      const blankCount = Number(item.content.blank_count ?? 10);
      const blanks = (ans?.blanks as string[]) ?? Array(blankCount).fill('');
      return (
        <ReadingFillBlankQuestion
          instructions={String(item.content.instructions ?? '')}
          template={template}
          content={item.content}
          blanks={blanks}
          onChange={(next) => void saveAnswer(item.id, { blanks: next })}
        />
      );
    }

    if (item.item_type.endsWith('single_choice')) {
      const selected = ans?.selected_option_index as number | undefined;
      const options = (item.content.options as string[]) ?? [];
      const stimulus = item.content.stimulus_text as string | undefined;

      if (section?.section_type === 'reading' && item.item_type === 'reading_single_choice') {
        const { start, end } = getReadingChoiceGroupBounds(mod?.items ?? [], itemIdx);
        const groupItems = (mod?.items ?? []).slice(start, end + 1);
        return (
          <ReadingChoiceGroupQuestion
            groupItems={groupItems}
            answers={answers}
            onSelect={(itemId, optionIndex) =>
              void saveAnswer(itemId, { selected_option_index: optionIndex })
            }
          />
        );
      }

      if (section?.section_type === 'listening') {
        const firstGroupIndex = mod?.items.findIndex((candidate) => Boolean(candidate.content.group_audio)) ?? -1;
        const isGroupQuestion = firstGroupIndex >= 0 && itemIdx >= firstGroupIndex;
        const visualSource = isGroupQuestion ? LISTENING_GROUP_VISUAL : LISTENING_RESPONSE_VISUAL;
        const audioError = listeningAudioError ? (
          <div className="fixed bottom-6 left-1/2 z-30 flex w-[min(680px,calc(100%-2rem))] -translate-x-1/2 items-center justify-between gap-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg" role="alert">
            <span>{listeningAudioError}</span>
            <button
              type="button"
              className="shrink-0 rounded bg-red-700 px-3 py-1.5 font-medium text-white hover:bg-red-800"
              onClick={() => {
                playListeningItem(item, phase === 'listening_audio');
              }}
            >
              Retry
            </button>
          </div>
        ) : null;

        if (phase === 'listening_audio') {
          return (
            <>
              <ListeningAudioScene
                instructions={String(item.content.instructions ?? 'Listen to the conversation.')}
                visualSource={visualSource}
              />
              {audioError}
            </>
          );
        }

        return (
          <>
              <ListeningQuestion
                item={item}
                selected={selected}
                locked={listeningLocked || answeringFrozen}
              visualSource={visualSource}
              onSelect={(optionIndex) => void saveAnswer(item.id, { selected_option_index: optionIndex })}
            />
            {audioError}
          </>
        );
      }

      return (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-50 p-4 rounded border overflow-auto max-h-[60vh]">
            {Boolean(item.content.stimulus_title) && (
              <h3 className="font-semibold mb-2">{String(item.content.stimulus_title)}</h3>
            )}
            {stimulus && <pre className="whitespace-pre-wrap text-sm font-sans">{stimulus}</pre>}
            {Boolean(item.content.instructions) && (
              <p className="text-sm font-medium mt-4">{String(item.content.instructions)}</p>
            )}
          </div>
          <div>
            {Boolean(item.content.question_text) && <p className="font-medium mb-4">{String(item.content.question_text)}</p>}
            <div className="space-y-2">
              {options.map((opt, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-2 p-3 border rounded cursor-pointer hover:bg-slate-50 ${
                    selected === i ? 'border-blue-600 bg-blue-50' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name={item.id}
                    checked={selected === i}
                    onChange={() => void saveAnswer(item.id, { selected_option_index: i })}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (item.item_type === 'writing_sentence_order') {
      const orderedTokens = (ans?.ordered_tokens as string[]) ?? [];
      return (
        <WritingSentenceQuestion
          item={item}
          orderedTokens={orderedTokens}
          disabled={answeringFrozen}
          onChange={(next) => void saveAnswer(item.id, { ordered_tokens: next })}
        />
      );
    }

    if (item.item_type === 'writing_email' || item.item_type === 'writing_academic_discussion') {
      const text = (ans?.text as string) ?? '';
      return (
        <WritingEssayQuestion
          item={item}
          text={text}
          saveStatus={saveStatus}
          disabled={answeringFrozen}
          onChange={(next) => void saveAnswer(item.id, { text: next })}
        />
      );
    }

    if (item.item_type.startsWith('speaking_')) {
      return (
        <SpeakingQuestionPanel
          item={item}
          moduleDescription={mod?.description ?? undefined}
          speakingPhase={speakingPhase}
          responseSeconds={speakingResponseSeconds}
          responseRemaining={speakingPhase === 'recording' ? speakingResponseRemaining : speakingResponseSeconds}
          onStopSpeaking={() => stopSpeaking(false)}
        />
      );
    }

    return <p>Unsupported item type: {item.item_type}</p>;
  };

  if (phase === 'section_intro') {
    if (section.section_type === 'reading') {
      return (
        <ExamFlowShell sectionLabel="Reading" showVolume={false} actionLabel="Begin" onContinue={startSection}>
          <ReadingSectionIntro />
        </ExamFlowShell>
      );
    }

    if (section.section_type === 'speaking') {
      return (
        <ExamFlowShell
          sectionLabel="Speaking"
          showVolume
          volumeControl={speakingVolumeControl}
          actionLabel="Begin"
          onContinue={startSection}
        >
          <SpeakingSectionIntro />
        </ExamFlowShell>
      );
    }

    if (section.section_type === 'listening') {
      return (
        <ExamFlowShell
          sectionLabel="Listening"
          showVolume
          volumeControl={listeningVolumeControl}
          actionLabel="Begin"
          onContinue={startSection}
        >
          <ListeningSectionIntro />
        </ExamFlowShell>
      );
    }

    if (section.section_type === 'writing') {
      return (
        <ExamFlowShell sectionLabel="Writing" showVolume={false} actionLabel="Begin" onContinue={startSection}>
          <WritingSectionIntro />
        </ExamFlowShell>
      );
    }

    return (
      <div className="min-h-screen bg-white">
        <ExamTopBar sectionName={section.title} questionLabel="" showTimer={false} onToggleTimer={() => {}} />
        <main className="max-w-2xl mx-auto p-10 space-y-4">
          <h1 className="text-2xl font-bold">{section.title}</h1>
          <p className="text-slate-600">
            In this section, you will complete the {section.section_type} tasks. The timer will begin when you start
            the first module.
          </p>
          <button type="button" className="exam-btn-primary" onClick={startSection}>
            Begin
          </button>
        </main>
      </div>
    );
  }

  if (phase === 'listening_group_intro' && mod && section.section_type === 'listening') {
    return (
      <ExamFlowShell
        sectionLabel="Listening"
        showVolume
        volumeControl={listeningVolumeControl}
        actionLabel="Begin"
        onContinue={startListeningGroup}
      >
        <ListeningGroupIntro />
      </ExamFlowShell>
    );
  }

  if (phase === 'module_end' && mod) {
    if (section.section_type === 'reading') {
      const nextModule = section.modules[moduleIdx + 1];
      return (
        <ExamFlowShell
          sectionLabel="Reading"
          showVolume={false}
          actionLabel="Next"
          onContinue={continueFromModuleEnd}
        >
          <ReadingModuleEnd
            moduleOrder={mod.order_no}
            nextModuleOrder={nextModule?.order_no ?? moduleIdx + 2}
          />
        </ExamFlowShell>
      );
    }

    if (section.section_type === 'speaking') {
      const nextModule = section.modules[moduleIdx + 1];
      return (
        <ExamFlowShell
          sectionLabel="Speaking"
          showVolume
          volumeControl={speakingVolumeControl}
          actionLabel="Next"
          onContinue={continueFromModuleEnd}
        >
          <SpeakingModuleEnd
            moduleOrder={mod.order_no}
            nextModuleOrder={nextModule?.order_no ?? moduleIdx + 2}
          />
        </ExamFlowShell>
      );
    }

    if (section.section_type === 'listening') {
      const nextModule = section.modules[moduleIdx + 1];
      return (
        <ExamFlowShell
          sectionLabel="Listening"
          showVolume
          volumeControl={listeningVolumeControl}
          actionLabel="Next"
          onContinue={continueFromModuleEnd}
        >
          <ListeningModuleEnd
            moduleOrder={mod.order_no}
            nextModuleOrder={nextModule?.order_no ?? moduleIdx + 2}
          />
        </ExamFlowShell>
      );
    }
  }

  if (phase === 'module_intro' && mod) {
    if (section.section_type === 'reading') {
      return (
        <ExamFlowShell sectionLabel="Reading" showVolume={false} actionLabel="Begin" onContinue={startModule}>
          <ReadingModuleIntro
            moduleOrder={mod.order_no}
            hasNextModuleInSection={moduleIdx < section.modules.length - 1}
          />
        </ExamFlowShell>
      );
    }

    if (section.section_type === 'speaking') {
      return (
        <ExamFlowShell
          sectionLabel="Speaking"
          showVolume
          volumeControl={speakingVolumeControl}
          actionLabel="Begin"
          onContinue={continueFromModuleIntro}
        >
          <SpeakingModuleIntro
            title={mod.title}
            description={mod.description ?? undefined}
            moduleType={mod.module_type}
            step={mod.module_type === 'speaking_listen_repeat' ? 'directions' : 'default'}
          />
        </ExamFlowShell>
      );
    }

    if (section.section_type === 'listening') {
      return (
        <ExamFlowShell
          sectionLabel="Listening"
          showVolume
          volumeControl={listeningVolumeControl}
          actionLabel="Begin"
          onContinue={startModule}
        >
          <ListeningModuleIntro moduleOrder={mod.order_no} />
        </ExamFlowShell>
      );
    }

    if (section.section_type === 'writing') {
      return (
        <ExamFlowShell sectionLabel="Writing" showVolume={false} actionLabel="Begin" onContinue={startModule}>
          <WritingModuleIntro module={mod} />
        </ExamFlowShell>
      );
    }

    return (
      <div className="min-h-screen bg-white">
        <ExamTopBar sectionName={section.title} questionLabel={mod.title} showTimer={false} onToggleTimer={() => {}} />
        <main className="max-w-2xl mx-auto p-10 space-y-4">
          <h2 className="text-xl font-semibold">{mod.title}</h2>
          {mod.description && <p className="text-sm whitespace-pre-wrap">{mod.description}</p>}
          <button type="button" className="exam-btn-primary" onClick={startModule}>
            Begin
          </button>
        </main>
      </div>
    );
  }

  if (phase === 'writing_time_remaining' && mod && section.section_type === 'writing') {
    return (
      <div className="min-h-screen bg-white">
        <ExamTopBar
          sectionName="Writing"
          questionLabel="Time Remaining"
          timerSeconds={moduleTimer}
          showTimer={showTimer}
          onToggleTimer={() => setShowTimer((visible) => !visible)}
          onExit={exitExam}
          onBack={answeringFrozen || navigationPending ? undefined : () => setPhase('item')}
          onNext={() => void advanceBeyondCurrentModule(answeringFrozen)}
          nextDisabled={navigationPending}
          nextLabel="Continue"
        />
        <WritingTimeRemaining taskTitle={mod.title} />
      </div>
    );
  }

  if (phase === 'module_scenario' && mod && section.section_type === 'speaking') {
    return (
      <ExamFlowShell
        sectionLabel="Speaking"
        showVolume
        volumeControl={speakingVolumeControl}
        actionLabel="Begin"
        onContinue={startModule}
      >
        <SpeakingModuleIntro
          title={mod.title}
          description={mod.description ?? undefined}
          moduleType={mod.module_type}
          step="scenario"
        />
      </ExamFlowShell>
    );
  }

  if (phase === 'section_end') {
    if (section.section_type === 'reading') {
      return (
        <ExamFlowShell
          sectionLabel="Reading"
          showVolume={false}
          actionLabel="Next"
          onContinue={nextSection}
        >
          <ReadingSectionEnd />
        </ExamFlowShell>
      );
    }

    if (section.section_type === 'speaking') {
      return (
        <ExamFlowShell
          sectionLabel="Speaking"
          showVolume
          volumeControl={speakingVolumeControl}
          actionLabel="Next"
          onContinue={() => void finishExam()}
        >
          <SpeakingSectionEnd />
        </ExamFlowShell>
      );
    }

    if (section.section_type === 'listening') {
      return (
        <ExamFlowShell
          sectionLabel="Listening"
          showVolume
          volumeControl={listeningVolumeControl}
          actionLabel="Next"
          onContinue={nextSection}
        >
          <ListeningSectionEnd />
        </ExamFlowShell>
      );
    }

    if (section.section_type === 'writing') {
      return (
        <ExamFlowShell sectionLabel="Writing" showVolume={false} actionLabel="Next" onContinue={nextSection}>
          <WritingSectionEnd />
        </ExamFlowShell>
      );
    }

    return (
      <div className="min-h-screen bg-white">
        <ExamTopBar sectionName={section.title} questionLabel="End of Section" showTimer={false} onToggleTimer={() => {}} />
        <main className="max-w-xl mx-auto p-10 text-center space-y-4">
          <h2 className="text-xl font-semibold">End of {section.title}</h2>
          <button type="button" className="exam-btn-primary" onClick={nextSection}>
            Next
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {isReadingItem ? (
        <ReadingExamTopBar
          sectionName="Reading"
          questionLabel={questionLabel}
          timerSeconds={moduleTimer}
          showTimer={showTimer}
          onToggleTimer={() => setShowTimer((v) => !v)}
          onReview={() => setReviewOpen(true)}
          onBack={mod.allow_back ? goBack : undefined}
          onNext={goNext}
          backDisabled={itemIdx === 0 || navigationPending}
          nextDisabled={navigationPending}
        />
      ) : isSpeakingItem ? (
        <SpeakingExamTopBar
          questionLabel={questionLabel}
          timerSeconds={speakingPhase === 'recording' ? speakingResponseRemaining : speakingResponseSeconds}
          showTimer={showTimer && speakingPhase !== 'idle'}
          onToggleTimer={() => setShowTimer((v) => !v)}
          volume={volume}
          volumeOpen={volumeOpen}
          onToggleVolume={() => setVolumeOpen((open) => !open)}
          onVolumeChange={setVolume}
          onNext={goNext}
          nextDisabled={speakingPhase !== 'idle' || navigationPending}
        />
      ) : (
        <ExamTopBar
          sectionName={
            section.section_type === 'listening'
              ? 'Listening'
              : section.section_type === 'writing'
                ? 'Writing'
                : section.title
          }
          questionLabel={questionLabel}
          timerSeconds={timer}
          showTimer={showTimer}
          onToggleTimer={() => setShowTimer((v) => !v)}
          onReview={section.section_type === 'reading' ? () => setReviewOpen(true) : undefined}
          onBack={
            mod.allow_back &&
            section.section_type === 'writing' &&
            itemIdx > 0 &&
            !answeringFrozen &&
            !navigationPending
              ? goBack
              : undefined
          }
          onNext={
            section.section_type === 'listening'
              ? phase === 'item' && !listeningLocked && !listeningAudioError
                ? goNext
                : undefined
              : section.section_type === 'writing' && answeringFrozen
                ? () => void advanceBeyondCurrentModule(true)
                : goNext
          }
          backDisabled={itemIdx === 0}
          nextDisabled={navigationPending}
          extra={
            section.section_type === 'listening' ? (
              <div className="relative">
                <button
                  type="button"
                  className="exam-btn"
                  aria-expanded={volumeOpen}
                  onClick={() => setVolumeOpen((open) => !open)}
                >
                  Volume
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                </button>
                {volumeOpen && (
                  <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-md border border-slate-300 bg-white p-3 text-slate-700 shadow-lg">
                    <label className="flex items-center gap-3 text-sm">
                      <Volume2 className="h-5 w-5 shrink-0 text-exam-bar" aria-hidden="true" />
                      <span className="sr-only">Volume</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={volume}
                        onChange={(event) => setVolume(Number(event.target.value))}
                        className="w-full accent-exam-bar"
                        aria-label="Volume"
                      />
                    </label>
                  </div>
                )}
              </div>
            ) : undefined
          }
          onExit={exitExam}
        />
      )}
      <main
        className={`flex-1 overflow-auto ${
          isReadingItem || isSpeakingItem || section.section_type === 'listening' || section.section_type === 'writing'
            ? ''
            : 'p-6'
        }`}
      >
        {renderItem()}
      </main>
      {saveStatus.startsWith('Save failed') && (
        <div
          className="fixed bottom-6 left-1/2 z-30 w-[min(680px,calc(100%-2rem))] -translate-x-1/2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg"
          role="alert"
        >
          {saveStatus}
        </div>
      )}
      <SpeakingStopDialog open={showSpeakingStopDialog} />
      {reviewOpen && mod && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="font-semibold mb-3">Review</h3>
            <ul className="space-y-1 text-sm max-h-[60vh] overflow-y-auto">
              {reviewEntries.map((entry, i) => (
                <li key={`${entry.itemIdx}-${entry.label}-${i}`}>
                  <button
                    type="button"
                    className="text-left w-full hover:underline"
                    onClick={() => {
                      setItemIdx(entry.itemIdx);
                      setReviewOpen(false);
                    }}
                  >
                    {entry.label} {entry.answered ? '(answered)' : '(unanswered)'}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="mt-4 exam-btn-primary" onClick={() => setReviewOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
