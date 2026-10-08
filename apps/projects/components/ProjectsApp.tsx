import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AppBackground from '@/components/AppBackground';
import { Navbar } from '@/components/Navbar';
import { ToastNotification } from '@/components/ToastNotification';
import { AccountUser } from '@/types';
import { hasRole } from '@/utils/roleUtils';
import { supabase } from '@/services/supabaseClient';
import TaskDrawer, { DrawerTarget } from './TaskDrawer';
import MetricsTab from './MetricsTab';
import { useWorkspace, matchesWorkspace } from '@/services/WorkspaceContext';
import {
  PmTask, PmWorker, PmStatusLog, PmSubtask, SubtaskStatus,
  fetchPmData, fetchSubtasks, createSubtask, updateSubtask, deleteSubtask,
  fetchTaskTime, PmTaskTime, STUCK_HOURS, hoursSince,
  isDone, isFix, isOverdue, projectOf, norm, todayISO,
} from '../services/projectService';

// Navbar chỉ nhận các id tab cố định ⇒ map id → nhãn của app này.
type TabId = 'overview' | 'reports' | 'history' | 'dashboard' | 'recurring' | 'activity';
const TAB_LABELS: Record<string, string> = {
  overview: 'Tổng quan', reports: 'Dự án', history: 'Nhân sự', dashboard: 'Chỉ số', recurring: 'Task phụ', activity: 'Tài chính',
};
const HASH_TAB: Record<string, TabId> = {
  overview: 'overview', projects: 'reports', people: 'history', metrics: 'dashboard', subtasks: 'recurring', finance: 'activity',
};

const card = 'rounded-[20px] border border-primary/10 p-6 bg-surface';
const kpiCard = 'rounded-[20px] border border-primary/10 p-5 space-y-1 bg-surface';
const rowCard = 'flex items-center gap-4 p-4 rounded-[20px] border border-primary/10 hover:border-primary/20 transition-all bg-surface';
const tr = 'border-b border-white/5 hover:bg-white/5 transition-colors';
const btnXs = 'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all disabled:opacity-50';
const btnPrimary = 'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50';
const btnGhost = 'px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all disabled:opacity-50';
const btnOutline = 'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-all disabled:opacity-50';
const fieldLabel = 'text-neutral-500 text-[10px] font-black uppercase tracking-wider';
// Màu badge theo bảng gợi ý STYLE_GUIDE §Badges + token neutral-medium.
const C = { orange: '#FF9500', green: '#34C759', red: '#F44336', amber: '#FFA726', blue: '#0A84FF', purple: '#AF52DE', gray: '#9D9C9D' };
const kpiLabel = 'text-[10px] font-black text-neutral-600 uppercase tracking-wider';
const input = 'px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full';
const Badge: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg" style={{ background: color + '20', color }}>{children}</span>
);
const Kpi: React.FC<{ label: string; value: React.ReactNode; color?: string; hint?: string }> = ({ label, value, color, hint }) => (
  <div className={kpiCard}>
    <div className={kpiLabel + ' flex items-center gap-2'}>
      {color && <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />}{label}
    </div>
    <div className="text-2xl font-black text-white">{value}</div>
    {hint && <div className="text-xs text-neutral-medium">{hint}</div>}
  </div>
);
const Empty: React.FC<{ emoji: string; text: string; hint?: string }> = ({ emoji, text, hint }) => (
  <div className="text-center py-16 text-neutral-700 text-sm">
    <p className="text-3xl mb-3">{emoji}</p>
    <p className="text-neutral-600 text-sm">{text}</p>
    {hint && <p className="text-xs mt-1 text-neutral-700">{hint}</p>}
  </div>
);
const Heading: React.FC<{ title: string; sub: string }> = ({ title, sub }) => (
  <div className="mb-6">
    <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>{title}</h2>
    <p className="text-sm text-neutral-medium mt-1">{sub}</p>
  </div>
);
// Khai báo NGOÀI component: khai báo trong render ⇒ remount mỗi lần gõ ⇒ input mất focus.
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1"><label className={fieldLabel}>{label}</label>{children}</div>
);
const fmtH = (h: number) => (h >= 100 ? Math.round(h) : Math.round(h * 10) / 10) + 'h';
const fmtDate = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');

interface Props { currentUser: AccountUser; onBack: () => void; initialTab?: string | null; }

const ProjectsApp: React.FC<Props> = ({ currentUser, onBack, initialTab }) => {
  const isAdmin = hasRole(currentUser, 'admin');
  const { workspace } = useWorkspace();
  const [tab, setTab] = useState<TabId>(HASH_TAB[initialTab || ''] || 'overview');
  // Hash đổi khi app đang mở (Back, link #projects/subtasks) ⇒ App không remount ⇒ phải tự theo.
  useEffect(() => { if (initialTab && HASH_TAB[initialTab]) setTab(HASH_TAB[initialTab]); }, [initialTab]);
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [assignees, setAssignees] = useState<{ task_id: string; worker_id: string }[]>([]);
  const [workers, setWorkers] = useState<PmWorker[]>([]);
  const [logs, setLogs] = useState<PmStatusLog[]>([]);
  const [subtasks, setSubtasks] = useState<PmSubtask[]>([]);
  const [times, setTimes] = useState<PmTaskTime[]>([]);
  const [statusCat, setStatusCat] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState<DrawerTarget>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchPmData();
      setTasks(d.tasks); setAssignees(d.assignees); setWorkers(d.workers); setLogs(d.logs);
      setSubtasks(await fetchSubtasks());
      setTimes(await fetchTaskTime());
      const { data: cats } = await supabase.from('wf_status_categories').select('status, category');
      setStatusCat(Object.fromEntries((cats || []).map((c: any) => [c.status, c.category])));
    } catch (e: any) { setToast({ message: e.message || 'Có lỗi xảy ra', type: 'error' }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load, workspace]);

  // Nhân sự theo sổ đang chọn; task kế thừa qua người làm.
  const wsWorkers = useMemo(() => workers.filter(w => matchesWorkspace((w as any).entity, workspace)), [workers, workspace]);
  const workerIds = useMemo(() => new Set(wsWorkers.map(w => w.id)), [wsWorkers]);
  const workersOfTask = useMemo(() => {
    const m = new Map<string, string[]>();
    assignees.forEach(a => m.set(a.task_id, [...(m.get(a.task_id) || []), a.worker_id]));
    tasks.forEach(t => { if (!m.has(t.id) && t.worker_id) m.set(t.id, [t.worker_id]); });
    return m;
  }, [assignees, tasks]);
  const wsTasks = useMemo(
    () => tasks.filter(t => (workersOfTask.get(t.id) || []).some(id => workerIds.has(id))),
    [tasks, workersOfTask, workerIds],
  );
  const fixCount = useMemo(() => {
    const m = new Map<string, number>();
    logs.forEach(l => { if (norm(l.to_status) === 'fix') m.set(l.task_id, (m.get(l.task_id) || 0) + 1); });
    return m;
  }, [logs]);

  // Lần đầu giao khách (sang client_review) theo task — mốc tính "Đúng hạn".
  const firstReview = useMemo(() => {
    const m = new Map<string, string>();
    times.forEach(x => { if (x.first_client_review_at && (!m.get(x.task_id) || x.first_client_review_at < m.get(x.task_id)!)) m.set(x.task_id, x.first_client_review_at); });
    return m;
  }, [times]);
  const vnDate = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  /** Ngày giao: lần đầu sang client_review (có log từ 17/9); không có thì ngày đóng trên ClickUp. */
  const deliveredOn = (t: PmTask) => { const f = firstReview.get(t.id); return f ? vnDate(f) : (t.completed_at || t.closed_date || null); };
  const open = wsTasks.filter(t => !isDone(t));
  const overdue = open.filter(t => isOverdue(t, false));
  const fixing = open.filter(isFix);
  const monthPrefix = todayISO().slice(0, 7);
  const doneThisMonth = wsTasks.filter(t => isDone(t) && (t.completed_at || t.closed_date || t.clickup_updated_at || '').startsWith(monthPrefix));
  const withDue = wsTasks.filter(t => t.due_date).length;
  // Task đứng: trạng thái hiện tại kéo dài quá ngưỡng (1 dòng / task dù nhiều người làm).
  const stuck = useMemo(() => {
    const seen = new Set<string>(); const out: { t: PmTask; x: PmTaskTime; h: number }[] = [];
    times.forEach(x => {
      if (seen.has(x.task_id)) return; seen.add(x.task_id);
      const cat = statusCat[x.current_status || '']; const lim = STUCK_HOURS[cat]; const h = hoursSince(x.current_status_since);
      const t = wsTasks.find(tt => tt.id === x.task_id);
      if (t && lim && h > lim) out.push({ t, x, h });
    });
    return out.sort((a, b) => b.h - a.h);
  }, [times, statusCat, wsTasks]);

  // ── Dự án ──
  const projects = useMemo(() => {
    const m = new Map<string, PmTask[]>();
    wsTasks.forEach(t => { const k = projectOf(t); m.set(k, [...(m.get(k) || []), t]); });
    return [...m.entries()].map(([name, ts]) => {
      const done = ts.filter(isDone).length;
      const dues = ts.map(t => t.due_date).filter(Boolean) as string[];
      return {
        name, space: ts[0]?.clickup_space_name || '', total: ts.length, done,
        pct: ts.length ? Math.round((done / ts.length) * 100) : 0,
        overdue: ts.filter(t => isOverdue(t, isDone(t))).length,
        fix: ts.filter(t => !isDone(t) && isFix(t)).length,
        lastDue: dues.sort().at(-1) || null,
      };
    }).sort((a, b) => (b.total - b.done) - (a.total - a.done));
  }, [wsTasks]);

  // ── Nhân sự ──
  const people = useMemo(() => wsWorkers.filter(w => w.is_active !== false).map(w => {
    const ts = wsTasks.filter(t => (workersOfTask.get(t.id) || []).includes(w.id));
    const done = ts.filter(isDone);
    // Đúng hạn = giao khách lần đầu ≤ hạn chót (trước đây so ngày ĐÓNG task ⇒ thấp oan vì chờ khách duyệt).
    const delivered = ts.filter(t => t.due_date && (firstReview.has(t.id) || isDone(t)));
    const onTime = delivered.filter(t => { const d = deliveredOn(t); return d && d <= t.due_date!; }).length;
    const doneWithDue = delivered.length;
    // Khối lượng: task đang ở trạng thái "đang làm" (không tính chờ khách / chưa bắt đầu).
    const activeNow = ts.filter(t => !isDone(t) && statusCat[norm(t.clickup_status)] === 'active').length;
    const subs = subtasks.filter(s => s.assignee_worker_id === w.id);
    return {
      w, total: ts.length, done: done.length, activeNow,
      doing: ts.length - done.length,
      overdue: ts.filter(t => isOverdue(t, isDone(t))).length + subs.filter(s => isOverdue(s, s.status === 'done' || s.status === 'cancelled')).length,
      fix: ts.reduce((n, t) => n + (fixCount.get(t.id) || 0), 0),
      onTimePct: doneWithDue ? Math.round((onTime / doneWithDue) * 100) : null,
      subOpen: subs.filter(s => s.status === 'todo' || s.status === 'doing').length,
      // Giờ làm: fulltime = giao giờ chấm công; freelancer = giờ đồng hồ (tương đối).
      hours: (() => {
        const mine = times.filter(x => x.worker_id === w.id);
        const delivered = mine.filter(x => x.first_client_review_at);
        const sum = mine.reduce((n, x) => n + x.active_hours, 0);
        return { total: sum, avg: delivered.length ? delivered.reduce((n, x) => n + x.active_hours, 0) / delivered.length : null,
                 firstPass: delivered.length ? Math.round(delivered.filter(x => x.fix_rounds === 0).length / delivered.length * 100) : null,
                 fulltime: mine.some(x => x.is_fulltime) };
      })(),
    };
  }).sort((a, b) => b.done - a.done), [wsWorkers, wsTasks, workersOfTask, subtasks, fixCount, times, firstReview, statusCat]);

  const workerName = (id: string | null) => workers.find(w => w.id === id)?.full_name || '—';
  const accessibleTabs: TabId[] = isAdmin ? ['overview', 'reports', 'history', 'dashboard', 'recurring', 'activity'] : ['overview', 'reports', 'history', 'dashboard', 'recurring'];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />
      {toast && <ToastNotification message={{ text: toast.message, type: toast.type }} onDismiss={() => setToast(null)} />}
      <Navbar
        theme="dark" currentUser={currentUser} appName="Dự án"
        activeTab={tab as any} accessibleTabs={accessibleTabs as any} tabLabels={TAB_LABELS}
        onTabChange={(t) => setTab(t as TabId)} onLogout={onBack} onBack={onBack}
      />
      <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full">
        {loading && <div className="text-xs text-neutral-medium mb-4 animate-td-pulse">Đang tải...</div>}

        {tab === 'overview' && (
          <div className="animate-fadeInUp">
            <Heading title="Tổng quan" sub="Tiến độ công việc toàn công ty (ClickUp + task phụ)" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-6">
              <Kpi label="Đang làm" value={open.length} color={C.blue} />
              <Kpi label="Trễ hạn" value={overdue.length} color={C.red} hint={withDue ? undefined : 'Chưa có task nào có hạn chót'} />
              <Kpi label="Đang FIX" value={fixing.length} color={C.amber} />
              <Kpi label="Xong tháng này" value={doneThisMonth.length} color={C.green} />
              <Kpi label="Task phụ mở" value={subtasks.filter(s => s.status === 'todo' || s.status === 'doing').length} color={C.orange} />
            </div>
            {stuck.length > 0 && (
              <div className={card + ' mb-6'}>
                <div className="text-base font-black uppercase tracking-wider text-white mb-1">Task đứng lâu</div>
                <p className="text-xs text-neutral-medium mb-4">Đang làm quá {STUCK_HOURS.active}h hoặc chờ khách quá {STUCK_HOURS.waiting_client / 24} ngày ở cùng một trạng thái</p>
                <div className="space-y-3">
                  {stuck.slice(0, 20).map(({ t, x, h }) => (
                    <div key={t.id} onClick={() => setDrawer({ kind: 'task', taskId: t.id })} className="flex items-center justify-between gap-3 cursor-pointer rounded-xl -mx-2 px-2 py-1 hover:bg-white/5 transition-colors">
                      <div className="min-w-0"><div className="text-sm font-semibold text-white truncate">{t.title}</div>
                        <div className="text-xs text-neutral-medium">{projectOf(t)} · {(workersOfTask.get(t.id) || []).map(workerName).join(', ')}</div></div>
                      <div className="flex gap-2 shrink-0">
                        <Badge color={statusCat[x.current_status || ''] === 'active' ? C.amber : C.blue}>{x.current_status}</Badge>
                        <Badge color={C.red}>{Math.floor(h / 24)} ngày</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className={card}>
              <div className="text-base font-black uppercase tracking-wider text-white mb-4">Task trễ hạn</div>
              {overdue.length === 0 ? <Empty emoji="✅" text="Không có task trễ hạn" /> : (
                <div className="space-y-3">
                  {overdue.slice(0, 20).map(t => (
                    <div key={t.id} onClick={() => setDrawer({ kind: 'task', taskId: t.id })} className="flex items-center justify-between gap-3 cursor-pointer rounded-xl -mx-2 px-2 py-1 hover:bg-white/5 transition-colors">
                      <div className="min-w-0"><div className="text-sm font-semibold text-white truncate">{t.title}</div>
                        <div className="text-xs text-neutral-medium">{projectOf(t)} · {(workersOfTask.get(t.id) || []).map(workerName).join(', ')}</div></div>
                      <Badge color={C.red}>Hạn {fmtDate(t.due_date)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'reports' && (
          <div className="animate-fadeInUp">
            <Heading title="Dự án" sub="Tiến độ theo dự án (folder ClickUp) — bấm 1 dự án để xem task và dòng thời gian" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className={kpiLabel + ' text-left border-b border-white/5'}>
                  <th className="py-2">Dự án</th><th>Tiến độ</th><th className="text-right">Task</th>
                  <th className="text-right">Trễ</th><th className="text-right">FIX</th><th className="text-right">Hạn cuối</th></tr></thead>
                <tbody>
                  {projects.length === 0 && !loading && <tr><td colSpan={6}><Empty emoji="📁" text="Chưa có dự án" /></td></tr>}
                  {projects.map(p => (
                    <tr key={p.name} className={tr + ' cursor-pointer'} onClick={() => setDrawer({ kind: 'project', name: p.name })}>
                      <td className="py-3"><div className="text-sm font-semibold text-white">{p.name}</div><div className="text-xs text-neutral-medium">{p.space}</div></td>
                      <td className="w-56"><div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-white/10"><div className="h-1.5 rounded-full" style={{ width: p.pct + '%', background: '#FF9500' }} /></div>
                        <span className="text-xs text-neutral-400 w-9 text-right">{p.pct}%</span></div></td>
                      <td className="text-right text-neutral-300">{p.done}/{p.total}</td>
                      <td className="text-right">{p.overdue ? <Badge color={C.red}>{p.overdue}</Badge> : <span className="text-neutral-600">0</span>}</td>
                      <td className="text-right">{p.fix ? <Badge color={C.amber}>{p.fix}</Badge> : <span className="text-neutral-600">0</span>}</td>
                      <td className="text-right text-neutral-400">{fmtDate(p.lastDue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="animate-fadeInUp">
            <Heading title="Nhân sự" sub="Hiệu suất fulltime + freelancer (không hiển thị tiền)" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead><tr className={kpiLabel + ' text-left border-b border-white/5'}>
                  <th className="py-2">Nhân sự</th><th className="text-right">Đã xong</th><th className="text-right" title="Task ở trạng thái đang làm / tổng task chưa xong">Đang làm</th>
                  <th className="text-right">Trễ hạn</th><th className="text-right">Lần FIX</th><th className="text-right">Đúng hạn</th><th className="text-right">Giờ làm</th><th className="text-right">TB / task</th><th className="text-right">Duyệt lần đầu</th><th className="text-right">Task phụ mở</th></tr></thead>
                <tbody>
                  {people.map(p => (
                    <tr key={p.w.id} className={tr}>
                      <td className="py-3"><span className="text-sm font-semibold text-white">{p.w.full_name}</span>{' '}
                        <Badge color={p.w.type === 'freelancer' ? C.purple : C.blue}>{p.w.type || '—'}</Badge></td>
                      <td className="text-right text-white font-bold">{p.done}</td>
                      <td className="text-right text-neutral-300"><span className={p.activeNow >= 4 ? 'text-orange-400 font-semibold' : ''}>{p.activeNow}</span><span className="text-neutral-600">/{p.doing}</span></td>
                      <td className="text-right">{p.overdue ? <Badge color={C.red}>{p.overdue}</Badge> : <span className="text-neutral-600">0</span>}</td>
                      <td className="text-right">{p.fix ? <Badge color={C.amber}>{p.fix}</Badge> : <span className="text-neutral-600">0</span>}</td>
                      <td className="text-right text-neutral-300">{p.onTimePct == null ? '—' : p.onTimePct + '%'}</td>
                      <td className="text-right text-white font-semibold">{p.hours.total ? fmtH(p.hours.total) : '—'}{!p.hours.fulltime && p.hours.total > 0 && <span className="text-neutral-600">*</span>}</td>
                      <td className="text-right text-neutral-300">{p.hours.avg == null ? '—' : fmtH(p.hours.avg)}</td>
                      <td className="text-right text-neutral-300">{p.hours.firstPass == null ? '—' : p.hours.firstPass + '%'}</td>
                      <td className="text-right text-neutral-300">{p.subOpen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-neutral-medium mt-3">"Giờ làm" = thời gian task ở trạng thái đang làm (in progress, fix, lead_check, internal review); fulltime chỉ tính trong giờ chấm công, trừ nghỉ trưa — <span className="text-neutral-600">*</span> freelancer tính giờ đồng hồ (tương đối). Không tính client_review / pending. "TB / task" và "Duyệt lần đầu" (không FIX) tính trên task đã giao khách. Dữ liệu từ 17/09/2026. "Đang làm" = task ở trạng thái đang làm / tổng task chưa xong (cam khi ≥ 4). "Đúng hạn" = lần đầu giao khách ≤ hạn chót.</p>
          </div>
        )}

        {tab === 'recurring' && (
          <SubtaskTab subtasks={subtasks} setSubtasks={setSubtasks} workers={wsWorkers} tasks={wsTasks}
            projectNames={projects.map(p => p.name)} workerName={workerName}
            onError={(m) => setToast({ message: m, type: 'error' })} onOk={(m) => setToast({ message: m, type: 'success' })} />
        )}

        {tab === 'dashboard' && (
          <MetricsTab tasks={wsTasks} times={times} logs={logs} statusCat={statusCat} isAdmin={isAdmin} deliveredOn={deliveredOn}
            onCatsSaved={load} onError={(m) => setToast({ message: m, type: 'error' })} onOk={(m) => setToast({ message: m, type: 'success' })} />
        )}

        {tab === 'activity' && isAdmin && (
          <div className="animate-fadeInUp">
            <Heading title="Tài chính" sub="Chỉ admin thấy — doanh thu, chi phí theo dự án" />
            <div className={card}>
              <p className="text-sm text-neutral-medium mb-4">Số liệu tài chính đang nằm ở Workforce → Tổng quan (doanh thu, chi phí nhân sự, hiệu suất theo tiền).</p>
              <a href="#workforce/overview" className={btnPrimary + ' inline-block'} style={{ background: '#FF9500' }}>Mở tài chính dự án →</a>
            </div>
          </div>
        )}
      </main>
      <TaskDrawer target={drawer} onClose={() => setDrawer(null)} onOpenTask={(id) => setDrawer({ kind: 'task', taskId: id })}
        tasks={wsTasks} times={times} workerName={workerName} workersOfTask={workersOfTask} />
      <footer className="py-12 border-t text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
        TD Games • Enterprise Platform • v3.0
      </footer>
    </div>
  );
};

// ── Task phụ ──────────────────────────────────────────────────────────────
const STATUS_META: Record<SubtaskStatus, { label: string; color: string }> = {
  todo: { label: 'Cần làm', color: C.gray }, doing: { label: 'Đang làm', color: C.blue },
  done: { label: 'Xong', color: C.green }, cancelled: { label: 'Huỷ', color: C.gray },
};
const PRIORITY_META = { low: { label: 'Thấp', color: C.gray }, normal: { label: 'Thường', color: C.orange }, high: { label: 'Gấp', color: C.red } };

const SubtaskTab: React.FC<{
  subtasks: PmSubtask[]; setSubtasks: React.Dispatch<React.SetStateAction<PmSubtask[]>>;
  workers: PmWorker[]; tasks: PmTask[]; projectNames: string[]; workerName: (id: string | null) => string;
  onError: (m: string) => void; onOk: (m: string) => void;
}> = ({ subtasks, setSubtasks, workers, tasks, projectNames, workerName, onError, onOk }) => {
  const [editing, setEditing] = useState<Partial<PmSubtask> | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const shown = subtasks.filter(s => filter === 'all' || s.status === 'todo' || s.status === 'doing');

  const save = async () => {
    if (!editing?.title?.trim()) return onError('Nhập tên task');
    const payload = {
      title: editing.title.trim(), description: editing.description || null, project: editing.project || null,
      parent_task_id: editing.parent_task_id || null, assignee_worker_id: editing.assignee_worker_id || null,
      status: editing.status || 'todo', priority: editing.priority || 'normal', due_date: editing.due_date || null,
    } as Partial<PmSubtask>;
    setSaving(true);
    try {
      if (editing.id) {
        const u = await updateSubtask(editing.id, payload);
        setSubtasks(prev => prev.map(s => (s.id === u.id ? u : s)));
      } else {
        const c = await createSubtask(payload);
        setSubtasks(prev => [c, ...prev]);
      }
      setEditing(null); onOk('Đã lưu task phụ');
    } catch (e: any) { onError(e.message || 'Có lỗi xảy ra'); }
    finally { setSaving(false); }
  };
  const setStatus = async (s: PmSubtask, status: SubtaskStatus) => {
    try { const u = await updateSubtask(s.id, { status }); setSubtasks(prev => prev.map(x => (x.id === u.id ? u : x))); }
    catch (e: any) { onError(e.message || 'Có lỗi xảy ra'); }
  };
  const remove = async (s: PmSubtask) => {
    if (!window.confirm(`Xoá task phụ "${s.title}"?`)) return;
    try { await deleteSubtask(s.id); setSubtasks(prev => prev.filter(x => x.id !== s.id)); }
    catch (e: any) { onError(e.message || 'Có lỗi xảy ra'); }
  };

  const bg = { background: '#1a1a1a' };

  return (
    <div className="animate-fadeInUp">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <Heading title="Task phụ" sub="Việc tạo thêm trong app — ClickUp vẫn là nguồn task chính" />
        <div className="flex gap-2">
          <button onClick={() => setFilter(filter === 'open' ? 'all' : 'open')} className={btnGhost}>
            {filter === 'open' ? 'Xem tất cả' : 'Chỉ việc đang mở'}</button>
          <button onClick={() => setEditing({ status: 'todo', priority: 'normal' })} className={btnPrimary} style={{ background: '#FF9500' }}>+ Thêm task</button>
        </div>
      </div>

      {shown.length === 0 ? (
        <Empty emoji="📝" text="Chưa có task phụ" hint="Bấm “+ Thêm task” để tạo việc ngoài ClickUp" />
      ) : (
        <div className="space-y-3">
          {shown.map(s => (
            <div key={s.id} className={rowCard + ' justify-between'}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">{s.title}</span>
                  <Badge color={STATUS_META[s.status].color}>{STATUS_META[s.status].label}</Badge>
                  <Badge color={PRIORITY_META[s.priority].color}>{PRIORITY_META[s.priority].label}</Badge>
                  {isOverdue(s, s.status === 'done' || s.status === 'cancelled') && <Badge color={C.red}>Trễ hạn</Badge>}
                </div>
                <div className="text-xs text-neutral-medium mt-1">
                  {s.project || 'Không gắn dự án'} · {workerName(s.assignee_worker_id)} · Hạn {fmtDate(s.due_date)}
                  {s.parent_task_id && <> · ↳ {tasks.find(t => t.id === s.parent_task_id)?.title || 'task ClickUp'}</>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {s.status === 'todo' && <button onClick={() => setStatus(s, 'doing')} className={btnOutline}>Bắt đầu</button>}
                {s.status === 'doing' && <button onClick={() => setStatus(s, 'done')} className={btnOutline}>Xong</button>}
                <button onClick={() => setEditing(s)} className={btnXs}>Sửa</button>
                <button onClick={() => remove(s)} className={btnXs}>Xoá</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => !saving && setEditing(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-[20px] border border-primary/10 bg-surface p-6 space-y-4 animate-scaleIn">
            <h3 className="text-base font-black uppercase tracking-wider text-white">{editing.id ? 'Sửa task phụ' : 'Task phụ mới'}</h3>
            <Field label="Tên task *">
              <input className={input} style={bg} autoFocus value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} />
            </Field>
            <Field label="Mô tả">
              <textarea className={input + ' resize-none'} style={bg} rows={3} value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Dự án">
                <select className={input} style={bg} value={editing.project || ''} onChange={e => setEditing({ ...editing, project: e.target.value })}>
                  <option value="">— Không gắn —</option>{projectNames.map(p => <option key={p} value={p}>{p}</option>)}</select>
              </Field>
              <Field label="Người làm">
                <select className={input} style={bg} value={editing.assignee_worker_id || ''} onChange={e => setEditing({ ...editing, assignee_worker_id: e.target.value })}>
                  <option value="">— Chưa giao —</option>{workers.filter(w => w.is_active !== false).map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}</select>
              </Field>
              <Field label="Ưu tiên">
                <select className={input} style={bg} value={editing.priority || 'normal'} onChange={e => setEditing({ ...editing, priority: e.target.value as PmSubtask['priority'] })}>
                  {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
              </Field>
              <Field label="Trạng thái">
                <select className={input} style={bg} value={editing.status || 'todo'} onChange={e => setEditing({ ...editing, status: e.target.value as SubtaskStatus })}>
                  {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
              </Field>
              <Field label="Hạn chót">
                <input type="date" className={input} style={bg} value={editing.due_date || ''} onChange={e => setEditing({ ...editing, due_date: e.target.value })} />
              </Field>
              <Field label="Gắn task ClickUp">
                <select className={input} style={bg} value={editing.parent_task_id || ''} onChange={e => setEditing({ ...editing, parent_task_id: e.target.value })}>
                  <option value="">— Không gắn —</option>
                  {tasks.filter(t => !isDone(t) && (!editing.project || projectOf(t) === editing.project)).slice(0, 200)
                    .map(t => <option key={t.id} value={t.id}>{t.title.slice(0, 60)}</option>)}</select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} disabled={saving} className={btnGhost}>Huỷ</button>
              <button onClick={save} disabled={saving} className={btnPrimary} style={{ background: '#FF9500' }}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </div>
        </div>, document.body)}
    </div>
  );
};

export default ProjectsApp;
