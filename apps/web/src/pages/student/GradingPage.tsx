import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function GradingPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['grading', attemptId],
    queryFn: () => api.gradingStatus(attemptId!),
    enabled: !!attemptId,
    refetchInterval: (q) => (q.state.data?.attempt_status === 'completed' ? false : 3000),
  });

  useEffect(() => {
    if (data?.attempt_status === 'completed') return;
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-50 p-8 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">批改中</h1>
      <p className="text-sm text-slate-600 mb-4">
        Reading / Listening 已完成自動批改。Writing / Speaking 正在背景批改中，請稍候。
      </p>
      <p className="mb-2">
        狀態：<strong>{data?.attempt_status ?? 'loading'}</strong>
      </p>
      <ul className="text-sm space-y-1 mb-6">
        {data?.jobs.map((j) => (
          <li key={j.id}>
            {j.job_type}: {j.status}
          </li>
        ))}
      </ul>
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
