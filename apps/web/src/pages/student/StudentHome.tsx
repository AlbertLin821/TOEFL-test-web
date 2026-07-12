import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, type AvailableExamDto } from '../../api/client';
import { useAuth } from '../../auth';

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  available: { text: '可作答', cls: 'bg-green-100 text-green-800' },
  in_progress: { text: '作答中', cls: 'bg-amber-100 text-amber-800' },
  grading: { text: '批改中', cls: 'bg-blue-100 text-blue-800' },
  report_ready: { text: '報告完成', cls: 'bg-indigo-100 text-indigo-800' },
  not_open: { text: '尚未開始', cls: 'bg-slate-100 text-slate-600' },
  closed: { text: '已截止', cls: 'bg-slate-200 text-slate-500' },
  max_attempts_reached: { text: '已達作答上限', cls: 'bg-slate-200 text-slate-500' },
};

export default function StudentHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['available-exams'],
    queryFn: () => api.get<{ data: AvailableExamDto[] }>('/student/available-exams'),
  });

  const startMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      api.post<{ attempt_id: string; status: string }>('/attempts/start', { assignment_id: assignmentId }),
    onSuccess: (res) => navigate(`/exam/${res.attempt_id}`),
  });

  return (
    <div className="min-h-screen">
      <header className="bg-indigo-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">My Exams</h1>
            <p className="text-xs text-indigo-200">{user?.name}</p>
          </div>
          <button
            className="btn-bar"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {isLoading && <p className="text-slate-500">載入中...</p>}
        {!isLoading && (data?.data.length ?? 0) === 0 && (
          <div className="card p-8 text-center text-slate-500">目前沒有被指派的考試。</div>
        )}
        <div className="space-y-4">
          {data?.data.map((exam) => {
            const label = STATUS_LABEL[exam.status] ?? { text: exam.status, cls: 'bg-slate-100 text-slate-600' };
            return (
              <div key={exam.assignment_id} className="card p-6 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-slate-900">{exam.exam_title}</h2>
                    <span className="text-xs text-slate-400">{exam.version_no}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${label.cls}`}>{label.text}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    指派老師：{exam.teacher_name ?? '-'}｜開放：{new Date(exam.opens_at).toLocaleString()}｜截止：
                    {new Date(exam.closes_at).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    已作答 {exam.attempts_used} / {exam.max_attempts} 次
                  </p>
                </div>
                <div className="flex gap-2">
                  {exam.status === 'available' && (
                    <button
                      className="btn-primary"
                      disabled={startMutation.isPending}
                      onClick={() => startMutation.mutate(exam.assignment_id)}
                    >
                      開始考試
                    </button>
                  )}
                  {exam.status === 'in_progress' && exam.active_attempt_id && (
                    <button className="btn-primary" onClick={() => navigate(`/exam/${exam.active_attempt_id}`)}>
                      繼續作答
                    </button>
                  )}
                  {exam.status === 'grading' && exam.latest_attempt_id && (
                    <button className="btn-secondary" onClick={() => navigate(`/grading/${exam.latest_attempt_id}`)}>
                      查看批改進度
                    </button>
                  )}
                  {exam.status === 'report_ready' && exam.latest_attempt_id && (
                    <button className="btn-primary" onClick={() => navigate(`/reports/${exam.latest_attempt_id}`)}>
                      查看報告
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-6">
          <button className="btn-secondary" onClick={() => refetch()}>
            重新整理
          </button>
        </div>
      </main>
    </div>
  );
}
