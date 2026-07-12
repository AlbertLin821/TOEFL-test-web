import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuth } from '../../auth';

interface UserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface OrgDto {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan_type: string | null;
  user_count: number;
  class_count: number;
}

export default function AdminHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isPlatformAdmin = user?.role === 'platform_admin';
  const [tab, setTab] = useState<'users' | 'orgs' | 'exams'>(isPlatformAdmin ? 'orgs' : 'users');

  return (
    <div className="min-h-screen">
      <header className="bg-indigo-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{isPlatformAdmin ? 'Platform Admin' : 'Organization Admin'}</h1>
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
        <nav className="max-w-6xl mx-auto px-4 flex gap-1">
          {isPlatformAdmin && (
            <TabButton active={tab === 'orgs'} onClick={() => setTab('orgs')}>
              機構
            </TabButton>
          )}
          <TabButton active={tab === 'users'} onClick={() => setTab('users')}>
            使用者
          </TabButton>
          <TabButton active={tab === 'exams'} onClick={() => setTab('exams')}>
            考卷
          </TabButton>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {tab === 'orgs' && isPlatformAdmin && <OrgsTab />}
        {tab === 'users' && <UsersTab canCreate={user?.role === 'org_admin' || isPlatformAdmin} />}
        {tab === 'exams' && <ExamsTab />}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold rounded-t ${
        active ? 'bg-slate-100 text-indigo-900' : 'text-indigo-200 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function OrgsTab() {
  const { data } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get<{ data: OrgDto[] }>('/organizations'),
  });
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-3">機構名稱</th>
            <th className="px-4 py-3">Slug</th>
            <th className="px-4 py-3">方案</th>
            <th className="px-4 py-3">使用者數</th>
            <th className="px-4 py-3">班級數</th>
            <th className="px-4 py-3">狀態</th>
          </tr>
        </thead>
        <tbody>
          {data?.data.map((o) => (
            <tr key={o.id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-medium">{o.name}</td>
              <td className="px-4 py-3">{o.slug}</td>
              <td className="px-4 py-3">{o.plan_type ?? '-'}</td>
              <td className="px-4 py-3">{o.user_count}</td>
              <td className="px-4 py-3">{o.class_count}</td>
              <td className="px-4 py-3">{o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersTab({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ data: UserDto[] }>('/users?page_size=100'),
  });
  const [form, setForm] = useState({ name: '', email: '', role: 'student', password: '' });
  const [error, setError] = useState<string | null>(null);
  const createMutation = useMutation({
    mutationFn: () => api.post('/users', form),
    onSuccess: () => {
      setForm({ name: '', email: '', role: 'student', password: '' });
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : '建立失敗'),
  });

  return (
    <div className="space-y-6">
      {canCreate && (
        <div className="card p-6">
          <h2 className="font-bold mb-3">建立使用者</h2>
          <div className="grid md:grid-cols-4 gap-3">
            <input className="input" placeholder="姓名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
            <input className="input" placeholder="密碼（至少 8 碼）" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            className="btn-primary mt-4"
            disabled={!form.name || !form.email || form.password.length < 8 || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            建立
          </button>
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">姓名</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">角色</th>
              <th className="px-4 py-3">狀態</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.role}</td>
                <td className="px-4 py-3">{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExamsTab() {
  const { data } = useQuery({
    queryKey: ['exam-papers'],
    queryFn: () =>
      api.get<{ data: { id: string; title: string; status: string; latest_version: string | null; versions: { id: string; version_no: string; status: string }[] }[] }>(
        '/exam-papers',
      ),
  });
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-3">考卷名稱</th>
            <th className="px-4 py-3">狀態</th>
            <th className="px-4 py-3">版本</th>
          </tr>
        </thead>
        <tbody>
          {data?.data.map((p) => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-medium">{p.title}</td>
              <td className="px-4 py-3">{p.status}</td>
              <td className="px-4 py-3">
                {p.versions.map((v) => `${v.version_no}（${v.status}）`).join('、') || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
