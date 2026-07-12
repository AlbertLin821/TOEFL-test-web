import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';

export default function TeacherDashboard() {
  const { logout, user } = useAuth();
  const results = useQuery({ queryKey: ['teacher-results'], queryFn: () => api.teacherResults() });
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => api.getClasses() });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4 flex justify-between">
        <div>
          <h1 className="text-lg font-semibold">老師後台</h1>
          <p className="text-sm text-slate-500">{user?.name}</p>
        </div>
        <button type="button" onClick={() => logout()} className="text-sm text-slate-600">
          Logout
        </button>
      </header>
      <main className="max-w-5xl mx-auto p-6 space-y-8">
        <section>
          <h2 className="font-semibold mb-3">班級</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {classes.data?.data.map((c) => (
              <div key={c.id} className="bg-white border rounded p-4">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-slate-600">學生 {c.student_count} 人</p>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="font-semibold mb-3">成績列表</h2>
          <div className="bg-white border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3">學生</th>
                  <th className="p-3">考試</th>
                  <th className="p-3">狀態</th>
                  <th className="p-3">總分</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {results.data?.data.map((r) => (
                  <tr key={r.attempt_id} className="border-t">
                    <td className="p-3">{r.student_name}</td>
                    <td className="p-3">{r.exam_title}</td>
                    <td className="p-3">{r.status}</td>
                    <td className="p-3">{r.total_score ?? '-'}</td>
                    <td className="p-3">
                      {r.status === 'completed' && (
                        <Link to={`/reports/${r.attempt_id}`} className="text-blue-600">
                          報告
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
