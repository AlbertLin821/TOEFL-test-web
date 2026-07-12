import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

interface GradingStatus {
  attempt_id: string;
  attempt_status: string;
  jobs: { id: string; job_type: string; status: string; retry_count: number }[];
}

const JOB_LABEL: Record<string, string> = {
  writing_grading: 'Writing AI 批改',
  speaking_transcription: 'Speaking 語音轉寫',
  speaking_grading: 'Speaking AI 批改',
  report_generation: '報告產生',
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  queued: { text: '排隊中', cls: 'text-slate-500' },
  processing: { text: '處理中', cls: 'text-blue-600' },
  succeeded: { text: '完成', cls: 'text-green-600' },
  retrying: { text: '重試中', cls: 'text-amber-600' },
  failed: { text: '失敗', cls: 'text-red-600' },
};

export default function GradingStatusPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['grading-status', attemptId],
    queryFn: () => api.get<GradingStatus>(`/attempts/${attemptId}/grading-status`),
    refetchInterval: (query) =>
      query.state.data?.attempt_status === 'completed' || query.state.data?.attempt_status === 'error'
        ? false
        : 3000,
  });

  const completed = data?.attempt_status === 'completed';
  const failed = data?.attempt_status === 'error';

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card max-w-lg w-full p-8">
        <h1 className="text-xl font-bold text-center">批改進度</h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          {completed
            ? '報告已完成！'
            : failed
              ? 'AI 批改發生問題，已通知老師人工處理。'
              : '你的答案已送出，AI 批改進行中，完成後會寄送 Email 通知。'}
        </p>

        <div className="mt-6 space-y-3">
          {data?.jobs.map((job) => {
            const st = STATUS_LABEL[job.status] ?? { text: job.status, cls: 'text-slate-500' };
            return (
              <div key={job.id} className="flex items-center justify-between rounded border border-slate-200 px-4 py-3">
                <span className="text-sm font-medium">{JOB_LABEL[job.job_type] ?? job.job_type}</span>
                <span className={`text-sm font-semibold ${st.cls}`}>
                  {st.text}
                  {job.retry_count > 0 ? `（重試 ${job.retry_count} 次）` : ''}
                </span>
              </div>
            );
          })}
          {(data?.jobs.length ?? 0) === 0 && <p className="text-center text-sm text-slate-400">正在建立批改工作...</p>}
        </div>

        <div className="mt-8 flex justify-center gap-3">
          {completed && (
            <button className="btn-primary" onClick={() => navigate(`/reports/${attemptId}`)}>
              查看報告
            </button>
          )}
          <button className="btn-secondary" onClick={() => navigate('/student')}>
            回到考試清單
          </button>
        </div>
      </div>
    </div>
  );
}
