import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

const JOB_LABELS: Record<string, string> = {
  objective_feedback: '閱讀／聽力 AI 講評',
  writing_grading: '寫作 AI 批改',
  speaking_transcription: '口說逐字轉錄與聲學分析',
  speaking_grading: '口說 AI 批改',
  report_generation: '成績與報告產生',
  feedback_translation: '英文評語翻譯',
};

export default function GradingPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['grading', attemptId],
    queryFn: () => api.gradingStatus(attemptId!),
    enabled: !!attemptId,
    refetchInterval: (q) => (
      ['completed', 'error'].includes(q.state.data?.attempt_status ?? '') ? false : 3000
    ),
  });

  const failedJobs = data?.jobs.filter((job) => job.status === 'failed') ?? [];

  return (
    <div className="min-h-screen bg-slate-50 p-8 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">批改中</h1>
      <p className="text-sm text-slate-600 mb-4">
        閱讀與聽力已由系統判分，AI 正在分析錯題；寫作與口說也會在背景完成批改，請稍候。
      </p>
      <p className="mb-2">
        狀態：<strong>{data?.attempt_status ?? 'loading'}</strong>
      </p>
      <ul className="text-sm space-y-1 mb-6">
        {data?.jobs.map((j) => (
          <li key={j.id}>
            {JOB_LABELS[j.job_type] ?? j.job_type}: {j.status}
          </li>
        ))}
      </ul>
      {data?.attempt_status === 'error' && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          批改暫時失敗。請聯絡老師或管理員重新執行失敗項目
          {failedJobs.length > 0 ? `（${failedJobs.map((job) => JOB_LABELS[job.job_type] ?? job.job_type).join('、')}）` : ''}。
        </div>
      )}
      {data?.attempt_status === 'completed' ? (
        <Link to={`/reports/${attemptId}`} className="exam-btn-primary inline-block">
          查看報告
        </Link>
      ) : (
        <button type="button" className="text-sm text-blue-600" onClick={() => refetch()} disabled={isFetching}>
          重新整理
        </button>
      )}
      <div className="mt-6">
        <Link to="/student/exams" className="text-sm text-slate-600">
          返回首頁
        </Link>
      </div>
    </div>
  );
}
