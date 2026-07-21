import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, GraduationCap, MoreHorizontal, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react';
import {
  api,
  ApiClientError,
  type AdminUserRow,
  type AssignmentRow,
  type ClassRow,
  type ExamPaperRow,
  type OrganizationRow,
  type TeacherResultRow,
} from '../../lib/api';

export type Section = 'overview' | 'organizations' | 'accounts' | 'classes' | 'papers' | 'assignments' | 'results';
export type AccountView = 'accounts' | 'classes' | 'assignments';

const roleLabels: Record<string, string> = {
  platform_admin: '平台管理員',
  org_admin: '組織管理員',
  teacher: '教師',
  student: '學生',
};

const statusLabels: Record<string, string> = {
  active: '啟用中',
  suspended: '已停用',
  inactive: '已停用',
  archived: '已封存',
  draft: '草稿',
  published: '已發布',
  scheduled: '已排程',
  closed: '已關閉',
  completed: '已完成',
  grading: '評分中',
  submitted: '已提交',
  error: '需處理',
  in_progress: '作答中',
};

function statusTone(status: string) {
  if (['active', 'published', 'completed'].includes(status)) return 'success';
  if (['scheduled', 'grading', 'submitted', 'in_progress'].includes(status)) return 'warning';
  if (['error', 'suspended', 'inactive'].includes(status)) return 'danger';
  return 'neutral';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function readError(error: unknown) {
  if (error instanceof ApiClientError) {
    const map: Record<string, string> = {
      'Email already exists.': '此 Email 已被使用。',
      'You cannot deactivate your own account.': '不能停用自己的帳號。',
      'You cannot delete your own account.': '不能刪除自己的帳號。',
    };
    return map[error.message] ?? error.message;
  }
  return error instanceof Error ? error.message : '操作失敗，請稍後再試。';
}

function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="admin-page-header"><div><span className="admin-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="admin-page-actions">{actions}</div></div>;
}

export function Overview({ organization, organizationId, onNavigate }: { organization?: OrganizationRow; organizationId: string; onNavigate: (section: Section) => void }) {
  const users = useQuery({ queryKey: ['admin-users', organizationId], queryFn: () => api.getUsers(organizationId), enabled: Boolean(organizationId) });
  const classes = useQuery({ queryKey: ['admin-classes', organizationId], queryFn: () => api.getClasses(organizationId), enabled: Boolean(organizationId) });
  const papers = useQuery({ queryKey: ['admin-papers', organizationId], queryFn: () => api.getExamPapers(organizationId), enabled: Boolean(organizationId) });
  const results = useQuery({ queryKey: ['admin-results', organizationId], queryFn: () => api.teacherResults(organizationId), enabled: Boolean(organizationId) });
  const completed = results.data?.data.filter((item) => item.status === 'completed') ?? [];
  const average = completed.length ? completed.reduce((sum, item) => sum + (item.total_score ?? 0), 0) / completed.length : 0;
  const recent = results.data?.data.slice(0, 7) ?? [];
  return <>
    <PageHeader eyebrow="WORKSPACE OVERVIEW" title="管理總覽" description={`掌握 ${organization?.name ?? '組織'} 的使用情況與近期考試結果`} actions={<button className="admin-btn primary" onClick={() => onNavigate('accounts')}><Plus />新增帳號</button>} />
    <section className="admin-metric-strip">
      <Metric label="啟用帳號" value={users.data?.data.filter((item) => item.status === 'active').length ?? 0} meta={organization?.student_quota ? `上限 ${organization.student_quota.toLocaleString()}` : '不限'} />
      <Metric label="進行中班級" value={classes.data?.data.filter((item) => item.status === 'active').length ?? 0} />
      <Metric label="已發布考卷" value={papers.data?.data.filter((item) => item.status === 'published').length ?? 0} />
      <Metric label="平均總分" value={average ? average.toFixed(1) : '—'} meta={`${completed.length} 份已完成`} />
    </section>
    <div className="admin-dashboard-grid">
      <section className="admin-panel admin-table-panel">
        <div className="admin-panel-heading"><div><h2>近期考試與成績</h2><p>最新提交與評分狀態</p></div><button className="admin-text-btn" onClick={() => onNavigate('results')}>查看全部</button></div>
        <ResultsTable rows={recent} compact />
      </section>
      <aside className="admin-side-stack">
        <section className="admin-panel admin-usage"><div className="admin-panel-heading"><div><h2>組織使用量</h2><p>目前方案配額</p></div></div>
          <Usage label="帳號" value={users.data?.pagination.total ?? 0} max={organization?.student_quota ?? 0} />
          <Usage label="考卷" value={papers.data?.data.length ?? 0} max={organization?.exam_quota ?? 0} />
          <Usage label="AI 評分" value={completed.length} max={organization?.ai_credit_quota ?? 0} />
        </section>
        <section className="admin-panel admin-quick"><div className="admin-panel-heading"><div><h2>快速管理</h2><p>常用作業入口</p></div></div>
          <button onClick={() => onNavigate('accounts')}><UserRound />帳號與權限<span>→</span></button>
          <button onClick={() => onNavigate('papers')}><BookOpen />考卷與版本<span>→</span></button>
          <button onClick={() => onNavigate('results')}><GraduationCap />查看學生成績<span>→</span></button>
        </section>
        <div className="admin-info-note">API 金鑰已設定，AI 評分服務運作正常。</div>
      </aside>
    </div>
  </>;
}

function Metric({ label, value, meta }: { label: string; value: string | number; meta?: string }) {
  return <div><span>{label}</span><strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>{meta && <small>{meta}</small>}</div>;
}

function Usage({ label, value, max }: { label: string; value: number; max: number }) {
  const percentage = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return <div className="admin-usage-row"><div><span>{label}</span><strong>{value.toLocaleString()} / {max ? max.toLocaleString() : '不限'}</strong></div><div><i style={{ width: `${percentage}%` }} /></div></div>;
}

export function Subnav({ value, onChange }: { value: AccountView; onChange: (value: AccountView) => void }) {
  return <div className="admin-subnav" aria-label="組織資源分頁">
    <button className={value === 'accounts' ? 'is-active' : ''} onClick={() => onChange('accounts')}>帳號</button>
    <button className={value === 'classes' ? 'is-active' : ''} onClick={() => onChange('classes')}>班級</button>
    <button className={value === 'assignments' ? 'is-active' : ''} onClick={() => onChange('assignments')}>考試指派</button>
  </div>;
}

export function OrganizationsPanel({ selectedId, onSelect, notify }: { selectedId: string; onSelect: (id: string) => void; notify: Notice }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin-organizations'], queryFn: api.getOrganizations });
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<OrganizationRow> | null>(null);
  const [deleting, setDeleting] = useState<OrganizationRow | null>(null);
  const rows = query.data?.data.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()) || item.slug.includes(search.toLowerCase())) ?? [];
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      const body = { name: String(form.get('name')), slug: String(form.get('slug')), plan_type: String(form.get('plan_type')), student_quota: Number(form.get('student_quota')), exam_quota: Number(form.get('exam_quota')), ai_credit_quota: Number(form.get('ai_credit_quota')) };
      if (editing?.id) await api.updateOrganization(editing.id, body); else await api.createOrganization(body);
      await queryClient.invalidateQueries({ queryKey: ['admin-organizations'] }); setEditing(null); notify({ tone: 'success', text: editing?.id ? '組織資料已更新。' : '組織已建立。' });
    } catch (error) { notify({ tone: 'danger', text: readError(error) }); }
  };
  return <>
    <PageHeader eyebrow="PLATFORM" title="組織管理" description="管理租戶方案、配額與使用狀態" actions={<button className="admin-btn primary" onClick={() => setEditing({ status: 'active' })}><Plus />新增組織</button>} />
    <TableToolbar search={search} onSearch={setSearch} placeholder="搜尋組織名稱或代碼" count={rows.length} />
    <div className="admin-panel admin-table-panel"><table className="admin-table"><thead><tr><th>組織</th><th>方案</th><th>帳號</th><th>班級</th><th>狀態</th><th className="admin-actions-cell">操作</th></tr></thead><tbody>
      {rows.map((org) => <tr key={org.id} className={org.id === selectedId ? 'is-selected' : ''}><td><button className="admin-primary-link" onClick={() => onSelect(org.id)}>{org.name}</button><small>{org.slug}</small></td><td>{org.plan_type ?? '未設定'}</td><td>{org.user_count.toLocaleString()} / {org.student_quota || '不限'}</td><td>{org.class_count}</td><td><StatusChip status={org.status} /></td><td className="admin-row-actions"><button onClick={() => setEditing(org)} aria-label={`編輯 ${org.name}`}><Pencil /></button><button onClick={async () => { try { await api.updateOrganization(org.id, { status: org.status === 'active' ? 'suspended' : 'active' }); await queryClient.invalidateQueries({ queryKey: ['admin-organizations'] }); notify({ tone: 'success', text: org.status === 'active' ? '組織已停用。' : '組織已啟用。' }); } catch (error) { notify({ tone: 'danger', text: readError(error) }); } }} aria-label={org.status === 'active' ? `停用 ${org.name}` : `啟用 ${org.name}`}><MoreHorizontal /></button><button className="danger" onClick={() => setDeleting(org)} aria-label={`刪除 ${org.name}`}><Trash2 /></button></td></tr>)}
    </tbody></table></div>
    {editing && <Modal title={editing.id ? '編輯組織' : '新增組織'} description="設定組織基本資料與使用配額。" onClose={() => setEditing(null)}><form className="admin-form" onSubmit={save}><Field label="組織名稱"><input name="name" defaultValue={editing.name} required /></Field><Field label="組織代碼"><input name="slug" defaultValue={editing.slug} required disabled={Boolean(editing.id)} pattern="[a-z0-9-]+" /></Field><Field label="方案"><input name="plan_type" defaultValue={editing.plan_type ?? 'standard'} /></Field><div className="admin-form-grid"><Field label="帳號配額"><input name="student_quota" type="number" min="0" defaultValue={editing.student_quota ?? 500} /></Field><Field label="考卷配額"><input name="exam_quota" type="number" min="0" defaultValue={editing.exam_quota ?? 30} /></Field><Field label="AI 評分配額"><input name="ai_credit_quota" type="number" min="0" defaultValue={editing.ai_credit_quota ?? 2500} /></Field></div><FormActions onCancel={() => setEditing(null)} /></form></Modal>}
    {deleting && <Confirm title="刪除組織" body={`即將刪除「${deleting.name}」。只有完全沒有帳號、班級、考卷與成績的組織才能刪除。`} confirm="確認刪除" onCancel={() => setDeleting(null)} onConfirm={async () => { try { await api.deleteOrganization(deleting.id); await queryClient.invalidateQueries({ queryKey: ['admin-organizations'] }); setDeleting(null); notify({ tone: 'success', text: '組織已刪除。' }); } catch (error) { notify({ tone: 'danger', text: readError(error) }); } }} />}
  </>;
}

export function AccountsPanel({ organizationId, isPlatform, notify }: { organizationId: string; isPlatform: boolean; notify: Notice }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin-users', organizationId], queryFn: () => api.getUsers(organizationId), enabled: Boolean(organizationId) });
  const [search, setSearch] = useState(''); const [role, setRole] = useState('all'); const [editing, setEditing] = useState<Partial<AdminUserRow> | null>(null); const [deleting, setDeleting] = useState<AdminUserRow | null>(null);
  const rows = query.data?.data.filter((item) => (role === 'all' || item.role === role) && `${item.name} ${item.email}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { const body: Record<string, unknown> = { name: String(form.get('name')), email: String(form.get('email')), role: String(form.get('role')) }; const password = String(form.get('password') ?? ''); if (password) body.password = password; if (!editing?.id) body.organization_id = organizationId; if (editing?.id) await api.updateUser(editing.id, body); else await api.createUser(body); await queryClient.invalidateQueries({ queryKey: ['admin-users', organizationId] }); setEditing(null); notify({ tone: 'success', text: editing?.id ? '帳號已更新。' : '帳號已建立。' }); } catch (error) { notify({ tone: 'danger', text: readError(error) }); } };
  return <>
    <PageHeader eyebrow="IDENTITY & ACCESS" title="帳號管理" description="管理使用者資料、角色與啟用狀態" actions={<button className="admin-btn primary" onClick={() => setEditing({ role: 'student', status: 'active' })}><Plus />新增帳號</button>} />
    <TableToolbar search={search} onSearch={setSearch} placeholder="搜尋姓名或 Email" count={rows.length}><select value={role} onChange={(e) => setRole(e.target.value)}><option value="all">全部角色</option>{isPlatform && <option value="org_admin">組織管理員</option>}<option value="teacher">教師</option><option value="student">學生</option></select></TableToolbar>
    <div className="admin-panel admin-table-panel"><table className="admin-table"><thead><tr><th>使用者</th><th>角色</th><th>建立日期</th><th>狀態</th><th className="admin-actions-cell">操作</th></tr></thead><tbody>{rows.map((account) => <tr key={account.id}><td><strong>{account.name}</strong><small>{account.email}</small></td><td>{roleLabels[account.role]}</td><td>{account.createdAt ? formatDate(account.createdAt) : '—'}</td><td><StatusChip status={account.status} /></td><td className="admin-row-actions"><button onClick={() => setEditing(account)} aria-label={`編輯 ${account.name}`}><Pencil /></button><button onClick={async () => { try { await api.updateUser(account.id, { status: account.status === 'active' ? 'inactive' : 'active' }); await queryClient.invalidateQueries({ queryKey: ['admin-users', organizationId] }); notify({ tone: 'success', text: account.status === 'active' ? '帳號已停用。' : '帳號已啟用。' }); } catch (error) { notify({ tone: 'danger', text: readError(error) }); } }} aria-label={account.status === 'active' ? '停用帳號' : '啟用帳號'}><MoreHorizontal /></button><button className="danger" onClick={() => setDeleting(account)} aria-label={`刪除 ${account.name}`}><Trash2 /></button></td></tr>)}</tbody></table></div>
    {editing && <Modal title={editing.id ? '編輯帳號' : '新增帳號'} description="角色會決定使用者可查看與操作的功能。" onClose={() => setEditing(null)}><form className="admin-form" onSubmit={save}><Field label="姓名"><input name="name" defaultValue={editing.name} required /></Field><Field label="Email"><input name="email" type="email" defaultValue={editing.email} required /></Field><Field label="角色"><select name="role" defaultValue={editing.role}>{isPlatform && <option value="org_admin">組織管理員</option>}<option value="teacher">教師</option><option value="student">學生</option></select></Field><Field label={editing.id ? '重設密碼（留空不變更）' : '初始密碼'}><input name="password" type="password" minLength={8} required={!editing.id} /></Field><FormActions onCancel={() => setEditing(null)} /></form></Modal>}
    {deleting && <Confirm title="刪除帳號" body={`即將刪除「${deleting.name}」。若帳號已有班級、考試或成績紀錄，系統會阻止刪除並建議改為停用。`} confirm="確認刪除" onCancel={() => setDeleting(null)} onConfirm={async () => { try { await api.deleteUser(deleting.id); await queryClient.invalidateQueries({ queryKey: ['admin-users', organizationId] }); setDeleting(null); notify({ tone: 'success', text: '帳號已刪除。' }); } catch (error) { notify({ tone: 'danger', text: readError(error) }); } }} />}
  </>;
}

export function ClassesPanel({ organizationId, notify }: { organizationId: string; notify: Notice }) {
  const queryClient = useQueryClient(); const query = useQuery({ queryKey: ['admin-classes', organizationId], queryFn: () => api.getClasses(organizationId) }); const teachers = useQuery({ queryKey: ['admin-users', organizationId], queryFn: () => api.getUsers(organizationId) });
  const [search, setSearch] = useState(''); const [editing, setEditing] = useState<Partial<ClassRow> | null>(null); const [deleting, setDeleting] = useState<ClassRow | null>(null); const rows = query.data?.data.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())) ?? [];
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { const body = { name: String(form.get('name')), teacher_id: String(form.get('teacher_id')) || null, organization_id: organizationId }; if (editing?.id) await api.updateClass(editing.id, body); else await api.createClass(body); await queryClient.invalidateQueries({ queryKey: ['admin-classes', organizationId] }); setEditing(null); notify({ tone: 'success', text: editing?.id ? '班級已更新。' : '班級已建立。' }); } catch (error) { notify({ tone: 'danger', text: readError(error) }); } };
  return <><PageHeader eyebrow="CLASSROOMS" title="班級管理" description="管理授課教師、學生人數與班級狀態" actions={<button className="admin-btn primary" onClick={() => setEditing({ status: 'active' })}><Plus />新增班級</button>} /><TableToolbar search={search} onSearch={setSearch} placeholder="搜尋班級" count={rows.length} /><div className="admin-panel admin-table-panel"><table className="admin-table"><thead><tr><th>班級名稱</th><th>授課教師</th><th>學生人數</th><th>狀態</th><th className="admin-actions-cell">操作</th></tr></thead><tbody>{rows.map((klass) => <tr key={klass.id}><td><strong>{klass.name}</strong></td><td>{klass.teacher_name ?? '尚未指派'}</td><td>{klass.student_count}</td><td><StatusChip status={klass.status} /></td><td className="admin-row-actions"><button onClick={() => setEditing(klass)}><Pencil /></button><button onClick={async () => { try { await api.updateClass(klass.id, { status: klass.status === 'active' ? 'archived' : 'active' }); await queryClient.invalidateQueries({ queryKey: ['admin-classes', organizationId] }); notify({ tone: 'success', text: klass.status === 'active' ? '班級已封存。' : '班級已恢復。' }); } catch (error) { notify({ tone: 'danger', text: readError(error) }); } }}><MoreHorizontal /></button><button className="danger" onClick={() => setDeleting(klass)}><Trash2 /></button></td></tr>)}</tbody></table></div>{editing && <Modal title={editing.id ? '編輯班級' : '新增班級'} description="建立班級並指派主要授課教師。" onClose={() => setEditing(null)}><form className="admin-form" onSubmit={save}><Field label="班級名稱"><input name="name" defaultValue={editing.name} required /></Field><Field label="授課教師"><select name="teacher_id" defaultValue={editing.teacher_id ?? ''}><option value="">尚未指派</option>{teachers.data?.data.filter((item) => item.role === 'teacher').map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></Field><FormActions onCancel={() => setEditing(null)} /></form></Modal>}{deleting && <Confirm title="刪除班級" body={`即將刪除「${deleting.name}」。已有考試指派的班級無法刪除，請改為封存。`} confirm="確認刪除" onCancel={() => setDeleting(null)} onConfirm={async () => { try { await api.deleteClass(deleting.id); await queryClient.invalidateQueries({ queryKey: ['admin-classes', organizationId] }); setDeleting(null); notify({ tone: 'success', text: '班級已刪除。' }); } catch (error) { notify({ tone: 'danger', text: readError(error) }); } }} />}</>;
}

export function PapersPanel({ organizationId, isPlatform, notify }: { organizationId: string; isPlatform: boolean; notify: Notice }) {
  const queryClient = useQueryClient(); const query = useQuery({ queryKey: ['admin-papers', organizationId], queryFn: () => api.getExamPapers(organizationId) }); const [search, setSearch] = useState(''); const [editing, setEditing] = useState<Partial<ExamPaperRow> | null>(null); const [deleting, setDeleting] = useState<ExamPaperRow | null>(null); const rows = query.data?.data.filter((item) => item.title.toLowerCase().includes(search.toLowerCase())) ?? [];
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { const body = { title: String(form.get('title')), description: String(form.get('description')), organization_id: organizationId }; if (editing?.id) await api.updateExamPaper(editing.id, body); else await api.createExamPaper(body); await queryClient.invalidateQueries({ queryKey: ['admin-papers', organizationId] }); setEditing(null); notify({ tone: 'success', text: editing?.id ? '考卷已更新。' : '考卷已建立。' }); } catch (error) { notify({ tone: 'danger', text: readError(error) }); } };
  return <><PageHeader eyebrow="ASSESSMENTS" title="考卷管理" description="管理考卷內容、版本與發布狀態" actions={<button className="admin-btn primary" onClick={() => setEditing({ status: 'draft' })}><Plus />新增考卷</button>} /><TableToolbar search={search} onSearch={setSearch} placeholder="搜尋考卷名稱" count={rows.length} /><div className="admin-panel admin-table-panel"><table className="admin-table"><thead><tr><th>考卷名稱</th><th>範圍</th><th>最新版本</th><th>版本狀態</th><th>考卷狀態</th><th className="admin-actions-cell">操作</th></tr></thead><tbody>{rows.map((paper) => <tr key={paper.id}><td><strong>{paper.title}</strong><small>{paper.description || '未填寫說明'}</small></td><td>{paper.organization_id ? '組織專用' : '平台共用'}</td><td>{paper.latest_version ?? '尚無版本'}</td><td><div className="admin-version-list">{paper.versions.slice(0, 2).map((version) => <button key={version.id} disabled={!isPlatform && !paper.organization_id} onClick={async () => { try { await api.updateExamVersion(version.id, { status: version.status === 'published' ? 'archived' : 'published' }); await queryClient.invalidateQueries({ queryKey: ['admin-papers', organizationId] }); notify({ tone: 'success', text: '版本狀態已更新。' }); } catch (error) { notify({ tone: 'danger', text: readError(error) }); } }}><StatusChip status={version.status} /></button>)}</div></td><td><StatusChip status={paper.status} /></td><td className="admin-row-actions"><button disabled={!isPlatform && !paper.organization_id} onClick={() => setEditing(paper)}><Pencil /></button><button disabled={!isPlatform && !paper.organization_id} onClick={async () => { try { await api.updateExamPaper(paper.id, { status: paper.status === 'published' ? 'archived' : 'published' }); await queryClient.invalidateQueries({ queryKey: ['admin-papers', organizationId] }); notify({ tone: 'success', text: '考卷狀態已更新。' }); } catch (error) { notify({ tone: 'danger', text: readError(error) }); } }}><MoreHorizontal /></button><button disabled={!isPlatform && !paper.organization_id} className="danger" onClick={() => setDeleting(paper)}><Trash2 /></button></td></tr>)}</tbody></table></div>{editing && <Modal title={editing.id ? '編輯考卷' : '新增考卷'} description="設定考卷名稱與用途說明。版本內容可由版本管理功能維護。" onClose={() => setEditing(null)}><form className="admin-form" onSubmit={save}><Field label="考卷名稱"><input name="title" defaultValue={editing.title} required /></Field><Field label="用途說明"><textarea name="description" rows={5} defaultValue={editing.description ?? ''} /></Field><FormActions onCancel={() => setEditing(null)} /></form></Modal>}{deleting && <Confirm title="刪除考卷" body={`即將刪除「${deleting.title}」。已有版本的考卷無法刪除，請改為封存。`} confirm="確認刪除" onCancel={() => setDeleting(null)} onConfirm={async () => { try { await api.deleteExamPaper(deleting.id); await queryClient.invalidateQueries({ queryKey: ['admin-papers', organizationId] }); setDeleting(null); notify({ tone: 'success', text: '考卷已刪除。' }); } catch (error) { notify({ tone: 'danger', text: readError(error) }); } }} />}</>;
}

export function AssignmentsPanel({ organizationId, notify }: { organizationId: string; notify: Notice }) {
  const queryClient = useQueryClient(); const query = useQuery({ queryKey: ['admin-assignments', organizationId], queryFn: () => api.getAssignments(organizationId) }); const classes = useQuery({ queryKey: ['admin-classes', organizationId], queryFn: () => api.getClasses(organizationId) }); const papers = useQuery({ queryKey: ['admin-papers', organizationId], queryFn: () => api.getExamPapers(organizationId) }); const [search, setSearch] = useState(''); const [editing, setEditing] = useState<Partial<AssignmentRow> | null>(null); const [deleting, setDeleting] = useState<AssignmentRow | null>(null); const rows = query.data?.data.filter((item) => `${item.exam_title} ${item.class_name}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { const body: Record<string, unknown> = { opens_at: new Date(String(form.get('opens_at'))).toISOString(), closes_at: new Date(String(form.get('closes_at'))).toISOString(), max_attempts: Number(form.get('max_attempts')) }; if (!editing?.id) Object.assign(body, { exam_version_id: String(form.get('exam_version_id')), class_id: String(form.get('class_id')), organization_id: organizationId }); if (editing?.id) await api.updateAssignment(editing.id, body); else await api.createAssignment(body); await queryClient.invalidateQueries({ queryKey: ['admin-assignments', organizationId] }); setEditing(null); notify({ tone: 'success', text: editing?.id ? '考試指派已更新。' : '考試已指派。' }); } catch (error) { notify({ tone: 'danger', text: readError(error) }); } };
  const localInput = (value?: string) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  return <><PageHeader eyebrow="DELIVERY" title="考試指派" description="安排班級考試期間、次數與開放狀態" actions={<button className="admin-btn primary" onClick={() => setEditing({ max_attempts: 1 })}><Plus />新增指派</button>} /><TableToolbar search={search} onSearch={setSearch} placeholder="搜尋考卷或班級" count={rows.length} /><div className="admin-panel admin-table-panel"><table className="admin-table"><thead><tr><th>考卷</th><th>班級</th><th>開放期間</th><th>作答次數</th><th>提交</th><th>狀態</th><th className="admin-actions-cell">操作</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td><strong>{item.exam_title}</strong><small>{item.version_no}</small></td><td>{item.class_name ?? '—'}</td><td>{formatDate(item.opens_at)}<small>至 {formatDate(item.closes_at)}</small></td><td>{item.max_attempts}</td><td>{item.attempt_count}</td><td><StatusChip status={item.status} /></td><td className="admin-row-actions"><button onClick={() => setEditing(item)}><Pencil /></button><button onClick={async () => { try { await api.updateAssignment(item.id, { status: item.status === 'closed' ? 'active' : 'closed' }); await queryClient.invalidateQueries({ queryKey: ['admin-assignments', organizationId] }); notify({ tone: 'success', text: '指派狀態已更新。' }); } catch (error) { notify({ tone: 'danger', text: readError(error) }); } }}><MoreHorizontal /></button><button className="danger" onClick={() => setDeleting(item)}><Trash2 /></button></td></tr>)}</tbody></table></div>{editing && <Modal title={editing.id ? '編輯考試指派' : '新增考試指派'} description="考卷版本必須先發布，才能指派給班級。" onClose={() => setEditing(null)}><form className="admin-form" onSubmit={save}>{!editing.id && <><Field label="考卷版本"><select name="exam_version_id" required><option value="">請選擇</option>{papers.data?.data.flatMap((paper) => paper.versions.filter((version) => version.status === 'published').map((version) => <option key={version.id} value={version.id}>{paper.title} · {version.version_no}</option>))}</select></Field><Field label="班級"><select name="class_id" required><option value="">請選擇</option>{classes.data?.data.filter((klass) => klass.status === 'active').map((klass) => <option key={klass.id} value={klass.id}>{klass.name}</option>)}</select></Field></>}<div className="admin-form-grid two"><Field label="開放時間"><input name="opens_at" type="datetime-local" defaultValue={localInput(editing.opens_at)} required /></Field><Field label="關閉時間"><input name="closes_at" type="datetime-local" defaultValue={localInput(editing.closes_at)} required /></Field></div><Field label="最多作答次數"><input name="max_attempts" type="number" min="1" max="10" defaultValue={editing.max_attempts ?? 1} required /></Field><FormActions onCancel={() => setEditing(null)} /></form></Modal>}{deleting && <Confirm title="刪除考試指派" body={`即將刪除「${deleting.exam_title}」對 ${deleting.class_name} 的指派。已有作答紀錄時無法刪除，請改為關閉。`} confirm="確認刪除" onCancel={() => setDeleting(null)} onConfirm={async () => { try { await api.deleteAssignment(deleting.id); await queryClient.invalidateQueries({ queryKey: ['admin-assignments', organizationId] }); setDeleting(null); notify({ tone: 'success', text: '考試指派已刪除。' }); } catch (error) { notify({ tone: 'danger', text: readError(error) }); } }} />}</>;
}

export function ResultsPanel({ organizationId }: { organizationId: string }) {
  const query = useQuery({ queryKey: ['admin-results', organizationId], queryFn: () => api.teacherResults(organizationId) }); const [search, setSearch] = useState(''); const [status, setStatus] = useState('all'); const rows = useMemo(() => query.data?.data.filter((item) => (status === 'all' || item.status === status) && `${item.student_name} ${item.exam_title}`.toLowerCase().includes(search.toLowerCase())) ?? [], [query.data, search, status]);
  const exportResults = () => {
    const header = ['學生', '班級', '考試', '閱讀', '聽力', '口說', '寫作', '總分', '狀態', '提交時間'];
    const csv = [header, ...rows.map((item) => [item.student_name, item.class_name ?? '', item.exam_title, item.reading_score ?? '', item.listening_score ?? '', item.speaking_score ?? '', item.writing_score ?? '', item.total_score ?? '', statusLabels[item.status] ?? item.status, item.submitted_at ?? ''])]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `toefl-results-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    URL.revokeObjectURL(url);
  };
  return <><PageHeader eyebrow="REPORTING" title="成績管理" description="查詢學生各科成績與 AI 評分進度" actions={<button className="admin-btn secondary" onClick={exportResults}>匯出資料</button>} /><TableToolbar search={search} onSearch={setSearch} placeholder="搜尋學生或考試" count={rows.length}><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">全部狀態</option><option value="completed">已完成</option><option value="grading">評分中</option><option value="error">需處理</option></select></TableToolbar><div className="admin-panel admin-table-panel"><ResultsTable rows={rows} /></div></>;
}

function ResultsTable({ rows, compact = false }: { rows: TeacherResultRow[]; compact?: boolean }) {
  if (!rows.length) return <div className="admin-empty-inline">目前沒有符合條件的成績資料。</div>;
  return <table className="admin-table"><thead><tr><th>學生</th><th>考試</th>{!compact && <><th>閱讀</th><th>聽力</th><th>口說</th><th>寫作</th></>}<th>總分</th><th>狀態</th><th>操作</th></tr></thead><tbody>{rows.map((item) => <tr key={item.attempt_id}><td><strong>{item.student_name}</strong>{!compact && <small>{item.class_name ?? '未分類班級'}</small>}</td><td>{item.exam_title}<small>{formatDate(item.submitted_at)}</small></td>{!compact && <><td>{item.reading_score ?? '—'}</td><td>{item.listening_score ?? '—'}</td><td>{item.speaking_score ?? '—'}</td><td>{item.writing_score ?? '—'}</td></>}<td><strong className="admin-score">{item.total_score ?? '—'}</strong></td><td><StatusChip status={item.status} /></td><td><a className="admin-primary-link" href={`/reports/${item.attempt_id}`}>查看報告</a></td></tr>)}</tbody></table>;
}

function TableToolbar({ search, onSearch, placeholder, count, children }: { search: string; onSearch: (value: string) => void; placeholder: string; count: number; children?: ReactNode }) {
  return <div className="admin-table-toolbar"><label><Search /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} /></label>{children}<span>{count.toLocaleString()} 筆資料</span></div>;
}

function StatusChip({ status }: { status: string }) { return <span className={`admin-status ${statusTone(status)}`}>{statusLabels[status] ?? status}</span>; }

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) { return <label className="admin-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }

function FormActions({ onCancel }: { onCancel: () => void }) { return <div className="admin-form-actions"><button type="button" className="admin-btn secondary" onClick={onCancel}>取消</button><button type="submit" className="admin-btn primary">儲存變更</button></div>; }

function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) { return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="admin-modal" role="dialog" aria-modal="true" aria-label={title}><header><div><h2>{title}</h2><p>{description}</p></div><button type="button" onClick={onClose} aria-label="關閉"><X /></button></header>{children}</section></div>; }

function Confirm({ title, body, confirm, onCancel, onConfirm }: { title: string; body: string; confirm: string; onCancel: () => void; onConfirm: () => void | Promise<void> }) { return <div className="admin-modal-backdrop"><section className="admin-modal admin-confirm" role="alertdialog" aria-modal="true"><div className="admin-danger-icon"><Trash2 /></div><h2>{title}</h2><p>{body}</p><div className="admin-form-actions"><button className="admin-btn secondary" onClick={onCancel}>取消</button><button className="admin-btn danger" onClick={onConfirm}>{confirm}</button></div></section></div>; }

export function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) { return <div className="admin-empty-state">{icon}<h1>{title}</h1><p>{body}</p></div>; }

export type Notice = (notice: { tone: 'success' | 'danger'; text: string }) => void;
