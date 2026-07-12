import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function ReportPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['report', attemptId],
    queryFn: () => api.getReport(attemptId!),
    enabled: !!attemptId,
    retry: 2,
  });

  async function downloadPdf() {
    if (!attemptId) return;
    const { download_url } = await api.getReportPdf(attemptId);
    window.open(download_url, '_blank');
  }

  if (isLoading) return <div className="p-8">Loading report...</div>;
  if (error) return <div className="p-8 text-red-700">報告尚未完成或無法讀取。</div>;
  if (!data) return null;

  const skills = [
    ['Reading', data.scores.reading],
    ['Listening', data.scores.listening],
    ['Writing', data.scores.writing],
    ['Speaking', data.scores.speaking],
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">四技能英語模擬測驗報告</h1>
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded mt-2 p-2">{data.disclaimer}</p>
        </div>
        <button type="button" className="exam-btn-primary shrink-0" onClick={() => void downloadPdf()}>
          Download PDF
        </button>
      </header>
      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <section className="bg-white rounded border p-5">
          <h2 className="font-semibold mb-2">學生資料</h2>
          <p>{data.student.name}</p>
          <p className="text-sm text-slate-600">{data.student.email}</p>
          <p className="text-sm mt-2">
            考卷：{data.exam_title} ({data.exam_version})
          </p>
        </section>
        <section className="bg-white rounded border p-5">
          <h2 className="font-semibold mb-3">分數總覽 (0-30 / 總分 0-120)</h2>
          <table className="w-full text-sm">
            <tbody>
              {skills.map(([name, score]) => (
                <tr key={name} className="border-t">
                  <td className="py-2 font-medium">{name}</td>
                  <td className="py-2 text-right">{score ?? '批改中'}</td>
                </tr>
              ))}
              <tr className="border-t font-semibold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right">{data.scores.total ?? '批改中'}</td>
              </tr>
            </tbody>
          </table>
        </section>
        {data.ai_feedback.writing.length > 0 && (
          <section className="bg-white rounded border p-5">
            <h2 className="font-semibold mb-2">Writing AI 評語</h2>
            <pre className="text-xs whitespace-pre-wrap bg-slate-50 p-3 rounded overflow-auto">
              {JSON.stringify(data.ai_feedback.writing, null, 2)}
            </pre>
          </section>
        )}
        {data.ai_feedback.speaking.length > 0 && (
          <section className="bg-white rounded border p-5">
            <h2 className="font-semibold mb-2">Speaking AI 評語</h2>
            <pre className="text-xs whitespace-pre-wrap bg-slate-50 p-3 rounded overflow-auto">
              {JSON.stringify(data.ai_feedback.speaking, null, 2)}
            </pre>
          </section>
        )}
        {data.teacher_comments.map((c) => (
          <section key={c.comment_text} className="bg-white rounded border p-5">
            <h2 className="font-semibold">Teacher Comment ({c.teacher_name})</h2>
            <p className="mt-2">{c.comment_text}</p>
          </section>
        ))}
        <Link to="/student/exams" className="text-sm text-blue-600">
          返回考試列表
        </Link>
      </main>
    </div>
  );
}
