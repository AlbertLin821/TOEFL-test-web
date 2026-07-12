import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuth } from '../../auth';

interface ClassDto {
  id: string;
  name: string;
  teacher_name: string | null;
  student_count: number;
}

interface AssignmentDto {
  id: string;
  exam_title: string;
  version_no: string;
  class_name: string | null;
  opens_at: string;
  closes_at: string;
  max_attempts: number;
  status: string;
  attempt_count: number;
}

interface ResultDto {
  student_name: string;
  attempt_id: string;
  status: string;
  class_name: string | null;
  exam_title: string;
  submitted_at: string | null;
  total_score: number | null;
  reading_score: number | null;
  listening_score: number | null;
  writing_score: number | null;
  speaking_score: number | null;
}

interface PaperDto {
  id: string;
  title: string;
  versions: { id: string; version_no: string; status: string }[];
}

export default function TeacherHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'classes' | 'assignments' | 'results'>('classes');

  return (
    <div className="min-h-screen">
      <header className="bg-indigo-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Teacher Dashboard</h1>
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
          {(
            [
              ['classes', '班級'],
              ['assignments', '考試指派'],
              ['results', '成績'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-semibold rounded-t ${
                tab === key ? 'bg-slate-100 text-indigo-900' : 'text-indigo-200 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {tab === 'classes' && <ClassesTab />}
        {tab === 'assignments' && <AssignmentsTab />}
        {tab === 'results' && <ResultsTab />}
      </main>
    </div>
  );
}

function ClassesTab() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<{ data: ClassDto[] }>('/classes'),
  });
  const [name, setName] = useState('');
  const createMutation = useMutation({
    mutationFn: () => api.post('/classes', { name }),
    onSuccess: () => {
      setName('');
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="font-bold mb-3">建立班級</h2>
        <div className="flex gap-2">
          <input className="input max-w-xs" placeholder="班級名稱" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary" disabled={!name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
            建立
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">班級名稱</th>
              <th className="px-4 py-3">老師</th>
              <th className="px-4 py-3">學生數</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{c.teacher_name ?? '-'}</td>
                <td className="px-4 py-3">{c.student_count}</td>
                <td className="px-4 py-3 text-right">
                  <button className="btn-secondary !py-1 text-xs" onClick={() => setSelectedClass(selectedClass === c.id ? null : c.id)}>
                    {selectedClass === c.id ? '收合' : '查看成員'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {selectedClass && <ClassMembers classId={selectedClass} />}
      </div>
    </div>
  );
}

function ClassMembers({ classId }: { classId: string }) {
  const { data } = useQuery({
    queryKey: ['class-members', classId],
    queryFn: () => api.get<{ data: { id: string; name: string; email: string }[] }>(`/classes/${classId}/members`),
  });
  return (
    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold text-slate-500 mb-2">班級成員</p>
      {(data?.data.length ?? 0) === 0 && <p className="text-xs text-slate-400">尚無成員</p>}
      <ul className="space-y-1 text-sm">
        {data?.data.map((m) => (
          <li key={m.id}>
            {m.name} <span className="text-slate-400">（{m.email}）</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssignmentsTab() {
  const queryClient = useQueryClient();
  const { data: assignments } = useQuery({
    queryKey: ['assignments'],
    queryFn: () => api.get<{ data: AssignmentDto[] }>('/assignments'),
  });
  const { data: papers } = useQuery({
    queryKey: ['exam-papers'],
    queryFn: () => api.get<{ data: PaperDto[] }>('/exam-papers'),
  });
  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<{ data: ClassDto[] }>('/classes'),
  });

  const [versionId, setVersionId] = useState('');
  const [classId, setClassId] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/assignments', {
        exam_version_id: versionId,
        class_id: classId,
        opens_at: new Date(opensAt).toISOString(),
        closes_at: new Date(closesAt).toISOString(),
        max_attempts: maxAttempts,
      }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : '建立失敗'),
  });

  const publishedVersions = papers?.data.flatMap((p) =>
    p.versions.filter((v) => v.status === 'published').map((v) => ({ ...v, title: p.title })),
  );

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="font-bold mb-3">指派考試</h2>
        <div className="grid md:grid-cols-2 gap-3 max-w-3xl">
          <select className="input" value={versionId} onChange={(e) => setVersionId(e.target.value)}>
            <option value="">選擇考卷版本</option>
            {publishedVersions?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}（{v.version_no}）
              </option>
            ))}
          </select>
          <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">選擇班級</option>
            {classes?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="text-xs text-slate-500">
            開放時間
            <input type="datetime-local" className="input mt-1" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
          </label>
          <label className="text-xs text-slate-500">
            截止時間
            <input type="datetime-local" className="input mt-1" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </label>
          <label className="text-xs text-slate-500">
            作答次數上限
            <input
              type="number"
              min={1}
              max={10}
              className="input mt-1"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
            />
          </label>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          className="btn-primary mt-4"
          disabled={!versionId || !classId || !opensAt || !closesAt || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          指派
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">考卷</th>
              <th className="px-4 py-3">班級</th>
              <th className="px-4 py-3">開放</th>
              <th className="px-4 py-3">截止</th>
              <th className="px-4 py-3">狀態</th>
              <th className="px-4 py-3">已作答</th>
            </tr>
          </thead>
          <tbody>
            {assignments?.data.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">
                  {a.exam_title} <span className="text-slate-400 text-xs">{a.version_no}</span>
                </td>
                <td className="px-4 py-3">{a.class_name}</td>
                <td className="px-4 py-3">{new Date(a.opens_at).toLocaleString()}</td>
                <td className="px-4 py-3">{new Date(a.closes_at).toLocaleString()}</td>
                <td className="px-4 py-3">{a.status}</td>
                <td className="px-4 py-3">{a.attempt_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultsTab() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['teacher-results'],
    queryFn: () => api.get<{ data: ResultDto[] }>('/teacher/results'),
    refetchInterval: 10000,
  });

  function exportCsv() {
    if (!data) return;
    const header = 'Student,Class,Exam,Status,Submitted,Reading,Listening,Writing,Speaking,Total\n';
    const rows = data.data
      .map((r) =>
        [
          r.student_name,
          r.class_name ?? '',
          r.exam_title,
          r.status,
          r.submitted_at ?? '',
          r.reading_score ?? '',
          r.listening_score ?? '',
          r.writing_score ?? '',
          r.speaking_score ?? '',
          r.total_score ?? '',
        ].join(','),
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'results.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h2 className="font-bold">學生成績</h2>
        <button className="btn-secondary !py-1 text-xs" onClick={exportCsv}>
          匯出 CSV
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-3">學生</th>
            <th className="px-4 py-3">班級</th>
            <th className="px-4 py-3">狀態</th>
            <th className="px-4 py-3">R</th>
            <th className="px-4 py-3">L</th>
            <th className="px-4 py-3">W</th>
            <th className="px-4 py-3">S</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {data?.data.map((r) => (
            <tr key={r.attempt_id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-medium">{r.student_name}</td>
              <td className="px-4 py-3">{r.class_name}</td>
              <td className="px-4 py-3">{r.status}</td>
              <td className="px-4 py-3">{r.reading_score ?? '-'}</td>
              <td className="px-4 py-3">{r.listening_score ?? '-'}</td>
              <td className="px-4 py-3">{r.writing_score ?? '-'}</td>
              <td className="px-4 py-3">{r.speaking_score ?? '-'}</td>
              <td className="px-4 py-3 font-bold">{r.total_score ?? '-'}</td>
              <td className="px-4 py-3 text-right">
                {r.status === 'completed' && (
                  <button className="btn-secondary !py-1 text-xs" onClick={() => navigate(`/reports/${r.attempt_id}`)}>
                    報告
                  </button>
                )}
              </td>
            </tr>
          ))}
          {(data?.data.length ?? 0) === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                尚無成績資料
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
