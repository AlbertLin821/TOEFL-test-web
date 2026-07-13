import { useState } from 'react';
import type { ExamItemDetail } from '../../lib/api';

interface WritingEssayQuestionProps {
  item: ExamItemDetail;
  text: string;
  saveStatus: string;
  onChange: (text: string) => void;
}

export default function WritingEssayQuestion({
  item,
  text,
  saveStatus,
  onChange,
}: WritingEssayQuestionProps) {
  const [hideCount, setHideCount] = useState(false);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="grid md:grid-cols-2 gap-6 h-[calc(100vh-120px)]">
      <div className="overflow-auto p-4 bg-slate-50 border rounded text-sm space-y-3">
        {item.item_type === 'writing_email' ? (
          <>
            <p>{String(item.content.scenario)}</p>
            <ul className="list-disc pl-5">
              {((item.content.task_points as string[]) ?? []).map((task) => (
                <li key={task}>{task}</li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p>{String(item.content.context)}</p>
            <p className="font-medium">{String(item.content.professor_question)}</p>
            {((item.content.student_posts as { name: string; text: string }[]) ?? []).map((post) => (
              <div key={post.name} className="border-t pt-2">
                <p className="font-semibold">{post.name}</p>
                <p>{post.text}</p>
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
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="flex justify-between items-center mt-2 text-sm">
          <button
            type="button"
            className="exam-btn-primary text-xs px-2 py-1"
            onClick={() => setHideCount((value) => !value)}
          >
            {hideCount ? 'Show Word Count' : 'Hide Word Count'}
          </button>
          {!hideCount && <span>Word count: {words}</span>}
          <span className="text-slate-500">{saveStatus}</span>
        </div>
      </div>
    </div>
  );
}
