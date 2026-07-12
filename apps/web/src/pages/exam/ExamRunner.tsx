import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  api,
  type AttemptDto,
  type ExamItemDto,
  type ExamModuleDto,
  type ExamSectionDto,
  type ExamVersionDto,
} from '../../api/client';
import { FullScreenLoading } from '../../App';
import TopBar from './TopBar';
import HardwareCheck from './HardwareCheck';
import FillBlankItem from './items/FillBlankItem';
import ChoiceItem from './items/ChoiceItem';
import ListeningItem from './items/ListeningItem';
import SentenceOrderItem from './items/SentenceOrderItem';
import EssayItem from './items/EssayItem';
import SpeakingItem from './items/SpeakingItem';

type Screen =
  | { type: 'section-cover'; section: ExamSectionDto }
  | { type: 'module-intro'; section: ExamSectionDto; module: ExamModuleDto }
  | { type: 'item'; section: ExamSectionDto; module: ExamModuleDto; item: ExamItemDto; indexInModule: number }
  | { type: 'submit-confirm' };

const SECTION_LABEL: Record<string, string> = {
  reading: 'Reading',
  listening: 'Listening',
  writing: 'Writing',
  speaking: 'Speaking',
};

export default function ExamRunner() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const attemptQuery = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => api.get<AttemptDto>(`/attempts/${attemptId}`),
    staleTime: Infinity,
  });

  const examQuery = useQuery({
    queryKey: ['exam-version', attemptQuery.data?.exam_version_id],
    queryFn: () => api.get<ExamVersionDto>(`/exam-versions/${attemptQuery.data!.exam_version_id}`),
    enabled: !!attemptQuery.data?.exam_version_id,
    staleTime: Infinity,
  });

  if (attemptQuery.isLoading || examQuery.isLoading) return <FullScreenLoading />;
  if (attemptQuery.isError || !attemptQuery.data) {
    return <ErrorScreen message="無法載入考試作答狀態" onBack={() => navigate('/student')} />;
  }
  if (['submitted', 'grading'].includes(attemptQuery.data.status)) {
    navigate(`/grading/${attemptId}`, { replace: true });
    return null;
  }
  if (attemptQuery.data.status === 'completed') {
    navigate(`/reports/${attemptId}`, { replace: true });
    return null;
  }
  if (!examQuery.data) return <FullScreenLoading />;

  return <ExamSession attempt={attemptQuery.data} exam={examQuery.data} />;
}

function ErrorScreen({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-red-600">{message}</p>
      <button className="btn-secondary" onClick={onBack}>
        回到考試清單
      </button>
    </div>
  );
}

function ExamSession({ attempt, exam }: { attempt: AttemptDto; exam: ExamVersionDto }) {
  const navigate = useNavigate();
  const attemptId = attempt.id;

  // ---------- flatten screens ----------
  const screens = useMemo<Screen[]>(() => {
    const list: Screen[] = [];
    for (const section of exam.sections) {
      list.push({ type: 'section-cover', section });
      for (const mod of section.modules) {
        list.push({ type: 'module-intro', section, module: mod });
        mod.items.forEach((item, i) => {
          list.push({ type: 'item', section, module: mod, item, indexInModule: i });
        });
      }
    }
    list.push({ type: 'submit-confirm' });
    return list;
  }, [exam]);

  // ---------- restore state ----------
  const initialResponses = useMemo(() => {
    const map = new Map<string, unknown>();
    for (const r of attempt.responses) map.set(r.exam_item_id, r.response);
    return map;
  }, [attempt]);

  const answeredAudio = useMemo(
    () => new Set(attempt.audio_responses.map((a) => a.exam_item_id)),
    [attempt],
  );

  const initialIndex = useMemo(() => {
    if (attempt.status === 'hardware_check') return 0;
    if (attempt.current_item_id) {
      const idx = screens.findIndex((s) => s.type === 'item' && s.item.id === attempt.current_item_id);
      if (idx >= 0) return idx;
    }
    return 0;
  }, [attempt, screens]);

  const [needsHardwareCheck, setNeedsHardwareCheck] = useState(attempt.status === 'hardware_check');
  const [index, setIndex] = useState(initialIndex);
  const [responses, setResponses] = useState<Map<string, unknown>>(initialResponses);
  const [uploadedAudio, setUploadedAudio] = useState<Set<string>>(answeredAudio);
  const [volume, setVolume] = useState(0.8);
  const [showReview, setShowReview] = useState(false);
  const [saving, setSaving] = useState(false);

  // module remaining seconds, keyed by module id
  const moduleTimeRef = useRef<Map<string, number>>(new Map());
  useMemo(() => {
    for (const st of attempt.section_states) {
      if (st.module_id && st.remaining_seconds !== null) {
        moduleTimeRef.current.set(st.module_id, st.remaining_seconds);
      }
    }
  }, [attempt]);

  const screen = screens[index];

  // ---------- persistence helpers ----------
  const saveResponse = useCallback(
    async (itemId: string, value: unknown) => {
      setResponses((prev) => {
        const next = new Map(prev);
        next.set(itemId, value);
        return next;
      });
      setSaving(true);
      try {
        await api.patch(`/attempts/${attemptId}/response`, {
          exam_item_id: itemId,
          response_json: value,
        });
      } catch {
        // keep local value; will retry on next change
      } finally {
        setSaving(false);
      }
    },
    [attemptId],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const saveResponseDebounced = useCallback(
    (itemId: string, value: unknown) => {
      setResponses((prev) => {
        const next = new Map(prev);
        next.set(itemId, value);
        return next;
      });
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void api
          .patch(`/attempts/${attemptId}/response`, { exam_item_id: itemId, response_json: value })
          .catch(() => {});
      }, 800);
    },
    [attemptId],
  );

  const saveSectionState = useCallback(
    (sectionId: string, moduleId: string | null, status: string, remainingSeconds?: number, currentItemId?: string | null) => {
      void api
        .patch(`/attempts/${attemptId}/section-state`, {
          section_id: sectionId,
          module_id: moduleId,
          status,
          ...(remainingSeconds !== undefined ? { remaining_seconds: remainingSeconds } : {}),
          ...(currentItemId !== undefined ? { current_item_id: currentItemId } : {}),
        })
        .catch(() => {});
    },
    [attemptId],
  );

  // ---------- module countdown ----------
  const currentModule = screen.type === 'item' || screen.type === 'module-intro' ? screen.module : null;
  const timedModuleId =
    screen.type === 'item' && screen.module.time_limit_seconds !== null ? screen.module.id : null;
  const [moduleRemaining, setModuleRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!timedModuleId) {
      setModuleRemaining(null);
      return;
    }
    const stored = moduleTimeRef.current.get(timedModuleId);
    const limit = currentModule?.time_limit_seconds ?? 0;
    setModuleRemaining(stored !== undefined ? stored : limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedModuleId]);

  useEffect(() => {
    if (timedModuleId === null || moduleRemaining === null) return;
    if (moduleRemaining <= 0) {
      // time up: jump to first screen after this module's items
      const nextIdx = screens.findIndex(
        (s, i) => i > index && !(s.type === 'item' && s.module.id === timedModuleId),
      );
      if (nextIdx >= 0) setIndex(nextIdx);
      return;
    }
    const t = setTimeout(() => {
      const next = moduleRemaining - 1;
      moduleTimeRef.current.set(timedModuleId, next);
      setModuleRemaining(next);
      if (next % 15 === 0 && screen.type === 'item') {
        saveSectionState(screen.section.id, timedModuleId, 'in_progress', next, screen.item.id);
      }
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleRemaining, timedModuleId]);

  // ---------- navigation ----------
  const goNext = useCallback(() => {
    setShowReview(false);
    setIndex((i) => Math.min(i + 1, screens.length - 1));
  }, [screens.length]);

  const goBack = useCallback(() => {
    if (screen.type !== 'item' || !screen.module.allow_back || screen.indexInModule === 0) return;
    setIndex((i) => i - 1);
  }, [screen]);

  // persist current item pointer on item change
  useEffect(() => {
    if (screen.type === 'item') {
      saveSectionState(
        screen.section.id,
        screen.module.id,
        'in_progress',
        timedModuleId ? (moduleTimeRef.current.get(timedModuleId) ?? undefined) : undefined,
        screen.item.id,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const handleExit = useCallback(() => {
    if (window.confirm('確定要離開考試嗎？你的作答已自動儲存，可稍後回來繼續。')) {
      navigate('/student');
    }
  }, [navigate]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post(`/attempts/${attemptId}/submit`);
      navigate(`/grading/${attemptId}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '交卷失敗，請重試');
      setSubmitting(false);
    }
  }

  // ---------- hardware check gate ----------
  if (needsHardwareCheck) {
    return (
      <HardwareCheck
        onExit={handleExit}
        onComplete={() => {
          void api.post(`/attempts/${attemptId}/hardware-check-complete`).catch(() => {});
          setNeedsHardwareCheck(false);
        }}
      />
    );
  }

  // ---------- render ----------
  if (screen.type === 'section-cover') {
    return (
      <CoverLayout
        onExit={handleExit}
        title={`${SECTION_LABEL[screen.section.section_type]} Section`}
        onContinue={goNext}
      >
        <SectionCoverContent section={screen.section} />
      </CoverLayout>
    );
  }

  if (screen.type === 'module-intro') {
    return (
      <CoverLayout onExit={handleExit} title={screen.module.title} onContinue={goNext}>
        <p className="text-[15px] leading-7 whitespace-pre-wrap text-slate-700">{screen.module.description}</p>
        {screen.module.time_limit_seconds !== null && (
          <p className="mt-4 text-sm text-slate-500">
            作答時間：{Math.round(screen.module.time_limit_seconds / 60)} 分鐘
          </p>
        )}
      </CoverLayout>
    );
  }

  if (screen.type === 'submit-confirm') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <TopBar sectionName="Submit" onExit={handleExit} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="card max-w-xl w-full p-8 text-center">
            <h2 className="text-xl font-bold">交卷確認</h2>
            <p className="mt-4 text-sm text-slate-600">
              你已完成所有 section。按下 Submit 後將無法再修改作答內容，系統會開始自動批改。
            </p>
            {submitError && <p className="mt-3 text-sm text-red-600">{submitError}</p>}
            <button className="btn-primary mt-6 w-40" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // item screen
  const { section, module: mod, item } = screen;
  const value = responses.get(item.id) ?? null;
  const questionNumber = (item.content.question_number as number | undefined) ?? screen.indexInModule + 1;
  const isListening = section.section_type === 'listening';
  const isSpeaking = section.section_type === 'speaking';
  const showNavNext = !isSpeaking;
  const nextLabel =
    index + 1 < screens.length && screens[index + 1].type !== 'item' ? 'Continue' : 'Next';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <TopBar
        sectionName={`${SECTION_LABEL[section.section_type]} | ${mod.title}`}
        questionLabel={`Question ${questionNumber} of ${mod.items.length}`}
        remainingSeconds={moduleRemaining}
        showBack={mod.allow_back && screen.indexInModule > 0}
        showNext={showNavNext}
        onBack={goBack}
        onNext={goNext}
        onExit={handleExit}
        showReview={mod.allow_review}
        onReview={() => setShowReview(true)}
        volumeControl={isListening || isSpeaking}
        volume={volume}
        onVolumeChange={setVolume}
        nextLabel={nextLabel}
      />

      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        {item.item_type === 'reading_fill_blank' && (
          <FillBlankItem
            item={item}
            value={value as { blanks?: string[] } | null}
            onChange={(v) => saveResponseDebounced(item.id, v)}
          />
        )}
        {item.item_type === 'reading_single_choice' && (
          <ChoiceItem
            item={item}
            value={value as { selected_option_index?: number } | null}
            onChange={(v) => void saveResponse(item.id, v)}
          />
        )}
        {item.item_type === 'listening_single_choice' && (
          <ListeningItem
            key={item.id}
            item={item}
            value={value as { selected_option_index?: number } | null}
            volume={volume}
            onChange={(v) => void saveResponse(item.id, v)}
            onTimeExpired={goNext}
          />
        )}
        {item.item_type === 'writing_sentence_order' && (
          <SentenceOrderItem
            item={item}
            value={value as { ordered_tokens?: string[] } | null}
            onChange={(v) => void saveResponse(item.id, v)}
          />
        )}
        {(item.item_type === 'writing_email' || item.item_type === 'writing_academic_discussion') && (
          <EssayItem
            item={item}
            value={value as { text?: string } | null}
            onChange={(v) => saveResponseDebounced(item.id, v)}
          />
        )}
        {(item.item_type === 'speaking_listen_repeat' || item.item_type === 'speaking_interview') && (
          <SpeakingItem
            key={item.id}
            item={item}
            volume={volume}
            alreadyAnswered={uploadedAudio.has(item.id)}
            onUpload={async (blob, durationMs) => {
              const form = new FormData();
              form.append('audio', blob, 'response.webm');
              form.append('exam_item_id', item.id);
              form.append('duration_ms', String(durationMs));
              await api.postForm(`/attempts/${attemptId}/audio`, form);
              setUploadedAudio((prev) => new Set(prev).add(item.id));
            }}
            onComplete={goNext}
          />
        )}
      </main>

      <footer className="px-4 py-2 text-xs text-slate-400 flex justify-between bg-white border-t border-slate-200">
        <span>{saving ? '儲存中...' : '作答內容會自動儲存'}</span>
        <span>此為模擬測驗，非 ETS 官方 TOEFL 考試</span>
      </footer>

      {showReview && mod.allow_review && (
        <ReviewPanel
          module={mod}
          responses={responses}
          currentItemId={item.id}
          onJump={(itemId) => {
            const idx = screens.findIndex((s) => s.type === 'item' && s.item.id === itemId);
            if (idx >= 0) setIndex(idx);
            setShowReview(false);
          }}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  );
}

function CoverLayout({
  title,
  children,
  onContinue,
  onExit,
}: {
  title: string;
  children: React.ReactNode;
  onContinue: () => void;
  onExit: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <TopBar sectionName={title} onExit={onExit} />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="card max-w-2xl w-full p-8">
          <h2 className="text-xl font-bold text-center">{title}</h2>
          <div className="mt-6">{children}</div>
          <div className="mt-8 text-center">
            <button className="btn-primary w-40" onClick={onContinue}>
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCoverContent({ section }: { section: ExamSectionDto }) {
  const desc: Record<string, string> = {
    reading:
      'In this section, you will answer questions about reading materials in English. You can use Next and Back within the same module, but you cannot return to a previous module.',
    listening:
      'In this section, you will answer questions about spoken English. Each audio plays only once. You cannot return to previous questions.',
    writing:
      'In this section, you will complete Build a Sentence, Write an Email, and Academic Discussion tasks.',
    speaking:
      'In this section, you will listen and repeat sentences, and answer interview questions. Your voice will be recorded.',
  };
  return (
    <div className="text-[15px] leading-7 text-slate-700">
      <p>{desc[section.section_type]}</p>
      <p className="mt-3 text-sm text-slate-500">
        Modules: {section.modules.map((m) => m.title).join(' / ')}
      </p>
    </div>
  );
}

function ReviewPanel({
  module: mod,
  responses,
  currentItemId,
  onJump,
  onClose,
}: {
  module: ExamModuleDto;
  responses: Map<string, unknown>;
  currentItemId: string;
  onJump: (itemId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Review - {mod.title}</h3>
          <button className="btn-secondary !py-1 !px-3 text-xs" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {mod.items.map((it, i) => {
            const answered = responses.has(it.id);
            const isCurrent = it.id === currentItemId;
            return (
              <button
                key={it.id}
                onClick={() => onJump(it.id)}
                className={`rounded border px-2 py-2 text-xs font-semibold ${
                  isCurrent
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : answered
                      ? 'border-green-400 bg-green-50 text-green-800'
                      : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                Q{(it.content.question_number as number | undefined) ?? i + 1}
                <span className="block text-[10px] font-normal">{answered ? 'Answered' : 'Unanswered'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
