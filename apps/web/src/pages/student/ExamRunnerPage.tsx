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
import { useCountdown } from '../../hooks/useCountdown';
import { api, type ExamItemDetail, type ExamModuleDetail, type ExamSectionDetail } from '../../lib/api';

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
  const [phase, setPhase] = useState<'section_intro' | 'module_intro' | 'item' | 'section_end'>('section_intro');
  const [showTimer, setShowTimer] = useState(true);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [listeningLocked, setListeningLocked] = useState(true);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const [speakingPhase, setSpeakingPhase] = useState<'idle' | 'playing' | 'recording' | 'uploading'>('idle');
  const [saveStatus, setSaveStatus] = useState('');

  const attemptQuery = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => api.getAttempt(attemptId!),
    enabled: !!attemptId,
  });

  const examQuery = useQuery({
    queryKey: ['exam-version', attemptQuery.data?.exam_version_id],
    queryFn: () => api.getExamVersion(attemptQuery.data!.exam_version_id),
    enabled: !!attemptQuery.data?.exam_version_id,
  });

  useEffect(() => {
    if (attemptQuery.data?.responses) {
      const map: Record<string, unknown> = {};
      for (const r of attemptQuery.data.responses) map[r.exam_item_id] = r.response;
      setAnswers(map);
    }
  }, [attemptQuery.data]);

  const sections = examQuery.data?.sections ?? [];
  const section: ExamSectionDetail | undefined = sections[sectionIdx];
  const mod: ExamModuleDetail | undefined = section?.modules[moduleIdx];
  const item: ExamItemDetail | undefined = mod?.items[itemIdx];

  const moduleTimer = useCountdown(mod?.time_limit_seconds ?? 0, phase === 'item' && !!mod?.time_limit_seconds, () => {
    goNext();
  });

  const itemTimer = useCountdown(item?.time_limit_seconds ?? 0, phase === 'item' && !!item?.time_limit_seconds, () => {
    if (section?.section_type === 'listening') goNext();
    if (section?.section_type === 'speaking') stopSpeaking();
  });

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

  const goNext = async () => {
    if (!section || !mod) return;
    setReviewOpen(false);
    if (itemIdx < mod.items.length - 1) {
      setItemIdx((i) => i + 1);
      setListeningLocked(section.section_type === 'listening');
      return;
    }
    if (moduleIdx < section.modules.length - 1) {
      setModuleIdx((m) => m + 1);
      setItemIdx(0);
      setPhase('module_intro');
      return;
    }
    if (sectionIdx < sections.length - 1) {
      setPhase('section_end');
      return;
    }
    if (attemptId) {
      await api.submitAttempt(attemptId);
      navigate(`/exam/${attemptId}/grading`);
    }
  };

  const goBack = () => {
    if (!mod?.allow_back || itemIdx === 0) return;
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
    if (section?.section_type === 'speaking' && item) {
      void runSpeakingItem(item);
    }
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

  const stopSpeaking = async () => {
    const mr = mediaRecorder.current;
    if (!mr || mr.state !== 'recording') return;
    setSpeakingPhase('uploading');
    mr.stop();
  };

  const runSpeakingItem = async (speakItem: ExamItemDetail) => {
    setSpeakingPhase('playing');
    const promptUrl = speakItem.assets[0]?.url;
    const responseSeconds = Number(speakItem.content.response_seconds ?? 45);

    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        mediaRecorder.current = mr;
        const chunks: Blob[] = [];
        mr.ondataavailable = (e) => chunks.push(e.data);
        mr.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: 'audio/webm' });
          if (attemptId) {
            await api.uploadAudio(attemptId, speakItem.id, blob, responseSeconds * 1000);
          }
          setSpeakingPhase('idle');
        };
        mr.start();
        setSpeakingPhase('recording');
        setTimeout(() => stopSpeaking(), responseSeconds * 1000);
      } catch {
        setSpeakingPhase('idle');
        alert('麥克風無法使用，請返回 Hardware Check 重新測試。');
      }
    };

    if (promptUrl) {
      const audio = new Audio(promptUrl);
      audio.volume = volume;
      audio.onended = () => void startRecording();
      await audio.play();
    } else {
      await startRecording();
    }
  };

  useEffect(() => {
    if (phase === 'item' && section?.section_type === 'speaking' && item) {
      void runSpeakingItem(item);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, phase, section?.section_type]);

  const sensors = useSensors(useSensor(PointerSensor));

  if (attemptQuery.isLoading || examQuery.isLoading) return <div className="p-8">Loading exam...</div>;
  if (!section) return <div className="p-8">Exam data unavailable.</div>;

  const questionLabel =
    phase === 'item' && item
      ? `Question ${item.content.question_number ?? item.order_no}`
      : section.title;

  const timer =
    item?.time_limit_seconds && section.section_type !== 'reading'
      ? itemTimer
      : mod?.time_limit_seconds
        ? moduleTimer
        : null;

  const renderItem = () => {
    if (!item) return null;
    const ans = answers[item.id] as Record<string, unknown> | undefined;

    if (item.item_type === 'reading_fill_blank') {
      const template = String(item.content.template ?? '');
      const blanks = (ans?.blanks as string[]) ?? Array(Number(item.content.blank_count ?? 10)).fill('');
      return (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{String(item.content.instructions)}</p>
          <div className="leading-8">
            {template.split(/(\{\{\d+\}\})/).map((part, i) => {
              const m = part.match(/\{\{(\d+)\}\}/);
              if (!m) return <span key={i}>{part}</span>;
              const idx = Number(m[1]) - 1;
              return (
                <input
                  key={i}
                  className="border-b-2 border-slate-800 mx-1 w-24 text-center"
                  value={blanks[idx] ?? ''}
                  onChange={(e) => {
                    const next = [...blanks];
                    next[idx] = e.target.value;
                    void saveAnswer(item.id, { blanks: next });
                  }}
                />
              );
            })}
          </div>
        </div>
      );
    }

    if (item.item_type.endsWith('single_choice')) {
      const selected = ans?.selected_option_index as number | undefined;
      const options = (item.content.options as string[]) ?? [];
      const stimulus = item.content.stimulus_text as string | undefined;
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
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const [hideCount, setHideCount] = useState(false);
      return (
        <div className="grid md:grid-cols-2 gap-6 h-[calc(100vh-120px)]">
          <div className="overflow-auto p-4 bg-slate-50 border rounded text-sm space-y-3">
            {item.item_type === 'writing_email' ? (
              <>
                <p>{String(item.content.scenario)}</p>
                <ul className="list-disc pl-5">
                  {((item.content.task_points as string[]) ?? []).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p>{String(item.content.context)}</p>
                <p className="font-medium">{String(item.content.professor_question)}</p>
                {((item.content.student_posts as { name: string; text: string }[]) ?? []).map((p) => (
                  <div key={p.name} className="border-t pt-2">
                    <p className="font-semibold">{p.name}</p>
                    <p>{p.text}</p>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="flex flex-col">
            {item.item_type === 'writing_email' && (
              <div className="text-sm mb-2 space-y-1">
                <p>To: {String(item.content.to)}</p>
                <p>Subject: {String(item.content.subject)}</p>
              </div>
            )}
            <textarea
              className="flex-1 border rounded p-3 font-mono text-sm"
              value={text}
              onChange={(e) => void saveAnswer(item.id, { text: e.target.value })}
            />
            <div className="flex justify-between items-center mt-2 text-sm">
              <button type="button" className="exam-btn-primary text-xs px-2 py-1" onClick={() => setHideCount((v) => !v)}>
                {hideCount ? 'Show Word Count' : 'Hide Word Count'}
              </button>
              {!hideCount && <span>Word count: {words}</span>}
              <span className="text-slate-500">{saveStatus}</span>
            </div>
          </div>
        </div>
      );
    }

    if (item.item_type.startsWith('speaking_')) {
      return (
        <div className="text-center space-y-6 py-12">
          {item.content.question_text && <p className="text-lg max-w-2xl mx-auto">{String(item.content.question_text)}</p>}
          <p className="text-sm text-slate-600" role="status">
            {speakingPhase === 'playing' && 'Playing prompt...'}
            {speakingPhase === 'recording' && 'Recording - speak now'}
            {speakingPhase === 'uploading' && 'Uploading recording...'}
            {speakingPhase === 'recording' && itemTimer <= 5 && 'Stop Speaking'}
          </p>
          {speakingPhase === 'recording' && (
            <button type="button" className="exam-btn-primary" onClick={() => void stopSpeaking()}>
              Stop Speaking
            </button>
          )}
        </div>
      );
    }

    return <p>Unsupported item type: {item.item_type}</p>;
  };

  if (phase === 'section_intro') {
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

  if (phase === 'module_intro' && mod) {
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

  if (phase === 'section_end') {
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
      <ExamTopBar
        sectionName={section.title}
        questionLabel={questionLabel}
        timerSeconds={timer}
        showTimer={showTimer}
        onToggleTimer={() => setShowTimer((v) => !v)}
        onReview={section.section_type === 'reading' ? () => setReviewOpen(true) : undefined}
        onBack={mod.allow_back && section.section_type !== 'listening' ? goBack : undefined}
        onNext={section.section_type === 'speaking' && speakingPhase !== 'idle' ? undefined : goNext}
        backDisabled={itemIdx === 0}
        extra={
          section.section_type === 'listening' || section.section_type === 'speaking' ? (
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
      <main className="flex-1 p-6 overflow-auto">{renderItem()}</main>
      {reviewOpen && mod && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="font-semibold mb-3">Review</h3>
            <ul className="space-y-1 text-sm">
              {mod.items.map((it, i) => (
                <li key={it.id}>
                  <button
                    type="button"
                    className="text-left w-full hover:underline"
                    onClick={() => {
                      setItemIdx(i);
                      setReviewOpen(false);
                    }}
                  >
                    Q{i + 1} {answers[it.id] ? '(answered)' : '(unanswered)'}
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
