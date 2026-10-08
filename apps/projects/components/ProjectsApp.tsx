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
import PmAssignments from './PmAssignments';
import HelpPanel from '@/components/HelpPanel';
import { PROJECTS_HELP } from '../helpContent';
import { PeopleGrid, PersonDetail, PeopleTable } from './PeopleView';
import { useWorkspace, matchesWorkspace } from '@/services/WorkspaceContext';
import {
  PmTask, PmWorker, PmStatusLog, PmSubtask, SubtaskStatus,
  fetchPmData, fetchSubtasks, createSubtask, updateSubtask, deleteSubtask,
  fetchTaskTime, PmTaskTime, STUCK_HOURS, hoursSince, ESTIMATE_REQUIRED_FROM,
  isDone, isFix, isOverdue, projectOf, norm, todayISO, statusLabel, clickupUrl,
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
const Kpi: React.FC<{ label: string; value: React.ReactNode; color?: string; hint?: string; onClick?: () => void }> = ({ label, value, color, hint, onClick }) => (
  <div className={kpiCard + (onClick ? ' cursor-pointer hover:border-primary/30 transition-all' : '')} onClick={onClick} role={onClick ? 'button' : undefined}>
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
/** Dòng task trong các danh sách cảnh báo: bấm mở drawer; nút "Bỏ qua" ẩn task chết khỏi cảnh báo. */
const TaskRow: React.FC<{ t: PmTask; sub: string; badges: React.ReactNode; onOpen: () => void; onHide: () => void; hidden: boolean }> =
  ({ t, sub, badges, onOpen, onHide, hidden }) => (
  <div onClick={onOpen} className={'group flex items-start justify-between gap-3 cursor-pointer rounded-xl px-2 py-2 hover:bg-white/5 transition-colors' + (hidden ? ' opacity-50' : '')}>
    {/* Tên task dòng riêng (trước bị badge + nút chiếm chỗ ⇒ cắt còn "[2D Modeling] [C…") */}
    <div className="min-w-0 flex-1">
      <div className="text-sm font-semibold text-white truncate" title={t.title}>{t.title}</div>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <span className="text-xs text-neutral-medium truncate max-w-full">{sub}</span>
        {badges}
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0 pt-0.5">
      {clickupUrl(t) && (
        <a href={clickupUrl(t)!} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Mở trên ClickUp"
          className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-all">ClickUp ↗</a>
      )}
      <button onClick={(e) => { e.stopPropagation(); onHide(); }} title={hidden ? 'Hiện lại trong cảnh báo' : 'Bỏ qua — ẩn khỏi cảnh báo (task chết / không theo dõi)'}
        className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-500 border border-white/10 hover:text-white hover:border-white/20 transition-all md:opacity-0 md:group-hover:opacity-100">
        {hidden ? 'Hiện' : 'Bỏ qua'}</button>
    </div>
  </div>
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
  const [person, setPerson] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [peopleRange, setPeopleRange] = useState<'month' | 'quarter' | 'year' | 'all'>('month');
  const [projFilter, setProjFilter] = useState<'running' | 'done' | 'all'>('running');
  const [projQuery, setProjQuery] = useState('');
  const [peopleView, setPeopleView] = useState<'cards' | 'table'>('cards');
  const [showIdlePeople, setShowIdlePeople] = useState(false);
  const [projDetail, setProjDetail] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Gọi song song (trước gọi lần lượt 5 truy vấn ⇒ "Đang tải..." lâu).
      const [d, subs, tt, cats, hid] = await Promise.all([
        fetchPmData(), fetchSubtasks(), fetchTaskTime(),
        supabase.from('wf_status_categories').select('status, category'),
        supabase.from('pm_task_hidden').select('task_id'),
      ]);
      setTasks(d.tasks); setAssignees(d.assignees); setWorkers(d.workers); setLogs(d.logs);
      setSubtasks(subs); setTimes(tt);
      setStatusCat(Object.fromEntries((cats.data || []).map((c: any) => [c.status, c.category])));
      setHidden(new Set((hid.data || []).map((h: any) => h.task_id)));
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
  const deliveredOn = (t: PmTask) => { const f = firstReview.get(t.id); return f ? vnDate(f) : (isDone(t) ? (t.completed_at || t.closed_date || null) : null); };
  const open = wsTasks.filter(t => !isDone(t));
  const catOf = (t: PmTask) => statusCat[norm(t.clickup_status)] || 'unknown';
  const activeOpen = open.filter(t => catOf(t) === 'active');
  // client_review nằm trong DONE_STATUSES (đã giao khách) ⇒ không thuộc `open`; đếm theo nhóm trạng thái.
  const waitingOpen = wsTasks.filter(t => catOf(t) === 'waiting_client');
  const notStarted = open.filter(t => catOf(t) === 'not_started');
  const pausedTasks = wsTasks.filter(t => catOf(t) === 'paused');
  // Sắp đến hạn: chưa xong, hạn trong 3 ngày tới (hôm nay → +3). Chưa bắt đầu/tạm dừng ⇒ rủi ro cao.
  const in3 = (() => { const d = new Date(todayISO() + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 3); return d.toISOString().slice(0, 10); })();
  const upcoming = open.filter(t => t.due_date && t.due_date >= todayISO() && t.due_date <= in3 && !hidden.has(t.id))
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const visible = (t: PmTask) => showHidden || !hidden.has(t.id);
  const overdue = open.filter(t => isOverdue(t, false) && visible(t));
  const hiddenCount = wsTasks.filter(t => hidden.has(t.id) && !isDone(t)).length;
  const toggleHide = async (taskId: string) => {
    try {
      if (hidden.has(taskId)) {
        const { error } = await supabase.from('pm_task_hidden').delete().eq('task_id', taskId); if (error) throw error;
        setHidden(prev => { const n = new Set(prev); n.delete(taskId); return n; });
        setToast({ message: 'Đã hiện lại task', type: 'success' });
      } else {
        const { error } = await supabase.from('pm_task_hidden').insert({ task_id: taskId }); if (error) throw error;
        setHidden(prev => new Set(prev).add(taskId));
        setToast({ message: 'Đã bỏ qua task (vào "Hiện task đã bỏ qua" để xem lại)', type: 'success' });
      }
    } catch (e: any) { setToast({ message: e.message || 'Có lỗi xảy ra', type: 'error' }); }
  };
  const fixing = open.filter(isFix);
  const monthPrefix = todayISO().slice(0, 7);
  const doneThisMonth = wsTasks.filter(t => isDone(t) && (t.completed_at || t.closed_date || t.clickup_updated_at || '').startsWith(monthPrefix));
  const withDue = wsTasks.filter(t => t.due_date).length;
  // Task đang làm (task mới từ mốc chuẩn hoá) mà chưa nhập Time Estimate trên ClickUp.
  const noEstimate = wsTasks.filter(t => !isDone(t) && statusCat[norm(t.clickup_status)] === 'active'
    && t.time_estimate_hours == null && (t.start_date || '') >= ESTIMATE_REQUIRED_FROM && visible(t));
  // Task đứng: trạng thái hiện tại kéo dài quá ngưỡng (1 dòng / task dù nhiều người làm).
  const stuck = useMemo(() => {
    const seen = new Set<string>(); const out: { t: PmTask; x: PmTaskTime; h: number; cat: string }[] = [];
    times.forEach(x => {
      if (seen.has(x.task_id)) return; seen.add(x.task_id);
      const cat = statusCat[x.current_status || '']; const lim = STUCK_HOURS[cat]; const h = hoursSince(x.current_status_since);
      const t = wsTasks.find(tt => tt.id === x.task_id);
      if (t && lim && h > lim && visible(t)) out.push({ t, x, h, cat });
    });
    return out.sort((a, b) => b.h - a.h);
  }, [times, statusCat, wsTasks, hidden, showHidden]);
  const stuckTeam = stuck.filter(s => s.cat === 'active');
  // Năng lực team: số task ĐANG LÀM (nhóm active) mỗi người — ai rảnh để giao việc, ai quá tải.
  // Chỉ người có ít nhất 1 task chưa xong hoặc xong trong 30 ngày (bỏ tk test / người không làm dự án).
  const capacity = (() => {
    const since = (() => { const d = new Date(todayISO() + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 30); return d.toISOString().slice(0, 10); })();
    return wsWorkers.filter(w => w.is_active !== false).map(w => {
      const ts = wsTasks.filter(t => (workersOfTask.get(t.id) || []).includes(w.id));
      const recent = ts.some(t => !isDone(t) || (deliveredOn(t) || '') >= since);
      return { w, active: ts.filter(t => !isDone(t) && catOf(t) === 'active').length, recent };
    }).filter(x => x.recent).sort((a, b) => b.active - a.active);
  })();
  const stuckClient = stuck.filter(s => s.cat === 'waiting_client');

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
        // Hạn gần nhất của task CÒN MỞ (trước lấy hạn muộn nhất ⇒ hiện ngày đã qua từ lâu).
        nextDue: (ts.filter(t => !isDone(t) && t.due_date).map(t => t.due_date!).sort()[0]) || null,
        people: [...new Set(ts.filter(t => !isDone(t)).flatMap(t => workersOfTask.get(t.id) || []))],
      };
    }).sort((a, b) => (b.total - b.done) - (a.total - a.done));
  }, [wsTasks, workersOfTask]);
  const shownProjects = projects.filter(p =>
    (projFilter === 'all' || (projFilter === 'done' ? p.pct === 100 : p.pct < 100))
    && (!projQuery.trim() || (p.name + ' ' + p.space).toLowerCase().includes(projQuery.trim().toLowerCase())));

  // ── Nhân sự ──
  const rangeFrom = (() => {
    const t = todayISO(); const [y, m] = t.split('-').map(Number);
    if (peopleRange === 'month') return `${y}-${String(m).padStart(2, '0')}-01`;
    if (peopleRange === 'quarter') return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
    if (peopleRange === 'year') return `${y}-01-01`;
    return '0000-01-01';
  })();
  const inRange = (t: PmTask) => { const d = deliveredOn(t); return !!d && d >= rangeFrom; };
  const people = useMemo(() => wsWorkers.filter(w => w.is_active !== false).map(w => {
    const ts = wsTasks.filter(t => (workersOfTask.get(t.id) || []).includes(w.id));
    // Số liệu "đã làm" theo kỳ đang chọn (cùng 1 khung thời gian); "đang làm/trễ" là hiện tại.
    const done = ts.filter(t => inRange(t));
    // Đúng hạn = giao khách lần đầu ≤ hạn chót (trước đây so ngày ĐÓNG task ⇒ thấp oan vì chờ khách duyệt).
    const delivered = ts.filter(t => t.due_date && inRange(t));
    const onTime = delivered.filter(t => { const d = deliveredOn(t); return d && d <= t.due_date!; }).length;
    const doneWithDue = delivered.length;
    // Khối lượng: task đang ở trạng thái "đang làm" (không tính chờ khách / chưa bắt đầu).
    const activeNow = ts.filter(t => !isDone(t) && statusCat[norm(t.clickup_status)] === 'active').length;
    const subs = subtasks.filter(s => s.assignee_worker_id === w.id);
    return {
      w, total: ts.length, done: done.length, activeNow,
      doing: ts.filter(t => !isDone(t)).length, // hiện tại, KHÔNG theo kỳ (done đã lọc theo kỳ)
      overdue: ts.filter(t => isOverdue(t, isDone(t))).length + subs.filter(s => isOverdue(s, s.status === 'done' || s.status === 'cancelled')).length,
      fix: ts.filter(t => inRange(t)).reduce((n, t) => n + (fixCount.get(t.id) || 0), 0),
      onTimePct: doneWithDue ? Math.round((onTime / doneWithDue) * 100) : null, onTimeN: doneWithDue,
      subOpen: subs.filter(s => s.status === 'todo' || s.status === 'doing').length,
      // Giờ làm: fulltime = giao giờ chấm công; freelancer = giờ đồng hồ (tương đối).
      hours: (() => {
        const mine = times.filter(x => x.worker_id === w.id && x.first_client_review_at && vnDate(x.first_client_review_at) >= rangeFrom);
        const delivered = mine;
        const sum = mine.reduce((n, x) => n + x.active_hours, 0);
        // So ước lượng: task đã giao có estimate; estimate chia đều cho số người làm task.
        let estSum = 0, actSum = 0;
        delivered.forEach(x => {
          const t = tasks.find(tt => tt.id === x.task_id); const est = Number(t?.time_estimate_hours || 0);
          if (est > 0) { estSum += est / Math.max(1, (workersOfTask.get(x.task_id) || []).length); actSum += x.active_hours; }
        });
        return { estPct: estSum > 0 ? Math.round(actSum / estSum * 100) : null,
                 total: sum, avg: delivered.length ? delivered.reduce((n, x) => n + x.active_hours, 0) / delivered.length : null,
                 firstPass: delivered.length ? Math.round(delivered.filter(x => x.fix_rounds === 0).length / delivered.length * 100) : null,
                 fulltime: mine.some(x => x.is_fulltime), n: delivered.length };
      })(),
    };
  }).sort((a, b) => b.done - a.done), [wsWorkers, wsTasks, workersOfTask, subtasks, fixCount, times, firstReview, statusCat, rangeFrom]);

  const ready = !(loading && tasks.length === 0);
  const openList = (title: string, list: PmTask[]) => setDrawer({ kind: 'list', title: `${title} (${list.length})`, ids: list.map(t => t.id) });
  const workerName = (id: string | null) => workers.find(w => w.id === id)?.full_name || '—';
  const accessibleTabs: TabId[] = isAdmin ? ['overview', 'reports', 'history', 'dashboard', 'recurring', 'activity'] : ['overview', 'reports', 'history', 'dashboard', 'recurring'];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />
      {toast && <ToastNotification message={{ text: toast.message, type: toast.type }} onDismiss={() => setToast(null)} />}
      <Navbar
        theme="dark" currentUser={currentUser} appName="Dự án"
        activeTab={tab as any} accessibleTabs={accessibleTabs as any} tabLabels={TAB_LABELS}
        onTabChange={(t) => setTab(t as TabId)} onLogout={onBack} onBack={onBack} onHelp={() => setHelpOpen(true)}
      />
      <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full">
        {/* Lần tải đầu: khung xám thay vì số 0 / "Không có task ✅" (dễ hiểu nhầm là số thật). */}
        {!ready && (
          <div className="space-y-6" aria-busy="true">
            <div className="h-10 w-64 rounded-xl bg-white/5 animate-td-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">{[0, 1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-[20px] bg-surface border border-primary/10 animate-td-pulse" />)}</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{[0, 1].map(i => <div key={i} className="h-64 rounded-[20px] bg-surface border border-primary/10 animate-td-pulse" />)}</div>
          </div>
        )}

        {ready && tab === 'overview' && (
          <div className="animate-fadeInUp">
            <Heading title="Tổng quan" sub="Tiến độ công việc toàn công ty (ClickUp + task phụ)" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-6">
              <Kpi onClick={() => openList('Đang làm', activeOpen)} label="Đang làm" value={activeOpen.length} color={C.orange} hint={fixing.length ? `trong đó ${fixing.length} task đang sửa` : 'Team đang thực hiện'} />
              <Kpi onClick={() => openList('Chờ khách', waitingOpen)} label="Chờ khách" value={waitingOpen.length} color={C.blue} hint={pausedTasks.length ? `+ ${pausedTasks.length} task tạm dừng` : 'Đã gửi khách, chờ duyệt'} />
              <Kpi onClick={() => openList('Chưa bắt đầu', notStarted)} label="Chưa bắt đầu" value={notStarted.length} color={C.gray} hint="Task mới, chưa ai nhận" />
              <Kpi onClick={() => openList('Trễ hạn', overdue)} label="Trễ hạn" value={overdue.length} color={C.red} hint={withDue ? undefined : 'Chưa có task nào có hạn chót'} />
              <Kpi onClick={() => openList('Xong tháng này', doneThisMonth)} label="Xong tháng này" value={doneThisMonth.length} color={C.green} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-start">
              <div className={card}>
                <div className="text-base font-black uppercase tracking-wider text-white mb-1">Đến hạn 3 ngày tới <span className="text-neutral-600">({upcoming.length})</span></div>
                <p className="text-xs text-neutral-medium mb-4">Việc phải giao sớm — nhãn đỏ = chưa bắt đầu hoặc đang tạm dừng</p>
                {upcoming.length === 0 ? <p className="text-sm text-neutral-600 py-4 text-center">Không có task nào sắp đến hạn ✅</p> : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {upcoming.map(t => {
                      const risky = ['not_started', 'paused'].includes(catOf(t));
                      return (
                        <TaskRow key={t.id} t={t} onOpen={() => setDrawer({ kind: 'task', taskId: t.id })} onHide={() => toggleHide(t.id)} hidden={hidden.has(t.id)}
                          sub={`${projectOf(t)} · ${(workersOfTask.get(t.id) || []).map(workerName).join(', ') || 'Chưa giao'}`}
                          badges={<><Badge color={risky ? C.red : C.orange}>{statusLabel(t.clickup_status)}</Badge>
                            <Badge color={t.due_date === todayISO() ? C.red : C.amber}>{t.due_date === todayISO() ? 'Hôm nay' : fmtDate(t.due_date)}</Badge></>} />
                      );
                    })}
                  </div>
                )}
              </div>
              <div className={card}>
                <div className="text-base font-black uppercase tracking-wider text-white mb-1">Năng lực team</div>
                <p className="text-xs text-neutral-medium mb-4">Số task đang làm mỗi người — bấm tên để xem chi tiết</p>
                {[{ k: 'free', title: 'Rảnh — có thể giao việc', color: C.green, list: capacity.filter(x => x.active === 0) },
                  { k: 'ok', title: 'Vừa sức (1–3 task)', color: C.blue, list: capacity.filter(x => x.active >= 1 && x.active <= 3) },
                  { k: 'busy', title: 'Quá tải (4+ task)', color: C.red, list: capacity.filter(x => x.active >= 4) }].map(g => (
                  <div key={g.k} className="mb-4 last:mb-0">
                    <div className={kpiLabel + ' mb-2 flex items-center gap-2'}><span className="w-1.5 h-1.5 rounded-full" style={{ background: g.color }} />{g.title} ({g.list.length})</div>
                    {g.list.length === 0 ? <span className="text-xs text-neutral-600">—</span> : (
                      <div className="flex flex-wrap gap-2">
                        {g.list.map(x => (
                          <button key={x.w.id} onClick={() => { setTab('history'); setPerson(x.w.id); }}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-white/10 text-neutral-300 hover:text-white hover:border-white/20 transition-all">
                            {x.w.full_name}{x.active ? ` · ${x.active}` : ''}</button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-start">
              {[{ title: 'Team đang kẹt', sub: `Ở trạng thái đang làm quá ${STUCK_HOURS.active}h — cần PM hỗ trợ`, list: stuckTeam, color: C.amber },
                { title: 'Chờ khách lâu', sub: `Chờ khách quá ${STUCK_HOURS.waiting_client / 24} ngày — cần nhắc khách`, list: stuckClient, color: C.blue }].map(g => (
                <div key={g.title} className={card}>
                  <div className="text-base font-black uppercase tracking-wider text-white mb-1">{g.title} <span className="text-neutral-600">({g.list.length})</span></div>
                  <p className="text-xs text-neutral-medium mb-4">{g.sub}</p>
                  {g.list.length === 0 ? <p className="text-sm text-neutral-600 py-4 text-center">Không có task nào ✅</p> : (
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {g.list.map(({ t, x, h }) => (
                        <TaskRow key={t.id} t={t} onOpen={() => setDrawer({ kind: 'task', taskId: t.id })} onHide={() => toggleHide(t.id)} hidden={hidden.has(t.id)}
                          sub={`${projectOf(t)} · ${(workersOfTask.get(t.id) || []).map(workerName).join(', ')}`}
                          badges={<><Badge color={g.color}>{statusLabel(x.current_status)}</Badge><Badge color={C.red}>{Math.floor(h / 24)} ngày</Badge></>} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {noEstimate.length > 0 && (
              <div className={card + ' mb-6'}>
                <div className="text-base font-black uppercase tracking-wider text-white mb-1">Task đang làm chưa có ước lượng</div>
                <p className="text-xs text-neutral-medium mb-4">Nhập Time Estimate trên ClickUp (task tạo từ {fmtDate(ESTIMATE_REQUIRED_FROM)}) — app tự cập nhật mỗi giờ</p>
                <div className="space-y-3">
                  {noEstimate.slice(0, 20).map(t => (
                    <div key={t.id} onClick={() => setDrawer({ kind: 'task', taskId: t.id })} className="flex items-center justify-between gap-3 cursor-pointer rounded-xl -mx-2 px-2 py-1 hover:bg-white/5 transition-colors">
                      <div className="min-w-0"><div className="text-sm font-semibold text-white truncate">{t.title}</div>
                        <div className="text-xs text-neutral-medium">{projectOf(t)} · {(workersOfTask.get(t.id) || []).map(workerName).join(', ')}</div></div>
                      <Badge color={C.amber}>{statusLabel(t.clickup_status)}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className={card}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="text-base font-black uppercase tracking-wider text-white">Task trễ hạn <span className="text-neutral-600">({overdue.length})</span></div>
                {hiddenCount > 0 && <button onClick={() => setShowHidden(!showHidden)} className={btnXs}>{showHidden ? 'Ẩn task đã bỏ qua' : `Hiện ${hiddenCount} task đã bỏ qua`}</button>}
              </div>
              {overdue.length === 0 ? <Empty emoji="✅" text="Không có task trễ hạn" /> : (
                <div className="space-y-3">
                  {overdue.map(t => (
                    <TaskRow key={t.id} t={t} onOpen={() => setDrawer({ kind: 'task', taskId: t.id })} onHide={() => toggleHide(t.id)} hidden={hidden.has(t.id)}
                      sub={`${projectOf(t)} · ${(workersOfTask.get(t.id) || []).map(workerName).join(', ')}`}
                      badges={<Badge color={C.red}>Hạn {fmtDate(t.due_date)}</Badge>} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {ready && tab === 'reports' && projDetail && (() => {
          const pts = wsTasks.filter(t => projectOf(t) === projDetail);
          const ids = new Set(pts.map(t => t.id));
          // Gộp giờ theo task (task nhiều người ⇒ cộng giờ, FIX lấy max) để biểu đồ/KPI tính theo task.
          const agg = new Map<string, PmTaskTime>();
          times.filter(x => ids.has(x.task_id)).forEach(x => {
            const c = agg.get(x.task_id);
            agg.set(x.task_id, c ? { ...c, active_hours: c.active_hours + x.active_hours, fix_rounds: Math.max(c.fix_rounds, x.fix_rounds),
              waiting_client_hours: Math.max(c.waiting_client_hours, x.waiting_client_hours) } : { ...x });
          });
          const done = pts.filter(isDone).length;
          const waitAvg = [...agg.values()].filter(x => x.first_client_review_at);
          const contrib = [...new Set(pts.flatMap(t => workersOfTask.get(t.id) || []))].map(wid => {
            const mine = pts.filter(t => (workersOfTask.get(t.id) || []).includes(wid));
            const tt = times.filter(x => x.worker_id === wid && ids.has(x.task_id));
            return { wid, done: mine.filter(isDone).length, open: mine.filter(t => !isDone(t)).length,
              hours: tt.reduce((n, x) => n + x.active_hours, 0), fix: tt.reduce((n, x) => n + x.fix_rounds, 0) };
          }).sort((a, b) => b.done - a.done);
          return (
            <PersonDetail tasks={pts} times={[...agg.values()]} deliveredOn={deliveredOn}
              onBack={() => setProjDetail(null)} onOpenTask={(id) => setDrawer({ kind: 'task', taskId: id })}
              heading={{ title: projDetail, avatar: '📁', back: 'Tất cả dự án',
                sub: `${pts[0]?.clickup_space_name || '—'} · ${done}/${pts.length} task xong (${pts.length ? Math.round(done / pts.length * 100) : 0}%)`
                  + (waitAvg.length ? ` · chờ khách TB ${fmtH(waitAvg.reduce((n, x) => n + x.waiting_client_hours, 0) / waitAvg.length)}/task` : '') }}
              extra={
                <div className={card}>
                  <div className="text-base font-black uppercase tracking-wider text-white mb-4">Ai làm bao nhiêu</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[520px]">
                      <thead><tr className={kpiLabel + ' text-left border-b border-white/5'}>
                        <th className="py-2">Nhân sự</th><th className="text-right">Đã xong</th><th className="text-right">Đang mở</th>
                        <th className="text-right">Giờ làm</th><th className="text-right">Lần sửa</th></tr></thead>
                      <tbody>
                        {contrib.map(c => (
                          <tr key={c.wid} className={tr + ' cursor-pointer'} onClick={() => { setProjDetail(null); setTab('history'); setPerson(c.wid); }}>
                            <td className="py-3 text-sm font-semibold text-white">{workerName(c.wid)}</td>
                            <td className="text-right text-white font-semibold">{c.done}</td>
                            <td className="text-right text-neutral-300">{c.open}</td>
                            <td className="text-right text-neutral-300">{c.hours ? fmtH(c.hours) : '—'}</td>
                            <td className="text-right">{c.fix ? <Badge color={C.amber}>{c.fix}</Badge> : <span className="text-neutral-600">0</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              } />
          );
        })()}
        {ready && tab === 'reports' && !projDetail && (
          <div className="animate-fadeInUp">
            <Heading title="Dự án" sub="Tiến độ theo dự án (folder ClickUp) — bấm 1 dự án để xem chi tiết theo ngày / tuần / tháng / quý / năm" />
            <div className="flex flex-wrap items-center gap-2 mb-6">
              {([['running', 'Đang chạy'], ['done', 'Hoàn thành'], ['all', 'Tất cả']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setProjFilter(k)} className={projFilter === k ? btnPrimary : btnGhost} style={projFilter === k ? { background: '#FF9500' } : {}}>
                  {l} ({projects.filter(p => k === 'all' || (k === 'done' ? p.pct === 100 : p.pct < 100)).length})</button>
              ))}
              <input value={projQuery} onChange={e => setProjQuery(e.target.value)} placeholder="Tìm dự án / khách..."
                className={input + ' md:w-64 md:ml-auto'} style={{ background: '#1a1a1a' }} />
            </div>
            {shownProjects.length === 0 && !loading ? <Empty emoji="📁" text="Không có dự án phù hợp" /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {shownProjects.map(p => {
                  const R = 26, L = 2 * Math.PI * R;
                  return (
                    <button key={p.name} onClick={() => setProjDetail(p.name)}
                      className="text-left rounded-[20px] border border-primary/10 hover:border-primary/30 transition-all bg-surface p-5 h-full flex flex-col">
                      <div className="flex items-center gap-4">
                        <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0" aria-label={`Tiến độ ${p.pct}%`}>
                          <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                          {p.pct > 0 && <circle cx="32" cy="32" r={R} fill="none" stroke="#FF9500" strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={`${(p.pct / 100) * L} ${L}`} transform="rotate(-90 32 32)" />}
                          <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="900" fill="#F2F2F2">{p.pct}%</text>
                        </svg>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-white truncate">{p.name}</div>
                          <div className="text-xs text-neutral-medium truncate">{p.space || '—'}</div>
                        </div>
                        <span className="text-primary/70 text-[15px] font-black">›</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-5">
                        <div><div className={kpiLabel}>Task</div><div className="text-2xl font-black text-white">{p.done}<span className="text-sm text-neutral-600">/{p.total}</span></div></div>
                        <div><div className={kpiLabel}>Còn lại</div><div className="text-2xl font-black text-white">{p.total - p.done}</div></div>
                        <div><div className={kpiLabel}>Hạn gần nhất</div><div className={'text-sm font-semibold mt-2 ' + (p.nextDue && p.nextDue < todayISO() ? 'text-status-error' : 'text-white')}>{p.nextDue ? fmtDate(p.nextDue) : '—'}</div></div>
                      </div>
                      {/* Vùng đáy cố định (mt-auto + min-h) ⇒ thẻ có/không badge vẫn thẳng hàng */}
                      <div className="flex items-center justify-between gap-2 mt-auto pt-4 min-h-[44px]">
                        <div className="flex flex-wrap gap-2">
                          {p.overdue > 0 && <Badge color={C.red}>{p.overdue} trễ hạn</Badge>}
                          {p.fix > 0 && <Badge color={C.amber}>{p.fix} đang sửa</Badge>}
                        </div>
                        <div className="flex -space-x-2 shrink-0" title={p.people.map(workerName).join(', ')}>
                          {p.people.slice(0, 4).map(id => (
                            <span key={id} className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[9px] font-black text-primary"
                              style={{ background: '#2a2a2a', borderColor: '#1A1A1A' }}>
                              {workerName(id).trim().split(/\s+/).slice(-1)[0]?.[0] || '?'}</span>
                          ))}
                          {p.people.length > 4 && <span className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[9px] font-black text-neutral-300" style={{ background: '#2a2a2a', borderColor: '#1A1A1A' }}>+{p.people.length - 4}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {ready && tab === 'history' && (() => {
          const sp = person ? people.find(x => x.w.id === person) : null;
          if (sp) return (
            <PersonDetail stats={sp} tasks={wsTasks.filter(t => (workersOfTask.get(t.id) || []).includes(sp.w.id))}
              times={times.filter(x => x.worker_id === sp.w.id)} deliveredOn={deliveredOn}
              onBack={() => setPerson(null)} onOpenTask={(id) => setDrawer({ kind: 'task', taskId: id })} />
          );
          return (
            <div className="animate-fadeInUp">
              <Heading title="Nhân sự" sub="Fulltime + freelancer — bấm 1 người để xem hiệu suất theo ngày / tuần / tháng / quý / năm" />
              <div className="flex flex-wrap gap-2 mb-6">
                {([['month', 'Tháng này'], ['quarter', 'Quý này'], ['year', 'Năm nay'], ['all', 'Tất cả']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setPeopleRange(k)} className={peopleRange === k ? btnPrimary : btnGhost} style={peopleRange === k ? { background: '#FF9500' } : {}}>{l}</button>
                ))}
                <div className="flex gap-2 md:ml-auto md:order-last">
                  <button onClick={() => setPeopleView('cards')} className={peopleView === 'cards' ? btnOutline : btnXs}>Thẻ</button>
                  <button onClick={() => setPeopleView('table')} className={peopleView === 'table' ? btnOutline : btnXs}>Bảng so sánh</button>
                </div>
                <span className="text-xs text-neutral-medium self-center ml-2">Số liệu tính trong kỳ đã chọn · "Đang làm" là hiện tại</span>
              </div>
              {(() => {
                // Ẩn người không có việc trong kỳ & không có task đang mở (tk test, người không làm dự án).
                const shown = showIdlePeople ? people : people.filter(p => p.done > 0 || p.doing > 0);
                const hiddenN = people.length - shown.length;
                return (<>
                  {peopleView === 'table'
                    ? <PeopleTable people={shown} onOpen={setPerson} />
                    : <PeopleGrid people={[...shown].sort((a, b) => b.done - a.done || b.activeNow - a.activeNow)} onOpen={setPerson} />}
                  {hiddenN > 0 && <button onClick={() => setShowIdlePeople(!showIdlePeople)} className={btnXs + ' mt-4'}>
                    {showIdlePeople ? 'Ẩn người không có việc' : `Hiện thêm ${hiddenN} người không có việc trong kỳ`}</button>}
                </>);
              })()}
              <p className="text-xs text-neutral-medium mt-6">Không rõ chỉ số nào? Bấm nút <strong>?</strong> trên thanh menu để xem giải thích.</p>
            </div>
          );
        })()}

        {ready && tab === 'dashboard' && (
          <MetricsTab tasks={wsTasks} times={times} logs={logs} statusCat={statusCat} isAdmin={isAdmin} deliveredOn={deliveredOn}
            onCatsSaved={load} onError={(m) => setToast({ message: m, type: 'error' })} onOk={(m) => setToast({ message: m, type: 'success' })} />
        )}
        {ready && tab === 'dashboard' && isAdmin && (
          <div className="mt-6">
            <PmAssignments projectNames={projects.map(p => p.name)}
              onError={(m) => setToast({ message: m, type: 'error' })} onOk={(m) => setToast({ message: m, type: 'success' })} />
          </div>
        )}

        {/* Tab Task phụ — từng bị xoá nhầm ở 4567a94 (cắt khối history→dashboard bằng index). */}
        {tab === 'recurring' && (
          <SubtaskTab subtasks={subtasks} setSubtasks={setSubtasks} workers={wsWorkers} tasks={wsTasks}
            projectNames={projects.map(p => p.name)} workerName={workerName}
            onError={(m) => setToast({ message: m, type: 'error' })} onOk={(m) => setToast({ message: m, type: 'success' })} />
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
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} appName="Dự án" appIcon="📊" contents={PROJECTS_HELP} activeTabId={tab} />
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
