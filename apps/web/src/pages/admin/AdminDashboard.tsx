import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import {
  AccountsPanel,
  AssignmentsPanel,
  ClassesPanel,
  EmptyState,
  OrganizationsPanel,
  Overview,
  PapersPanel,
  ResultsPanel,
  Subnav,
  type AccountView,
  type Section,
} from './AdminDashboardPanels';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const isPlatform = user?.role === 'platform_admin';
  const [section, setSection] = useState<Section>('overview');
  const [accountView, setAccountView] = useState<AccountView>('accounts');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('admin-theme') === 'dark');
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const organizations = useQuery({
    queryKey: ['admin-organizations'],
    queryFn: api.getOrganizations,
    enabled: isPlatform,
  });
  const [selectedOrgId, setSelectedOrgId] = useState(() =>
    isPlatform ? localStorage.getItem('admin-organization') ?? '' : user?.organization_id ?? '',
  );
  const ownOrganization = useQuery({
    queryKey: ['admin-organization', user?.organization_id],
    queryFn: () => api.getOrganization(user!.organization_id!),
    enabled: !isPlatform && Boolean(user?.organization_id),
  });

  useEffect(() => {
    if (isPlatform && !selectedOrgId && organizations.data?.data[0]) {
      setSelectedOrgId(organizations.data.data[0].id);
    }
  }, [isPlatform, organizations.data, selectedOrgId]);

  useEffect(() => {
    if (!isPlatform && user?.organization_id && selectedOrgId !== user.organization_id) {
      setSelectedOrgId(user.organization_id);
    }
  }, [isPlatform, selectedOrgId, user?.organization_id]);

  useEffect(() => {
    document.documentElement.dataset.adminTheme = dark ? 'dark' : 'light';
    localStorage.setItem('admin-theme', dark ? 'dark' : 'light');
    return () => { delete document.documentElement.dataset.adminTheme; };
  }, [dark]);

  useEffect(() => {
    if (selectedOrgId && isPlatform) localStorage.setItem('admin-organization', selectedOrgId);
  }, [isPlatform, selectedOrgId]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selectedOrganization = isPlatform
    ? organizations.data?.data.find((org) => org.id === selectedOrgId)
    : ownOrganization.data;

  const nav = isPlatform
    ? [
        ['overview', '總覽', LayoutDashboard], ['organizations', '組織', Building2],
        ['accounts', '帳號', UserRound], ['papers', '考卷', FileText], ['results', '成績', BarChart3],
      ] as const
    : [
        ['overview', '總覽', LayoutDashboard], ['accounts', '帳號', UserRound], ['classes', '班級', UsersRound],
        ['papers', '考卷', FileText], ['assignments', '考試指派', ClipboardList], ['results', '成績', BarChart3],
      ] as const;

  const go = (next: Section) => {
    setSection(next);
    if (next === 'accounts') setAccountView('accounts');
    setSidebarOpen(false);
  };

  return (
    <div className="admin-app">
      <aside className={`admin-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="admin-brand"><span className="admin-brand-mark">T</span><span>TOEFL Admin</span></div>
        <div className="admin-org-label">目前組織</div>
        {isPlatform ? (
          <label className="admin-org-switcher">
            <span>{selectedOrganization?.name ?? '選擇組織'}</span>
            <small>平台管理員</small>
            <ChevronDown aria-hidden="true" />
            <select aria-label="選擇目前組織" value={selectedOrgId} onChange={(event) => setSelectedOrgId(event.target.value)}>
              {organizations.data?.data.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          </label>
        ) : (
          <div className="admin-org-static"><span>{selectedOrganization?.name ?? '組織管理後台'}</span><small>組織管理員</small></div>
        )}
        <nav className="admin-nav" aria-label="管理後台主選單">
          {nav.map(([key, label, Icon]) => (
            <button key={key} type="button" className={section === key ? 'is-active' : ''} onClick={() => go(key)}>
              <Icon aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-spacer" />
        <button type="button" className="admin-sidebar-link"><Settings aria-hidden="true" />系統設定</button>
        <div className="admin-profile">
          <span className="admin-avatar">{user?.name?.slice(0, 1) ?? 'A'}</span>
          <span><strong>{user?.name}</strong><small>{user?.email}</small></span>
          <button type="button" onClick={() => logout()} aria-label="登出"><LogOut /></button>
        </div>
      </aside>
      {sidebarOpen && <button className="admin-scrim" aria-label="關閉選單" onClick={() => setSidebarOpen(false)} />}
      <div className="admin-main">
        <header className="admin-topbar">
          <button type="button" className="admin-icon-btn admin-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="開啟選單"><Menu /></button>
          <div className="admin-breadcrumb">{isPlatform ? '平台管理' : '組織管理'} <span>/</span> {selectedOrganization?.name ?? '—'}</div>
          <div className="admin-top-actions">
            <button type="button" className="admin-icon-btn" aria-label="搜尋"><Search /></button>
            <button type="button" className="admin-icon-btn admin-notification" aria-label="通知"><Bell /><i /></button>
            <button type="button" className="admin-theme-toggle" onClick={() => setDark((value) => !value)} aria-label={dark ? '切換淺色模式' : '切換深色模式'}>
              <Sun /><span className={dark ? 'is-dark' : ''} /><Moon />
            </button>
          </div>
        </header>
        <main className="admin-content">
          {!selectedOrgId && section !== 'organizations' ? (
            <EmptyState icon={<Building2 />} title="請先選擇組織" body="選擇組織後即可管理帳號、班級、考卷與成績。" />
          ) : (
            <>
              {section === 'overview' && <Overview organization={selectedOrganization} organizationId={selectedOrgId} onNavigate={go} />}
              {section === 'organizations' && isPlatform && <OrganizationsPanel selectedId={selectedOrgId} onSelect={(id) => { setSelectedOrgId(id); go('overview'); }} notify={setNotice} />}
              {section === 'accounts' && (
                <div>
                  {isPlatform && <Subnav value={accountView} onChange={setAccountView} />}
                  {accountView === 'accounts' && <AccountsPanel organizationId={selectedOrgId} isPlatform={isPlatform} notify={setNotice} />}
                  {isPlatform && accountView === 'classes' && <ClassesPanel organizationId={selectedOrgId} notify={setNotice} />}
                  {isPlatform && accountView === 'assignments' && <AssignmentsPanel organizationId={selectedOrgId} notify={setNotice} />}
                </div>
              )}
              {section === 'classes' && <ClassesPanel organizationId={selectedOrgId} notify={setNotice} />}
              {section === 'papers' && <PapersPanel organizationId={selectedOrgId} isPlatform={isPlatform} notify={setNotice} />}
              {section === 'assignments' && <AssignmentsPanel organizationId={selectedOrgId} notify={setNotice} />}
              {section === 'results' && <ResultsPanel organizationId={selectedOrgId} />}
            </>
          )}
        </main>
      </div>
      {notice && <div className={`admin-toast ${notice.tone}`}><CheckCircle2 />{notice.text}</div>}
    </div>
  );
}
