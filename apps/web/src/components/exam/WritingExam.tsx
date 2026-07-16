import { useDroppable, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ClipboardPaste, Redo2, Scissors, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExamItemDetail, ExamModuleDetail } from '../../lib/api';

const WRITING_TASKS = [
  {
    type: 'Build a Sentence',
    description: 'Create a grammatical sentence.',
  },
  {
    type: 'Write an Email',
    description: 'Write an email using information provided.',
  },
  {
    type: 'Write for an Academic Discussion',
    description: 'Participate in an online discussion.',
  },
] as const;

export function WritingSectionIntro() {
  return (
    <div className="exam-flow-content max-w-4xl space-y-7 pt-16">
      <h1 className="exam-flow-title text-4xl">Writing Section</h1>
      <p className="max-w-4xl text-lg leading-8 text-slate-700">
        In the Writing section, you will answer 12 questions to demonstrate how well you can write in English. There
        are three types of tasks.
      </p>
      <table className="exam-section-task-table writing-section-table w-full max-w-2xl text-base">
        <thead>
          <tr>
            <th scope="col">Type of Task</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {WRITING_TASKS.map((task) => (
            <tr key={task.type}>
              <td>{task.type}</td>
              <td>{task.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WritingModuleIntro({ module }: { module: ExamModuleDetail }) {
  const minutes = Math.round((module.time_limit_seconds ?? 0) / 60);
  const isSentence = module.module_type === 'writing_build_sentence';

  return (
    <div className="exam-flow-content space-y-6">
      <h1 className="exam-flow-title">{module.title}</h1>
      <div className="max-w-4xl space-y-4 text-lg leading-8 text-slate-700">
        <p>{module.description}</p>
        {isSentence && (
          <p>
            There are 10 questions in this task. You will have <strong>6 minutes</strong> for all 10 questions, and
            you may use Back while you remain in this task.
          </p>
        )}
        {!isSentence && minutes > 0 && (
          <p>
            You will have <strong>{minutes} minutes</strong> to complete this task.
          </p>
        )}
      </div>
    </div>
  );
}

export function WritingTimeRemaining({ taskTitle }: { taskTitle: string }) {
  return (
    <div className="exam-flow-content space-y-6">
      <h1 className="exam-flow-title">Time Remaining</h1>
      <div className="max-w-4xl space-y-4 text-xl leading-9 text-slate-700">
        <p>You still have time to respond to {taskTitle}.</p>
        <p>As long as there is time remaining, you can keep writing or revise your response.</p>
        <p>
          Select <strong>Back</strong> to keep working. Select <strong>Continue</strong> to leave this task. Once you
          leave this task, you WILL NOT be able to return to it.
        </p>
      </div>
    </div>
  );
}

export function WritingSectionEnd() {
  return (
    <div className="exam-flow-content space-y-6">
      <h1 className="exam-flow-title text-4xl">End of Writing Section</h1>
      <p className="max-w-4xl text-xl leading-9 text-slate-700">
        Thank you for completing the writing section.
      </p>
    </div>
  );
}

function SortableWord({
  id,
  label,
  selected,
  disabled,
  onToggle,
}: {
  id: string;
  label: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      disabled={disabled}
      className={`writing-token ${selected ? 'writing-token-selected' : ''} ${isDragging ? 'writing-token-dragging' : ''}`}
      onClick={onToggle}
      aria-label={`${selected ? 'Remove' : 'Add'} “${label}”`}
    >
      {label}
    </button>
  );
}

function DroppableSentence({
  ids,
  labels,
  emptySlots,
  disabled,
  onRemove,
}: {
  ids: string[];
  labels: Map<string, string>;
  emptySlots: number;
  disabled: boolean;
  onRemove: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'sentence-zone' });
  return (
    <div ref={setNodeRef} className={`writing-sentence-zone ${isOver ? 'writing-drop-active' : ''}`}>
      <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
        {ids.map((id) => (
          <SortableWord
            key={id}
            id={id}
            label={labels.get(id) ?? ''}
            selected
            disabled={disabled}
            onToggle={() => onRemove(id)}
          />
        ))}
      </SortableContext>
      {Array.from({ length: emptySlots }, (_, index) => (
        <span key={`slot-${index}`} className="writing-empty-slot" aria-hidden="true" />
      ))}
    </div>
  );
}

export function WritingSentenceQuestion({
  item,
  orderedTokens,
  disabled = false,
  onChange,
}: {
  item: ExamItemDetail;
  orderedTokens: string[];
  disabled?: boolean;
  onChange: (orderedTokens: string[]) => void;
}) {
  const tokens = (item.content.tokens as string[]) ?? [];
  const allIds = useMemo(() => tokens.map((token, index) => `${item.id}:${index}:${token}`), [item.id, tokens]);
  const labels = useMemo(() => new Map(allIds.map((id, index) => [id, tokens[index]])), [allIds, tokens]);
  const selectedIds = useMemo(() => {
    const pool = [...allIds];
    const selected: string[] = [];
    for (const token of orderedTokens) {
      const index = pool.findIndex((id) => labels.get(id) === token);
      if (index >= 0) selected.push(...pool.splice(index, 1));
    }
    return selected;
  }, [allIds, labels, orderedTokens]);
  const availableIds = allIds.filter((id) => !selectedIds.includes(id));
  const slotCount = Math.max(1, Number(item.content.slot_count ?? tokens.length));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const saveIds = (ids: string[]) => onChange(ids.map((id) => labels.get(id) ?? ''));
  const addToken = (id: string) => {
    if (disabled || selectedIds.length >= slotCount) return;
    saveIds([...selectedIds, id]);
  };
  const removeToken = (id: string) => {
    if (!disabled) saveIds(selectedIds.filter((selectedId) => selectedId !== id));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (disabled || !over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeIndex = selectedIds.indexOf(activeId);
    const overIndex = selectedIds.indexOf(overId);
    const draggedFromSentence = activeIndex >= 0;
    const droppedInSentence = overId === 'sentence-zone' || overIndex >= 0;

    if (draggedFromSentence && droppedInSentence) {
      if (overId === 'sentence-zone' || activeId === overId) return;
      saveIds(arrayMove(selectedIds, activeIndex, overIndex));
      return;
    }
    if (!draggedFromSentence && droppedInSentence) {
      if (selectedIds.length >= slotCount) return;
      const insertAt = overIndex >= 0 ? overIndex : selectedIds.length;
      const next = [...selectedIds];
      next.splice(insertAt, 0, activeId);
      saveIds(next);
      return;
    }
    if (draggedFromSentence) removeToken(activeId);
  };

  return (
    <div className="writing-sentence-page">
      <h2>Make an appropriate sentence.</h2>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="writing-dialogue">
          <div className="writing-dialogue-turn">
            <img className="writing-avatar-one" src="/exam/writing/dialogue-avatars.png" alt="First speaker" />
            <p>{String(item.content.question_text ?? '')}</p>
          </div>
          <div className="writing-dialogue-turn">
            <img className="writing-avatar-two" src="/exam/writing/dialogue-avatars.png" alt="Second speaker" />
            <div className="flex flex-wrap items-center gap-2">
              {Boolean(item.content.prefix) && <span>{String(item.content.prefix)}</span>}
              <DroppableSentence
                ids={selectedIds}
                labels={labels}
                emptySlots={Math.max(0, slotCount - selectedIds.length)}
                disabled={disabled}
                onRemove={removeToken}
              />
              {Boolean(item.content.suffix) && <span>{String(item.content.suffix)}</span>}
            </div>
          </div>
        </div>
        <p className="writing-drag-hint">Drag words into the sentence. Select a word to move it in or out.</p>
        <SortableContext items={availableIds} strategy={horizontalListSortingStrategy}>
          <div className="writing-word-bank" aria-label="Available words">
            {availableIds.map((id) => (
              <SortableWord
                key={id}
                id={id}
                label={labels.get(id) ?? ''}
                selected={false}
                disabled={disabled}
                onToggle={() => addToken(id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface WritingEssayQuestionProps {
  item: ExamItemDetail;
  text: string;
  saveStatus: string;
  disabled?: boolean;
  onChange: (text: string) => void;
}

export function WritingEssayQuestion({ item, text, saveStatus, disabled = false, onChange }: WritingEssayQuestionProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const historyRef = useRef<string[]>([text]);
  const historyIndexRef = useRef(0);
  const editorClipboardRef = useRef('');
  const hasLocalEditsRef = useRef(false);
  const [hideCount, setHideCount] = useState(false);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  useEffect(() => {
    historyRef.current = [text];
    historyIndexRef.current = 0;
    hasLocalEditsRef.current = false;
    setHideCount(false);
    // Reset the editor history only when moving to another writing task.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    if (hasLocalEditsRef.current) return;
    historyRef.current = [text];
    historyIndexRef.current = 0;
  }, [text]);

  const commit = (next: string) => {
    hasLocalEditsRef.current = true;
    const history = historyRef.current.slice(0, historyIndexRef.current + 1);
    if (history[history.length - 1] !== next) history.push(next);
    historyRef.current = history;
    historyIndexRef.current = history.length - 1;
    onChange(next);
  };

  const replaceSelection = (replacement: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    commit(`${text.slice(0, start)}${replacement}${text.slice(end)}`);
    window.requestAnimationFrame(() => {
      const cursor = start + replacement.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const cut = async () => {
    const textarea = textareaRef.current;
    if (!textarea || textarea.selectionStart === textarea.selectionEnd) return;
    const selection = text.slice(textarea.selectionStart, textarea.selectionEnd);
    editorClipboardRef.current = selection;
    try {
      await navigator.clipboard?.writeText(selection);
    } catch {
      // The in-editor clipboard remains available when browser clipboard permission is denied.
    }
    replaceSelection('');
  };

  const paste = async () => {
    let clipboardText = editorClipboardRef.current;
    try {
      clipboardText = (await navigator.clipboard?.readText()) || clipboardText;
    } catch {
      // Fall back to the most recent text cut in this editor.
    }
    if (clipboardText) replaceSelection(clipboardText);
  };
  const undo = () => {
    if (historyIndexRef.current <= 0) return;
    hasLocalEditsRef.current = true;
    historyIndexRef.current -= 1;
    onChange(historyRef.current[historyIndexRef.current]);
  };
  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    hasLocalEditsRef.current = true;
    historyIndexRef.current += 1;
    onChange(historyRef.current[historyIndexRef.current]);
  };

  const toolbar = [
    { label: 'Cut', icon: Scissors, action: () => void cut() },
    { label: 'Paste', icon: ClipboardPaste, action: () => void paste() },
    { label: 'Undo', icon: Undo2, action: undo },
    { label: 'Redo', icon: Redo2, action: redo },
  ] as const;

  return (
    <div className="writing-essay-layout">
      <section className="writing-prompt-panel">
        {item.item_type === 'writing_email' ? (
          <>
            <h2 className="sr-only">Write an Email</h2>
            <p>{String(item.content.scenario ?? '')}</p>
            <ul>
              {((item.content.task_points as string[]) ?? []).map((task) => (
                <li key={task}>{task}</li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h2 className="sr-only">Professor’s Question</h2>
            <p>{String(item.content.context ?? '')}</p>
            <div className="writing-professor-profile">
              <img src="/exam/writing/academic-professor.png" alt="Professor" />
              <strong>{String(item.content.professor_name ?? 'Professor')}</strong>
            </div>
            <p className="writing-professor-question">{String(item.content.professor_question ?? '')}</p>
          </>
        )}
      </section>
      <section className="writing-response-panel">
        <h2 className={item.item_type === 'writing_email' ? undefined : 'sr-only'}>Your Response</h2>
        {item.item_type === 'writing_email' ? (
          <div className="writing-email-meta">
            <p><strong>To:</strong> {String(item.content.to ?? '')}</p>
            <p><strong>Subject:</strong> {String(item.content.subject ?? '')}</p>
          </div>
        ) : (
          <div className="writing-student-posts">
            {((item.content.student_posts as { name: string; text: string }[]) ?? []).map((post, index) => (
              <article key={post.name}>
                <img
                  src={`/exam/writing/academic-student-${index === 0 ? 'one' : 'two'}.png`}
                  alt=""
                  aria-hidden="true"
                />
                <div>
                  <strong>{post.name}</strong>
                  <p>{post.text}</p>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="writing-editor-toolbar">
          <div className="flex items-center gap-2">
            {toolbar.map(({ label, icon: Icon, action }) => (
              <button key={label} type="button" disabled={disabled} onClick={action}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" disabled={disabled} onClick={() => setHideCount((hidden) => !hidden)}>
              {hideCount ? 'Show Word Count' : 'Hide Word Count'}
            </button>
            {!hideCount && <output aria-label="Word count">{words}</output>}
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={text}
          disabled={disabled}
          onChange={(event) => commit(event.target.value)}
          aria-label="Your response"
          spellCheck
        />
        <p className="writing-save-status" role="status">{saveStatus}</p>
      </section>
    </div>
  );
}
