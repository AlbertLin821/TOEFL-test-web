import { useRef, useState } from 'react';
import type { ExamItemDto } from '../../../api/client';

interface Props {
  item: ExamItemDto;
  value: { text?: string } | null;
  onChange: (v: { text: string }) => void;
}

export default function EssayItem({ item, value, onChange }: Props) {
  const text = value?.text ?? '';
  const [showWordCount, setShowWordCount] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

  const isEmail = item.item_type === 'writing_email';
  const content = item.content;

  function exec(command: 'cut' | 'paste' | 'undo' | 'redo') {
    textareaRef.current?.focus();
    if (command === 'paste') {
      navigator.clipboard
        .readText()
        .then((clip) => {
          const el = textareaRef.current;
          if (!el || !clip) return;
          const start = el.selectionStart;
          const end = el.selectionEnd;
          const next = text.slice(0, start) + clip + text.slice(end);
          onChange({ text: next });
        })
        .catch(() => {
          document.execCommand('paste');
        });
      return;
    }
    document.execCommand(command);
  }

  return (
    <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
      <div className="card p-6 max-h-[70vh] overflow-y-auto text-[15px] leading-7">
        {isEmail ? (
          <>
            <p className="whitespace-pre-wrap">{String(content.scenario ?? '')}</p>
            <p className="mt-4 font-semibold">Write an email to {String(content.to ?? '')}. In your email, do the following.</p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              {((content.task_points ?? []) as string[]).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-500">Write as much as you can and in complete sentences.</p>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500">{String(content.context ?? '')}</p>
            <div className="mt-4 rounded bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-bold text-slate-400 uppercase">Professor</p>
              <p className="mt-1 whitespace-pre-wrap">{String(content.professor_question ?? '')}</p>
            </div>
            {((content.student_posts ?? []) as { name: string; text: string }[]).map((post, i) => (
              <div key={i} className="mt-3 rounded bg-indigo-50/50 border border-indigo-100 p-4">
                <p className="text-xs font-bold text-indigo-400 uppercase">{post.name}</p>
                <p className="mt-1">{post.text}</p>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="flex flex-col">
        {isEmail && (
          <div className="mb-2 text-sm text-slate-600">
            <p>
              <span className="font-semibold">To</span>: {String(content.to ?? '')}
            </p>
            <p>
              <span className="font-semibold">Subject</span>: {String(content.subject ?? '')}
            </p>
          </div>
        )}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <button className="btn-secondary !py-1 !px-2 text-xs" onClick={() => exec('cut')}>
            Cut
          </button>
          <button className="btn-secondary !py-1 !px-2 text-xs" onClick={() => exec('paste')}>
            Paste
          </button>
          <button className="btn-secondary !py-1 !px-2 text-xs" onClick={() => exec('undo')}>
            Undo
          </button>
          <button className="btn-secondary !py-1 !px-2 text-xs" onClick={() => exec('redo')}>
            Redo
          </button>
          <div className="flex-1" />
          {showWordCount && (
            <span className="text-xs text-slate-500" aria-live="polite">
              Word Count: {wordCount}
            </span>
          )}
          <button className="btn-secondary !py-1 !px-2 text-xs" onClick={() => setShowWordCount((s) => !s)}>
            {showWordCount ? 'Hide Word Count' : 'Show Word Count'}
          </button>
        </div>
        <textarea
          ref={textareaRef}
          className="flex-1 min-h-[45vh] w-full rounded border border-slate-300 p-4 text-[15px] leading-7 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Type your response here."
          aria-label="Your response"
        />
        <p className="mt-2 text-xs text-slate-400">作答內容會自動儲存。</p>
      </div>
    </div>
  );
}
