import { useMemo } from 'react';
import type { ExamItemDto } from '../../../api/client';

interface Props {
  item: ExamItemDto;
  value: { blanks?: string[] } | null;
  onChange: (v: { blanks: string[] }) => void;
}

/** Renders a paragraph with inline blanks ({{1}}..{{n}}). */
export default function FillBlankItem({ item, value, onChange }: Props) {
  const template = String(item.content.template ?? '');
  const blankCount = Number(item.content.blank_count ?? 0);
  const blanks = useMemo(() => {
    const v = value?.blanks ?? [];
    return Array.from({ length: blankCount }, (_, i) => v[i] ?? '');
  }, [value, blankCount]);

  const parts = useMemo(() => template.split(/(\{\{\d+\}\})/g), [template]);

  function setBlank(index: number, text: string) {
    const next = [...blanks];
    next[index] = text;
    onChange({ blanks: next });
  }

  return (
    <div className="max-w-3xl mx-auto">
      {typeof item.content.instructions === 'string' && (
        <p className="font-semibold mb-4">{item.content.instructions}</p>
      )}
      <p className="leading-9 text-[15px]">
        {parts.map((part, i) => {
          const m = part.match(/^\{\{(\d+)\}\}$/);
          if (!m) return <span key={i}>{part}</span>;
          const idx = Number(m[1]) - 1;
          return (
            <input
              key={i}
              type="text"
              className="inline-block w-24 mx-1 border-b-2 border-slate-400 bg-amber-50 px-1 text-center text-[15px] focus:outline-none focus:border-indigo-600"
              value={blanks[idx] ?? ''}
              onChange={(e) => setBlank(idx, e.target.value)}
              aria-label={`Blank ${idx + 1}`}
            />
          );
        })}
      </p>
      <p className="mt-4 text-xs text-slate-400">請在黃色空格中填入缺少的字母。</p>
    </div>
  );
}
