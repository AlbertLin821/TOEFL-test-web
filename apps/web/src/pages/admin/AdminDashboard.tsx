import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';

export default function AdminDashboard() {
  const { logout, user } = useAuth();
  const assignments = useQuery({ queryKey: ['assignments'], queryFn: () => api.getAssignments() });
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => api.getClasses() });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4 flex justify-between">
        <div>
          <h1 className="text-lg font-semibold">管理後台</h1>
          <p className="text-sm text-slate-500">{user?.name} ({user?.role})</p>
        </div>
        <button type="button" onClick={() => logout()} className="text-sm text-slate-600">
          Logout
        </button>
      </header>
      <main className="max-w-5xl mx-auto p-6 space-y-8">
        <section className="bg-white border rounded p-5">
          <h2 className="font-semibold mb-2">平台說明</h2>
          <p className="text-sm text-slate-600">
            此為 TOEFL-style 四技能模擬測驗平台 MVP。非 ETS 官方產品。完整考卷 Practice Test 1 已透過 seed 匯入。
          </p>
        </section>
        <section>
          <h2 className="font-semibold mb-3">班級 ({classes.data?.data.length ?? 0})</h2>
          <ul className="text-sm space-y-1">
            {classes.data?.data.map((c) => (
              <li key={c.id}>
                {c.name} - {c.student_count} students
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="font-semibold mb-3">考試指派</h2>
          <ul className="text-sm space-y-2">
            {assignments.data?.data.map((a) => (
              <li key={a.id} className="bg-white border rounded p-3">
                {a.exam_title} / {a.class_name} / {a.status}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
