import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PmTask, PmTaskTime, PmInterval, fetchTaskIntervals, isDone, projectOf } from '../services/projectService';

// Drawer theo STYLE_GUIDE §Modals — Side panel / Drawer (portal, z-50, backdrop đóng).
const CAT_META: Record<string, { label: string; color: string }> = {
  active: { label: 'Đang làm', color: '#FF9500' },
  waiting_client: { label: 'Chờ khách', color: '#0A84FF' },
  not_started: { label: 'Chưa bắt đầu', color: '#9D9C9D' },
  done: { label: 'Kết thúc', color: '#34C759' },
  unknown: { label: 'Chưa phân nhóm', color: '#AF52DE' },
};
const label = 'text-[10px] font-black uppercase tracking-wider text-neutral-600';
const Badge: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg" style={{ background: color + '20', color }}>{children}</span>
);
const fmtDur = (ms: number) => {
  const h = ms / 3600_000;
  if (h < 1) return Math.max(1, Math.round(h * 60)) + ' phút';
  if (h < 48) return (Math.round(h * 10) / 10) + ' giờ';
  return (Math.round(h / 24 * 10) / 10) + ' ngày';
};
const fmtDT = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtH = (h: number) => (h >= 100 ? Math.round(h) : Math.round(h * 10) / 10) + 'h';

export type DrawerTarget = { kind: 'project'; name: string } | { kind: 'task'; taskId: string }
  | { kind: 'list'; title: string; ids: string[] } | null;

interface Props {
  target: DrawerTarget;
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
  tasks: PmTask[];
  times: PmTaskTime[];
  workerName: (id: string | null) => string;
  workersOfTask: Map<string, string[]>;
}

const TaskDrawer: React.FC<Props> = ({ target, onClose, onOpenTask, tasks, times, workerName, workersOfTask }) => {
  const [intervals, setIntervals] = useState<PmInterval[] | null>(null);
  const taskId = target?.kind === 'task' ? target.taskId : null;

  useEffect(() => {
    setIntervals(null);
    if (taskId) fetchTaskIntervals(taskId).then(setIntervals).catch(() => setIntervals([]));
  }, [taskId]);

  if (!target) return null;
  const hoursOf = (id: string) => times.filter(x => x.task_id === id);

  let body: React.ReactNode;
  if (target.kind === 'project' || target.kind === 'list') {
    // 'list' = danh sách task bất kỳ (bấm ô KPI ở Tổng quan)
    const idSet = target.kind === 'list' ? new Set(target.ids) : null;
    const list = tasks.filter(t => idSet ? idSet.has(t.id) : projectOf(t) === (target as { name: string }).name)
      .sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || (b.created_at || '').localeCompare(a.created_at || ''));
    body = (
      <>
        <h3 className="text-base font-black uppercase tracking-wider text-white">{target.kind === 'list' ? target.title : target.name}</h3>
        <p className="text-xs text-neutral-medium mt-1 mb-6">{list.length} task · bấm 1 task để xem dòng thời gian</p>
        <div className="space-y-3">
          {list.map(t => {
            const h = hoursOf(t.id).reduce((n, x) => n + x.active_hours, 0);
            return (
              <button key={t.id} onClick={() => onOpenTask(t.id)}
                className="w-full text-left flex items-center justify-between gap-3 p-4 rounded-[20px] border border-primary/10 hover:border-primary/20 transition-all bg-surface">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{t.title}</div>
                  <div className="text-xs text-neutral-medium">{(workersOfTask.get(t.id) || []).map(workerName).join(', ') || '—'}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {h > 0 && <span className="text-xs font-semibold text-white">{fmtH(h)}</span>}
                  <Badge color={isDone(t) ? '#34C759' : '#FF9500'}>{t.clickup_status || '—'}</Badge>
                </div>
              </button>
            );
          })}
        </div>
      </>
    );
  } else {
    const t = tasks.find(x => x.id === target.taskId);
    const per = hoursOf(target.taskId);
    const totals: Record<string, number> = {};
    (intervals || []).forEach(iv => {
      const ms = (iv.ended_at ? new Date(iv.ended_at).getTime() : Date.now()) - new Date(iv.started_at).getTime();
      totals[iv.category] = (totals[iv.category] || 0) + ms;
    });
    body = (
      <>
        <h3 className="text-base font-black uppercase tracking-wider text-white">{t?.title || 'Task'}</h3>
        <p className="text-xs text-neutral-medium mt-1 mb-6">{t ? projectOf(t) : ''} · Hạn {t?.due_date ? t.due_date.split('-').reverse().join('/') : '—'}</p>

        {t?.time_estimate_hours != null && (() => {
          const actual = per.reduce((n, x) => n + x.active_hours, 0);
          const est = Number(t.time_estimate_hours);
          const pct = est > 0 ? Math.round(actual / est * 100) : null;
          return (
            <div className="rounded-[20px] border border-primary/10 p-4 bg-surface mb-6 flex items-center justify-between gap-3">
              <div><div className={label}>Ước lượng / thực tế</div>
                <div className="text-sm font-semibold text-white mt-1">{fmtH(est)} / {per.length ? fmtH(actual) : '—'}</div></div>
              {pct != null && per.length > 0 && <Badge color={pct > 120 ? '#F44336' : pct > 100 ? '#FFA726' : '#34C759'}>{pct}% ước lượng</Badge>}
            </div>
          );
        })()}
        <div className={label + ' mb-2'}>Giờ làm theo người</div>
        {per.length === 0 ? <p className="text-xs text-neutral-medium mb-6">Chưa có nhật ký trạng thái (task đổi trạng thái lần cuối trước 17/09/2026).</p> : (
          <div className="space-y-2 mb-6">
            {per.map(x => (
              <div key={x.worker_id} className="flex items-center justify-between text-sm">
                <span className="text-white font-semibold">{workerName(x.worker_id)}{!x.is_fulltime && <span className="text-neutral-600"> *</span>}</span>
                <span className="text-neutral-300">{fmtH(x.active_hours)} làm · {fmtH(x.waiting_client_hours)} chờ khách · {x.fix_rounds} FIX</span>
              </div>
            ))}
            <p className="text-xs text-neutral-medium">* freelancer: giờ đồng hồ ở trạng thái đang làm (tương đối)</p>
          </div>
        )}

        {Object.keys(totals).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {Object.entries(totals).map(([c, ms]) => (
              <Badge key={c} color={(CAT_META[c] || CAT_META.unknown).color}>{(CAT_META[c] || CAT_META.unknown).label}: {fmtDur(ms)}</Badge>
            ))}
          </div>
        )}

        <div className={label + ' mb-3'}>Dòng thời gian trạng thái</div>
        {intervals === null ? <p className="text-xs text-neutral-medium animate-td-pulse">Đang tải...</p> :
          intervals.length === 0 ? <p className="text-xs text-neutral-medium">Chưa có dữ liệu.</p> : (
          <div className="relative pl-5 space-y-4">
            <div className="absolute left-[5px] top-1 bottom-1 w-px bg-white/10" />
            {intervals.map((iv, i) => {
              const meta = CAT_META[iv.category] || CAT_META.unknown;
              const ms = (iv.ended_at ? new Date(iv.ended_at).getTime() : Date.now()) - new Date(iv.started_at).getTime();
              return (
                <div key={i} className="relative">
                  <span className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{iv.status}</span>
                    <Badge color={meta.color}>{meta.label}</Badge>
                    {!iv.ended_at && <Badge color="#FF375F">Hiện tại</Badge>}
                  </div>
                  <div className="text-xs text-neutral-medium">{fmtDT(iv.started_at)} · {fmtDur(ms)}</div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md h-full overflow-y-auto bg-surface border-l border-white/10 p-6 animate-scaleIn">
        <div className="flex justify-between items-center mb-4">
          {target.kind === 'task' && tasks.find(x => x.id === target.taskId) ? (
            <span className={label}>Chi tiết task</span>
          ) : <span className={label}>{target.kind === 'list' ? 'Danh sách task' : 'Dự án'}</span>}
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">Đóng</button>
        </div>
        {body}
      </div>
    </div>,
    document.body,
  );
};

export default TaskDrawer;
