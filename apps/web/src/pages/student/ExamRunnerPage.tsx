import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import WritingEssayQuestion from '../../components/exam/WritingEssayQuestion';
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

function SortableToken({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="px-3 py-2 bg-blue-100 border border-blue-300 rounded cursor-grab text-sm"
    >
      {id}
    </button>
  );
}

export default function ExamRunnerPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [sectionIdx, setSectionIdx] = useState(0);
  const [moduleIdx, setModuleIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);
  const [phase, setPhase] = useState<
    'section_intro' | 'module_intro' | 'module_scenario' | 'module_end' | 'item' | 'section_end'
  >('section_intro');
  const [showTimer, setShowTimer] = useState(true);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [listeningLocked, setListeningLocked] = useState(true);
  const [volume, setVolume] = useState(1);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
  const [debugReady, setDebugReady] = useState(!EXAM_DEBUG_START_AT_SPEAKING);

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

  const moduleTimer = useCountdown(mod?.time_limit_seconds ?? 0, phase === 'item' && !!mod?.time_limit_seconds, () => {
    goNext();
  });

  const itemTimer = useCountdown(item?.time_limit_seconds ?? 0, phase === 'item' && !!item?.time_limit_seconds && section?.section_type !== 'speaking', () => {
    if (section?.section_type === 'listening') goNext();
  });

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

  const saveAnswer = useCallback(
    async (itemId: string, response: unknown) => {
      if (!attemptId) return;
      setAnswers((prev) => ({ ...prev, [itemId]: response }));
      setSaveStatus('Saving...');
      try {
        await api.saveResponse(attemptId, itemId, response);
        setSaveStatus('Saved');
      } catch {
        setSaveStatus('Save failed - please do not close the page');
      }
    },
    [attemptId],
  );

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

  const finishExam = async () => {
    if (!attemptId) return;
    await api.submitAttempt(attemptId);
    navigate(`/exam/${attemptId}/grading`);
  };

  const goNext = async () => {
    if (!section || !mod) return;
    setReviewOpen(false);

    if (section.section_type === 'reading' && isStackedReadingGroup(mod.items, itemIdx)) {
      const { end } = getReadingChoiceGroupBounds(mod.items, itemIdx);
      const nextIdx = end + 1;
      if (nextIdx < mod.items.length) {
        setItemIdx(nextIdx);
        return;
      }
    } else if (itemIdx < mod.items.length - 1) {
      setItemIdx((i) => i + 1);
      setListeningLocked(section.section_type === 'listening');
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
    await finishExam();
  };

  const goBack = () => {
    if (!mod?.allow_back || itemIdx === 0) return;

    if (section?.section_type === 'reading' && isStackedReadingGroup(mod.items, itemIdx)) {
      const { start } = getReadingChoiceGroupBounds(mod.items, itemIdx);
      if (start > 0) {
        setItemIdx(start - 1);
        return;
      }
      return;
    }

    setItemIdx((i) => i - 1);
  };

  const nextSection = () => {
    setSectionIdx((s) => s + 1);
    setModuleIdx(0);
    setItemIdx(0);
    setPhase('section_intro');
    setListeningLocked(true);
  };

  const startSection = () => {
    setPhase('module_intro');
  };

  const startModule = () => {
    setPhase('item');
    setListeningLocked(section?.section_type === 'listening');
  };

  const continueFromModuleIntro = () => {
    if (section?.section_type === 'speaking' && mod?.module_type === 'speaking_listen_repeat') {
      setPhase('module_scenario');
      return;
    }
    startModule();
  };

  const continueFromModuleEnd = () => {
    setModuleIdx((m) => m + 1);
    setItemIdx(0);
    setPhase('module_intro');
  };

  const playListeningAudio = (url: string) => {
    setListeningLocked(true);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audio.volume = volume;
    audioRef.current = audio;
    audio.onended = () => setListeningLocked(false);
    audio.play().catch(() => setListeningLocked(false));
  };

  useEffect(() => {
    if (phase !== 'item' || section?.section_type !== 'listening' || !item) return;
    const url = item.assets[0]?.url;
    if (url) playListeningAudio(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, phase]);

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

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

  const sensors = useSensors(useSensor(PointerSensor));

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

  const questionLabel =
    phase === 'item' && item
      ? section.section_type === 'reading'
        ? getReadingQuestionLabel(section, item, mod?.items ?? [], itemIdx)
        : section.section_type === 'speaking'
          ? getSpeakingQuestionLabel(section, item)
          : `Question ${item.content.question_number ?? item.order_no}`
      : section.title;

  const timer =
    item?.time_limit_seconds && section.section_type !== 'reading'
      ? itemTimer
      : mod?.time_limit_seconds
        ? moduleTimer
        : null;

  const isReadingItem = section.section_type === 'reading' && phase === 'item';
  const isSpeakingItem = section.section_type === 'speaking' && phase === 'item';
  const speakingResponseSeconds = item && isSpeakingItem ? getSpeakingResponseSeconds(item) : 0;
  const speakingVolumeControl = getSpeakingVolumeControl(volume, volumeOpen, setVolume, setVolumeOpen);

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

      return (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-50 p-4 rounded border overflow-auto max-h-[60vh]">
            {item.content.stimulus_title && (
              <h3 className="font-semibold mb-2">{String(item.content.stimulus_title)}</h3>
            )}
            {stimulus && <pre className="whitespace-pre-wrap text-sm font-sans">{stimulus}</pre>}
            {item.content.instructions && (
              <p className="text-sm font-medium mt-4">{String(item.content.instructions)}</p>
            )}
          </div>
          <div>
            {item.content.question_text && <p className="font-medium mb-4">{String(item.content.question_text)}</p>}
            <div className="space-y-2">
              {options.map((opt, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-2 p-3 border rounded cursor-pointer ${
                    listeningLocked ? 'exam-disabled-option' : 'hover:bg-slate-50'
                  } ${selected === i ? 'border-blue-600 bg-blue-50' : ''}`}
                >
                  <input
                    type="radio"
                    name={item.id}
                    disabled={listeningLocked}
                    checked={selected === i}
                    onChange={() => void saveAnswer(item.id, { selected_option_index: i })}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
            {listeningLocked && (
              <p className="text-sm text-slate-500 mt-2" role="status">
                音檔播放中，選項暫時無法選取
              </p>
            )}
          </div>
        </div>
      );
    }

    if (item.item_type === 'writing_sentence_order') {
      const tokens = (ans?.ordered_tokens as string[]) ?? [...((item.content.tokens as string[]) ?? [])];
      const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = tokens.indexOf(String(active.id));
        const newIndex = tokens.indexOf(String(over.id));
        const next = arrayMove(tokens, oldIndex, newIndex);
        void saveAnswer(item.id, { ordered_tokens: next });
      };
      return (
        <div className="space-y-4">
          <p className="font-medium">{String(item.content.question_text)}</p>
          {(item.content.prefix || item.content.suffix) && (
            <p className="text-sm">
              {[item.content.prefix, '___', item.content.suffix].filter(Boolean).join(' ')}
            </p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={tokens} strategy={horizontalListSortingStrategy}>
              <div className="flex flex-wrap gap-2">
                {tokens.map((t) => (
                  <SortableToken key={t} id={t} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      );
    }

    if (item.item_type === 'writing_email' || item.item_type === 'writing_academic_discussion') {
      const text = (ans?.text as string) ?? '';
      return (
        <WritingEssayQuestion
          item={item}
          text={text}
          saveStatus={saveStatus}
          onChange={(next) => void saveAnswer(item.id, { text: next })}
        />
      );
    }

    if (item.item_type.startsWith('speaking_')) {
      return (
        <SpeakingQuestionPanel
          item={item}
          moduleDescription={mod?.description}
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
            description={mod.description}
            moduleType={mod.module_type}
            step={mod.module_type === 'speaking_listen_repeat' ? 'directions' : 'default'}
          />
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
          description={mod.description}
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
          backDisabled={itemIdx === 0}
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
          nextDisabled={speakingPhase !== 'idle'}
        />
      ) : (
        <ExamTopBar
          sectionName={section.title}
          questionLabel={questionLabel}
          timerSeconds={timer}
          showTimer={showTimer}
          onToggleTimer={() => setShowTimer((v) => !v)}
          onReview={section.section_type === 'reading' ? () => setReviewOpen(true) : undefined}
          onBack={mod.allow_back && section.section_type !== 'listening' ? goBack : undefined}
          onNext={goNext}
          backDisabled={itemIdx === 0}
          extra={
            section.section_type === 'listening' ? (
              <label className="exam-btn flex items-center gap-1">
                Volume
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              </label>
            ) : undefined
          }
        />
      )}
      <main className={`flex-1 overflow-auto ${isReadingItem || isSpeakingItem ? '' : 'p-6'}`}>{renderItem()}</main>
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
