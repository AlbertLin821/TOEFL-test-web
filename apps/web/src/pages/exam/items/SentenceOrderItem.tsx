import { useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ExamItemDto } from '../../../api/client';

interface Props {
  item: ExamItemDto;
  value: { ordered_tokens?: string[] } | null;
  onChange: (v: { ordered_tokens: string[] }) => void;
}

function SortableToken({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <button
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`rounded border-2 px-3 py-2 text-[15px] font-medium bg-white cursor-grab active:cursor-grabbing select-none ${
        isDragging ? 'border-indigo-600 shadow-lg z-10' : 'border-slate-300 hover:border-indigo-400'
      }`}
    >
      {label}
    </button>
  );
}

export default function SentenceOrderItem({ item, value, onChange }: Props) {
  const tokens = (item.content.tokens ?? []) as string[];
  const prefix = item.content.prefix as string | null;
  const suffix = item.content.suffix as string | null;
  const questionText = item.content.question_text as string | null;

  // ids must be unique even with duplicate token text
  const initialIds = useMemo(() => tokens.map((t, i) => `${i}::${t}`), [tokens]);
  const currentIds = useMemo(() => {
    const saved = value?.ordered_tokens;
    if (!saved || saved.length !== tokens.length) return initialIds;
    // Rebuild ids from saved order, consuming duplicates in order
    const pool = [...initialIds];
    const ids: string[] = [];
    for (const tok of saved) {
      const idx = pool.findIndex((id) => id.split('::')[1] === tok);
      if (idx === -1) return initialIds;
      ids.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return ids;
  }, [value, initialIds, tokens.length]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = currentIds.indexOf(String(active.id));
    const newIndex = currentIds.indexOf(String(over.id));
    const next = arrayMove(currentIds, oldIndex, newIndex);
    onChange({ ordered_tokens: next.map((id) => id.split('::')[1]) });
  }

  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-sm text-slate-500 mb-2">Make an appropriate sentence. 拖曳字詞方塊排出正確句子。</p>
      {questionText && <p className="font-semibold mb-6 text-lg">{questionText}</p>}

      <div className="card p-6">
        <div className="flex flex-wrap items-center gap-2">
          {prefix && <span className="text-[15px] font-medium text-slate-700">{prefix}</span>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={currentIds} strategy={horizontalListSortingStrategy}>
              <div className="flex flex-wrap gap-2">
                {currentIds.map((id) => (
                  <SortableToken key={id} id={id} label={id.split('::')[1]} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {suffix && <span className="text-[15px] font-medium text-slate-700">{suffix}</span>}
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-600">
        目前句子：
        <span className="font-medium">
          {prefix ? `${prefix} ` : ''}
          {currentIds.map((id) => id.split('::')[1]).join(' ')}
          {suffix ? ` ${suffix}` : ''}
        </span>
      </p>
    </div>
  );
}
