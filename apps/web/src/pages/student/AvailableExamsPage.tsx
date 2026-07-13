import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

const STATUS_LABEL: Record<string, string> = {
  available: '可作答',
  in_progress: '作答中',
  grading: '批改中',
  report_ready: '報告完成',
  not_open: '尚未開始',
  closed: '已截止',
  max_attempts_reached: '已達上限',
};

export default function AvailableExamsPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useQuery({ queryKey: ['available-exams'], queryFn: () => api.availableExams() });

  const start = async (assignmentId: string) => {
    const res = await api.startAttempt(assignmentId);
    navigate(`/exam/${res.attempt_id}`);
  };

  const continueAttempt = (attemptId: string) => {
    navigate(`/exam/${attemptId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">可作答考試</h1>
          <p className="text-sm text-slate-500">{user?.name}</p>
        </div>
        <button type="button" onClick={() => logout()} className="text-sm text-slate-600 hover:underline">
          Logout
        </button>
      </header>
      <main className="max-w-3xl mx-auto p-6 space-y-4">
        {isLoading && <p>Loading...</p>}
        {data?.data.map((exam) => (
          <article key={exam.assignment_id} className="bg-white border rounded-lg p-5 shadow-sm">
            <h2 className="font-semibold text-lg">{exam.exam_title}</h2>
            <p className="text-sm text-slate-600">版本 {exam.version_no}</p>
            <p className="text-sm text-slate-600">老師：{exam.teacher_name ?? '-'}</p>
            <p className="text-sm text-slate-600">
              開放：{new Date(exam.opens_at).toLocaleString()} — 截止：{new Date(exam.closes_at).toLocaleString()}
            </p>
            <p className="text-sm mt-2">
              狀態：
              <span className="font-medium ml-1">{STATUS_LABEL[exam.status] ?? exam.status}</span>
            </p>
            <div className="mt-4 flex gap-2">
              {exam.status === 'available' && (
                <button type="button" className="exam-btn-primary" onClick={() => start(exam.assignment_id)}>
                  開始
                </button>
              )}
              {exam.status === 'in_progress' && exam.active_attempt_id && (
                <button
                  type="button"
                  className="exam-btn-primary"
                  onClick={() => continueAttempt(exam.active_attempt_id!)}
                >
                  {exam.active_attempt_status === 'hardware_check' ? '繼續硬體檢查' : '繼續'}
                </button>
              )}
              {(exam.status === 'report_ready' || exam.status === 'grading') && exam.latest_attempt_id && (
                <>
                  {exam.status === 'grading' && (
                    <Link to={`/exam/${exam.latest_attempt_id}/grading`} className="exam-btn-primary inline-block">
                      查看批改狀態
                    </Link>
                  )}
                  {exam.status === 'report_ready' && (
                    <Link to={`/reports/${exam.latest_attempt_id}`} className="exam-btn-primary inline-block">
                      查看報告
                    </Link>
                  )}
                </>
              )}
            </div>
          </article>
        ))}
        {!isLoading && data?.data.length === 0 && <p className="text-slate-500">目前沒有可作答的考試。</p>}
        <button type="button" onClick={() => refetch()} className="text-sm text-blue-600">
          重新整理
        </button>
      </main>
    </div>
  );
}
