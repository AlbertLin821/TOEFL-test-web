import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../auth';

interface AiFeedbackItem {
  exam_item_id: string;
  overall_score: number;
  rubric: Record<string, number>;
  feedback: {
    comments?: Record<string, string>;
    strengths?: string[];
    weaknesses?: string[];
    improvement_suggestions?: string[];
    transcript?: string | null;
    task_type?: string;
  };
  status: string;
  model_name: string;
}

interface ReportDto {
  attempt_id: string;
  status: string;
  student: { name: string; email: string };
  organization: string;
  class_name: string | null;
  teacher_name: string | null;
  exam_title: string;
  exam_version: string;
  completed_at: string | null;
  scores: {
    reading: number | null;
    listening: number | null;
    writing: number | null;
    speaking: number | null;
    total: number | null;
  };
  objective_stats:
    | { sectionType: string; totalQuestions: number; correctCount: number; scaledScore: number }[]
    | null;
  ai_feedback: { writing: AiFeedbackItem[]; speaking: AiFeedbackItem[] };
  teacher_comments: { id: string; teacher_name: string; comment_text: string; created_at: string }[];
  disclaimer: string;
}

const TASK_LABEL: Record<string, string> = {
  writing_email: 'Write an Email',
  writing_academic_discussion: 'Academic Discussion',
  speaking_listen_repeat: 'Listen and Repeat',
  speaking_interview: 'Take an Interview',
};

export default function ReportPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['report', attemptId],
    queryFn: () => api.get<ReportDto>(`/reports/${attemptId}`),
    retry: false,
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) =>
      api.patch(`/reports/${attemptId}/teacher-comment`, { comment_text: text }),
    onSuccess: () => {
      setComment('');
      void queryClient.invalidateQueries({ queryKey: ['report', attemptId] });
    },
  });

  async function downloadPdf() {
    const { download_url } = await api.get<{ download_url: string }>(`/reports/${attemptId}/pdf`);
    window.open(download_url, '_blank');
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">載入報告中...</div>;
  }
  if (isError || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-slate-600">報告尚未完成或無法存取。</p>
        <button className="btn-secondary" onClick={() => navigate(-1)}>
          返回
        </button>
      </div>
    );
  }

  const isTeacherView = user && user.role !== 'student';

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-indigo-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Score Report</h1>
            <p className="text-xs text-indigo-200">{report.exam_title}（{report.exam_version}）</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-bar" onClick={downloadPdf}>
              Download PDF
            </button>
            <button className="btn-bar" onClick={() => navigate(user?.role === 'student' ? '/student' : '/teacher')}>
              Back
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="rounded bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-800">
          {report.disclaimer} 此成績為模擬測驗結果，非 ETS 官方 TOEFL 成績。
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-slate-700">基本資料</h2>
          <dl className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <div><dt className="text-slate-400">學生</dt><dd className="font-medium">{report.student.name}</dd></div>
            <div><dt className="text-slate-400">機構</dt><dd className="font-medium">{report.organization}</dd></div>
            <div><dt className="text-slate-400">班級</dt><dd className="font-medium">{report.class_name ?? '-'}</dd></div>
            <div><dt className="text-slate-400">老師</dt><dd className="font-medium">{report.teacher_name ?? '-'}</dd></div>
            <div><dt className="text-slate-400">完成時間</dt><dd className="font-medium">{report.completed_at ? new Date(report.completed_at).toLocaleString() : '-'}</dd></div>
            <div><dt className="text-slate-400">報告狀態</dt><dd className="font-medium">{report.status}</dd></div>
          </dl>
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-slate-700">成績總覽</h2>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            {(
              [
                ['Reading', report.scores.reading, 30],
                ['Listening', report.scores.listening, 30],
                ['Writing', report.scores.writing, 30],
                ['Speaking', report.scores.speaking, 30],
                ['Total', report.scores.total, 120],
              ] as [string, number | null, number][]
            ).map(([label, score, max]) => (
              <div key={label} className={`rounded-lg p-4 ${label === 'Total' ? 'bg-indigo-600 text-white' : 'bg-slate-50 border border-slate-200'}`}>
                <p className={`text-xs font-semibold ${label === 'Total' ? 'text-indigo-200' : 'text-slate-400'}`}>{label}</p>
                <p className="mt-1 text-2xl font-bold">{score ?? '-'}</p>
                <p className={`text-xs ${label === 'Total' ? 'text-indigo-200' : 'text-slate-400'}`}>/ {max}</p>
              </div>
            ))}
          </div>
          {report.objective_stats && (
            <div className="mt-4 text-sm text-slate-500">
              {report.objective_stats
                .filter((s) => ['reading', 'listening'].includes(s.sectionType))
                .map((s) => (
                  <p key={s.sectionType}>
                    {s.sectionType === 'reading' ? 'Reading' : 'Listening'} 客觀題答對 {s.correctCount} / {s.totalQuestions}
                  </p>
                ))}
            </div>
          )}
        </div>

        <AiFeedbackSection title="Writing AI 評語" items={report.ai_feedback.writing} />
        <AiFeedbackSection title="Speaking AI 評語" items={report.ai_feedback.speaking} />

        <div className="card p-6">
          <h2 className="font-bold text-slate-700">老師評語</h2>
          {report.teacher_comments.length === 0 && (
            <p className="mt-2 text-sm text-slate-400">尚無老師評語。</p>
          )}
          <div className="mt-3 space-y-3">
            {report.teacher_comments.map((c) => (
              <div key={c.id} className="rounded bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs text-slate-400">
                  {c.teacher_name}｜{new Date(c.created_at).toLocaleString()}
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{c.comment_text}</p>
              </div>
            ))}
          </div>
          {isTeacherView && (
            <div className="mt-4">
              <textarea
                className="input min-h-24"
                placeholder="輸入老師評語..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button
                className="btn-primary mt-2"
                disabled={!comment.trim() || commentMutation.isPending}
                onClick={() => commentMutation.mutate(comment.trim())}
              >
                新增評語
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function AiFeedbackSection({ title, items }: { title: string; items: AiFeedbackItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="card p-6">
      <h2 className="font-bold text-slate-700">{title}</h2>
      <div className="mt-4 space-y-6">
        {items.map((item) => (
          <div key={item.exam_item_id} className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-semibold">
                {TASK_LABEL[item.feedback.task_type ?? ''] ?? item.feedback.task_type ?? 'Task'}
              </p>
              <p className="text-sm">
                <span className="font-bold text-indigo-700">{item.overall_score}</span>
                <span className="text-slate-400"> / 30</span>
              </p>
            </div>
            {item.status === 'manual_review_required' && (
              <p className="mt-1 text-xs text-amber-600">AI 批改失敗，待人工評分。</p>
            )}
            {Object.keys(item.rubric).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(item.rubric).map(([k, v]) => (
                  <span key={k} className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                    {k.replace(/_/g, ' ')}: <span className="font-semibold">{v}/5</span>
                  </span>
                ))}
              </div>
            )}
            {item.feedback.comments?.overall && (
              <p className="mt-3 text-sm text-slate-600">{item.feedback.comments.overall}</p>
            )}
            {(item.feedback.improvement_suggestions?.length ?? 0) > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-500 space-y-0.5">
                {item.feedback.improvement_suggestions!.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
            {item.feedback.transcript && (
              <details className="mt-2">
                <summary className="text-xs text-slate-400 cursor-pointer">語音轉寫文字</summary>
                <p className="mt-1 text-sm text-slate-500 whitespace-pre-wrap">{item.feedback.transcript}</p>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
