import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AppBackground from '@/components/AppBackground';
import { Navbar } from '@/components/Navbar';
import { ToastNotification } from '@/components/ToastNotification';
import { AccountUser } from '@/types';
import { hasRole } from '@/utils/roleUtils';
import { useWorkspace, matchesWorkspace } from '@/services/WorkspaceContext';
import {
  PmTask, PmWorker, PmStatusLog, PmSubtask, SubtaskStatus,
  fetchPmData, fetchSubtasks, createSubtask, updateSubtask, deleteSubtask,
  isDone, isFix, isOverdue, projectOf, norm, todayISO,
} from '../services/projectService';

// Navbar chỉ nhận các id tab cố định ⇒ map id → nhãn của app này.
type TabId = 'overview' | 'reports' | 'history' | 'recurring' | 'activity';
const TAB_LABELS: Record<string, string> = {
  overview: 'Tổng quan', reports: 'Dự án', history: 'Nhân sự', recurring: 'Task phụ', activity: 'Tài chính',
};
const HASH_TAB: Record<string, TabId> = {
  overview: 'overview', projects: 'reports', people: 'history', subtasks: 'recurring', finance: 'activity',
};

const card = 'rounded-[20px] border border-primary/10 bg-surface p-5';
const kpiLabel = 'text-[10px] font-black text-neutral-600 uppercase tracking-wider';
const input = 'w-full rounded-xl border border-white/10 outline-none focus:border-orange-500/50 px-3 py-2 text-sm text-white';
const Badge: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg" style={{ background: color + '20', color }}>{children}</span>
);
const Kpi: React.FC<{ label: string; value: React.ReactNode; color?: string; hint?: string }> = ({ label, value, color, hint }) => (
  <div className={card}>
    <div className={kpiLabel}>{label}</div>
    <div className="text-2xl font-black mt-1" style={{ color: color || '#fff' }}>{value}</div>
    {hint && <div className="text-[11px] text-neutral-500 mt-1">{hint}</div>}
  </div>
);
const Heading: React.FC<{ title: string; sub: string }> = ({ title, sub }) => (
  <div className="mb-6">
    <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>{title}</h1>
    <p className="text-sm text-neutral-medium">{sub}</p>
  </div>
);
const fmtDate = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');

interface Props { currentUser: AccountUser; onBack: () => void; initialTab?: string | null; }

const ProjectsApp: React.FC<Props> = ({ currentUser, onBack, initialTab }) => {
  const isAdmin = hasRole(currentUser, 'admin');
  const { workspace } = useWorkspace();
  const [tab, setTab] = useState<TabId>(HASH_TAB[initialTab || ''] || 'overview');
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [assignees, setAssignees] = useState<{ task_id: string; worker_id: string }[]>([]);
  const [workers, setWorkers] = useState<PmWorker[]>([]);
  const [logs, setLogs] = useState<PmStatusLog[]>([]);
  const [subtasks, setSubtasks] = useState<PmSubtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchPmData();
      setTasks(d.tasks); setAssignees(d.assignees); setWorkers(d.workers); setLogs(d.logs);
      setSubtasks(await fetchSubtasks());
    } catch (e: any) { setToast({ text: e.message || 'Lỗi tải dữ liệu', type: 'error' }); }
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

  const open = wsTasks.filter(t => !isDone(t));
  const overdue = open.filter(t => isOverdue(t, false));
  const fixing = open.filter(isFix);
  const monthPrefix = todayISO().slice(0, 7);
  const doneThisMonth = wsTasks.filter(t => isDone(t) && (t.completed_at || t.closed_date || t.clickup_updated_at || '').startsWith(monthPrefix));
  const withDue = wsTasks.filter(t => t.due_date).length;

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
    const onTime = done.filter(t => t.due_date && (t.completed_at || t.closed_date || '') <= t.due_date).length;
    const doneWithDue = done.filter(t => t.due_date).length;
    const subs = subtasks.filter(s => s.assignee_worker_id === w.id);
    return {
      w, total: ts.length, done: done.length,
      doing: ts.length - done.length,
      overdue: ts.filter(t => isOverdue(t, isDone(t))).length + subs.filter(s => isOverdue(s, s.status === 'done' || s.status === 'cancelled')).length,
      fix: ts.reduce((n, t) => n + (fixCount.get(t.id) || 0), 0),
      onTimePct: doneWithDue ? Math.round((onTime / doneWithDue) * 100) : null,
      subOpen: subs.filter(s => s.status === 'todo' || s.status === 'doing').length,
    };
  }).sort((a, b) => b.done - a.done), [wsWorkers, wsTasks, workersOfTask, subtasks, fixCount]);

  const workerName = (id: string | null) => workers.find(w => w.id === id)?.full_name || '—';
  const accessibleTabs: TabId[] = isAdmin ? ['overview', 'reports', 'history', 'recurring', 'activity'] : ['overview', 'reports', 'history', 'recurring'];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />
      {toast && <ToastNotification message={toast} onDismiss={() => setToast(null)} />}
      <Navbar
        theme="dark" currentUser={currentUser} appName="Dự án"
        activeTab={tab as any} accessibleTabs={accessibleTabs as any} tabLabels={TAB_LABELS}
        onTabChange={(t) => setTab(t as TabId)} onLogout={onBack} onBack={onBack}
      />
      <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full">
        {loading && <div className="text-sm text-neutral-500 mb-4">Đang tải…</div>}

        {tab === 'overview' && (
          <div className="animate-fadeInUp">
            <Heading title="Tổng quan" sub="Tiến độ công việc toàn công ty (ClickUp + task phụ)" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <Kpi label="Đang làm" value={open.length} />
              <Kpi label="Trễ hạn" value={overdue.length} color="#FF453A" hint={withDue ? undefined : 'Chưa có task nào có hạn chót'} />
              <Kpi label="Đang FIX" value={fixing.length} color="#FF9F0A" />
              <Kpi label="Xong tháng này" value={doneThisMonth.length} color="#34C759" />
              <Kpi label="Task phụ mở" value={subtasks.filter(s => s.status === 'todo' || s.status === 'doing').length} color="#0A84FF" />
            </div>
            <div className={card}>
              <div className={kpiLabel + ' mb-3'}>Task trễ hạn</div>
              {overdue.length === 0 ? <div className="text-sm text-neutral-500">Không có task trễ hạn.</div> : (
                <div className="space-y-2">
                  {overdue.slice(0, 20).map(t => (
                    <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0"><div className="text-white truncate">{t.title}</div>
                        <div className="text-[11px] text-neutral-500">{projectOf(t)} · {(workersOfTask.get(t.id) || []).map(workerName).join(', ')}</div></div>
                      <Badge color="#FF453A">Hạn {fmtDate(t.due_date)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'reports' && (
          <div className="animate-fadeInUp">
            <Heading title="Dự án" sub="Tiến độ theo dự án (folder ClickUp)" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className={kpiLabel + ' text-left'}>
                  <th className="py-2">Dự án</th><th>Tiến độ</th><th className="text-right">Task</th>
                  <th className="text-right">Trễ</th><th className="text-right">FIX</th><th className="text-right">Hạn cuối</th></tr></thead>
                <tbody>
                  {projects.map(p => (
                    <tr key={p.name} className="border-t border-white/5">
                      <td className="py-3"><div className="text-white font-bold">{p.name}</div><div className="text-[11px] text-neutral-500">{p.space}</div></td>
                      <td className="w-56"><div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-white/10"><div className="h-1.5 rounded-full" style={{ width: p.pct + '%', background: '#FF9500' }} /></div>
                        <span className="text-xs text-neutral-400 w-9 text-right">{p.pct}%</span></div></td>
                      <td className="text-right text-neutral-300">{p.done}/{p.total}</td>
                      <td className="text-right">{p.overdue ? <Badge color="#FF453A">{p.overdue}</Badge> : <span className="text-neutral-600">0</span>}</td>
                      <td className="text-right">{p.fix ? <Badge color="#FF9F0A">{p.fix}</Badge> : <span className="text-neutral-600">0</span>}</td>
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
                <thead><tr className={kpiLabel + ' text-left'}>
                  <th className="py-2">Nhân sự</th><th className="text-right">Đã xong</th><th className="text-right">Đang làm</th>
                  <th className="text-right">Trễ hạn</th><th className="text-right">Lần FIX</th><th className="text-right">Đúng hạn</th><th className="text-right">Task phụ mở</th></tr></thead>
                <tbody>
                  {people.map(p => (
                    <tr key={p.w.id} className="border-t border-white/5">
                      <td className="py-3"><span className="text-white font-bold">{p.w.full_name}</span>{' '}
                        <Badge color={p.w.type === 'freelancer' ? '#BF5AF2' : '#0A84FF'}>{p.w.type || '—'}</Badge></td>
                      <td className="text-right text-white font-bold">{p.done}</td>
                      <td className="text-right text-neutral-300">{p.doing}</td>
                      <td className="text-right">{p.overdue ? <Badge color="#FF453A">{p.overdue}</Badge> : <span className="text-neutral-600">0</span>}</td>
                      <td className="text-right">{p.fix ? <Badge color="#FF9F0A">{p.fix}</Badge> : <span className="text-neutral-600">0</span>}</td>
                      <td className="text-right text-neutral-300">{p.onTimePct == null ? '—' : p.onTimePct + '%'}</td>
                      <td className="text-right text-neutral-300">{p.subOpen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-neutral-600 mt-3">"Đúng hạn" chỉ tính task đã xong có hạn chót. "Lần FIX" đếm từ nhật ký trạng thái (ghi từ 17/09/2026).</p>
          </div>
        )}

        {tab === 'recurring' && (
          <SubtaskTab subtasks={subtasks} setSubtasks={setSubtasks} workers={wsWorkers} tasks={wsTasks}
            projectNames={projects.map(p => p.name)} workerName={workerName}
            onError={(m) => setToast({ text: m, type: 'error' })} onOk={(m) => setToast({ text: m, type: 'success' })} />
        )}

        {tab === 'activity' && isAdmin && (
          <div className="animate-fadeInUp">
            <Heading title="Tài chính" sub="Chỉ admin thấy — doanh thu, chi phí theo dự án" />
            <div className={card}>
              <p className="text-sm text-neutral-300 mb-4">Số liệu tài chính đang nằm ở Workforce → Tổng quan (doanh thu, chi phí nhân sự, hiệu suất theo tiền).</p>
              <a href="#workforce/overview" className="inline-block rounded-xl text-xs font-black uppercase px-4 py-2 text-white" style={{ background: '#FF9500' }}>Mở tài chính dự án →</a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// ── Task phụ ──────────────────────────────────────────────────────────────
const STATUS_META: Record<SubtaskStatus, { label: string; color: string }> = {
  todo: { label: 'Cần làm', color: '#8E8E93' }, doing: { label: 'Đang làm', color: '#0A84FF' },
  done: { label: 'Xong', color: '#34C759' }, cancelled: { label: 'Huỷ', color: '#636366' },
};
const PRIORITY_META = { low: { label: 'Thấp', color: '#8E8E93' }, normal: { label: 'Thường', color: '#FF9500' }, high: { label: 'Gấp', color: '#FF453A' } };

const SubtaskTab: React.FC<{
  subtasks: PmSubtask[]; setSubtasks: React.Dispatch<React.SetStateAction<PmSubtask[]>>;
  workers: PmWorker[]; tasks: PmTask[]; projectNames: string[]; workerName: (id: string | null) => string;
  onError: (m: string) => void; onOk: (m: string) => void;
}> = ({ subtasks, setSubtasks, workers, tasks, projectNames, workerName, onError, onOk }) => {
  const [editing, setEditing] = useState<Partial<PmSubtask> | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const shown = subtasks.filter(s => filter === 'all' || s.status === 'todo' || s.status === 'doing');

  const save = async () => {
    if (!editing?.title?.trim()) return onError('Nhập tên task');
    const payload = {
      title: editing.title.trim(), description: editing.description || null, project: editing.project || null,
      parent_task_id: editing.parent_task_id || null, assignee_worker_id: editing.assignee_worker_id || null,
      status: editing.status || 'todo', priority: editing.priority || 'normal', due_date: editing.due_date || null,
    } as Partial<PmSubtask>;
    try {
      if (editing.id) {
        const u = await updateSubtask(editing.id, payload);
        setSubtasks(prev => prev.map(s => (s.id === u.id ? u : s)));
      } else {
        const c = await createSubtask(payload);
        setSubtasks(prev => [c, ...prev]);
      }
      setEditing(null); onOk('Đã lưu task phụ');
    } catch (e: any) { onError(e.message); }
  };
  const setStatus = async (s: PmSubtask, status: SubtaskStatus) => {
    try { const u = await updateSubtask(s.id, { status }); setSubtasks(prev => prev.map(x => (x.id === u.id ? u : x))); }
    catch (e: any) { onError(e.message); }
  };
  const remove = async (s: PmSubtask) => {
    if (!window.confirm(`Xoá task phụ "${s.title}"?`)) return;
    try { await deleteSubtask(s.id); setSubtasks(prev => prev.filter(x => x.id !== s.id)); } catch (e: any) { onError(e.message); }
  };

  return (
    <div className="animate-fadeInUp">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <Heading title="Task phụ" sub="Việc tạo thêm trong app — ClickUp vẫn là nguồn task chính" />
        <div className="flex gap-2">
          <button onClick={() => setFilter(filter === 'open' ? 'all' : 'open')}
            className="rounded-xl text-xs font-black uppercase px-4 py-2 border border-white/10 text-neutral-400">
            {filter === 'open' ? 'Xem tất cả' : 'Chỉ việc đang mở'}</button>
          <button onClick={() => setEditing({ status: 'todo', priority: 'normal' })}
            className="rounded-xl text-xs font-black uppercase px-4 py-2 text-white" style={{ background: '#FF9500' }}>+ Thêm task</button>
        </div>
      </div>

      {shown.length === 0 ? <div className={card + ' text-sm text-neutral-500'}>Chưa có task phụ.</div> : (
        <div className="space-y-2">
          {shown.map(s => (
            <div key={s.id} className={card + ' flex items-center justify-between gap-4 !p-4'}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-bold">{s.title}</span>
                  <Badge color={STATUS_META[s.status].color}>{STATUS_META[s.status].label}</Badge>
                  <Badge color={PRIORITY_META[s.priority].color}>{PRIORITY_META[s.priority].label}</Badge>
                  {isOverdue(s, s.status === 'done' || s.status === 'cancelled') && <Badge color="#FF453A">Trễ hạn</Badge>}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  {s.project || 'Không gắn dự án'} · {workerName(s.assignee_worker_id)} · Hạn {fmtDate(s.due_date)}
                  {s.parent_task_id && <> · ↳ {tasks.find(t => t.id === s.parent_task_id)?.title || 'task ClickUp'}</>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {s.status === 'todo' && <button onClick={() => setStatus(s, 'doing')} className="rounded-lg text-[10px] font-black uppercase px-3 py-1.5 border border-orange-500/30 text-orange-400">Bắt đầu</button>}
                {s.status === 'doing' && <button onClick={() => setStatus(s, 'done')} className="rounded-lg text-[10px] font-black uppercase px-3 py-1.5 border border-orange-500/30 text-orange-400">Xong</button>}
                <button onClick={() => setEditing(s)} className="rounded-lg text-[10px] font-black uppercase px-3 py-1.5 border border-white/10 text-neutral-400">Sửa</button>
                <button onClick={() => remove(s)} className="rounded-lg text-[10px] font-black uppercase px-3 py-1.5 border border-white/10 text-neutral-400">Xoá</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setEditing(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-[20px] border border-primary/10 bg-surface p-6 space-y-3 animate-scaleIn">
            <h3 className="text-white font-black text-base uppercase tracking-tight">{editing.id ? 'Sửa task phụ' : 'Task phụ mới'}</h3>
            <input className={input} style={{ background: '#1a1a1a' }} placeholder="Tên task *" autoFocus
              value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} />
            <textarea className={input} style={{ background: '#1a1a1a' }} rows={3} placeholder="Mô tả"
              value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className={input} style={{ background: '#1a1a1a' }} value={editing.project || ''} onChange={e => setEditing({ ...editing, project: e.target.value })}>
                <option value="">— Dự án —</option>{projectNames.map(p => <option key={p} value={p}>{p}</option>)}</select>
              <select className={input} style={{ background: '#1a1a1a' }} value={editing.assignee_worker_id || ''} onChange={e => setEditing({ ...editing, assignee_worker_id: e.target.value })}>
                <option value="">— Người làm —</option>{workers.filter(w => w.is_active !== false).map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}</select>
              <select className={input} style={{ background: '#1a1a1a' }} value={editing.priority || 'normal'} onChange={e => setEditing({ ...editing, priority: e.target.value as any })}>
                {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>Ưu tiên: {v.label}</option>)}</select>
              <select className={input} style={{ background: '#1a1a1a' }} value={editing.status || 'todo'} onChange={e => setEditing({ ...editing, status: e.target.value as SubtaskStatus })}>
                {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
              <input type="date" className={input} style={{ background: '#1a1a1a' }} value={editing.due_date || ''} onChange={e => setEditing({ ...editing, due_date: e.target.value })} />
              <select className={input} style={{ background: '#1a1a1a' }} value={editing.parent_task_id || ''} onChange={e => setEditing({ ...editing, parent_task_id: e.target.value })}>
                <option value="">— Gắn task ClickUp —</option>
                {tasks.filter(t => !isDone(t) && (!editing.project || projectOf(t) === editing.project)).slice(0, 200)
                  .map(t => <option key={t.id} value={t.id}>{t.title.slice(0, 60)}</option>)}</select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="rounded-xl text-xs font-black uppercase px-4 py-2 border border-white/10 text-neutral-400">Huỷ</button>
              <button onClick={save} className="rounded-xl text-xs font-black uppercase px-4 py-2 text-white" style={{ background: '#FF9500' }}>Lưu</button>
            </div>
          </div>
        </div>, document.body)}
    </div>
  );
};

export default ProjectsApp;
