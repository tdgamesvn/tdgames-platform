import React, { useMemo, useState } from 'react';
import { PmTask, PmTaskTime, PmWorker, isDone, isOverdue, projectOf } from '../services/projectService';

// STYLE_GUIDE: card rounded-[20px] border-primary/10 bg-surface; list-item card hover border-primary/20;
// KPI label 10px font-black; badge 9px. Biểu đồ: skill dataviz — 1 chuỗi ⇒ 1 màu (#FF9500, contrast ≥3:1
// trên #1A1A1A đã validate), không legend (tiêu đề nói rõ), cột mảnh bo 4px đầu cột, gap 2px, grid mờ, tooltip hover.
const card = 'rounded-[20px] border border-primary/10 p-6 bg-surface';
const kpiLabel = 'text-[10px] font-black text-neutral-600 uppercase tracking-wider';
const C = { orange: '#FF9500', green: '#34C759', red: '#F44336', amber: '#FFA726', blue: '#0A84FF', purple: '#AF52DE', gray: '#9D9C9D' };
const Badge: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg" style={{ background: color + '20', color }}>{children}</span>
);
const fmtH = (h: number) => (h >= 100 ? Math.round(h) : Math.round(h * 10) / 10) + 'h';
const initials = (n: string) => n.trim().split(/\s+/).slice(-2).map(x => x[0]).join('').toUpperCase();

export interface PersonStats {
  w: PmWorker; done: number; activeNow: number; doing: number; overdue: number; fix: number;
  onTimePct: number | null; onTimeN?: number; subOpen: number;
  hours: { total: number; avg: number | null; firstPass: number | null; fulltime: boolean; estPct: number | null; n?: number };
}

// ── Kỳ thống kê ──────────────────────────────────────────────────────────
type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';
const PERIODS: { id: Period; label: string; n: number }[] = [
  { id: 'day', label: 'Ngày', n: 14 }, { id: 'week', label: 'Tuần', n: 12 }, { id: 'month', label: 'Tháng', n: 12 },
  { id: 'quarter', label: 'Quý', n: 8 }, { id: 'year', label: 'Năm', n: 3 },
];
const vnToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
/** Khoá kỳ (ngày bắt đầu kỳ, YYYY-MM-DD) cho 1 ngày. */
const bucketOf = (d: string, p: Period) => {
  const [y, m] = d.split('-').map(Number);
  if (p === 'day') return d;
  if (p === 'week') { const x = new Date(d + 'T00:00:00Z'); return addDays(d, -((x.getUTCDay() + 6) % 7)); }
  if (p === 'month') return `${y}-${String(m).padStart(2, '0')}-01`;
  if (p === 'quarter') return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
  return `${y}-01-01`;
};
const prevBucket = (b: string, p: Period) => {
  const [y, m] = b.split('-').map(Number);
  if (p === 'day') return addDays(b, -1);
  if (p === 'week') return addDays(b, -7);
  if (p === 'month') return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
  if (p === 'quarter') return m <= 3 ? `${y - 1}-10-01` : `${y}-${String(m - 3).padStart(2, '0')}-01`;
  return `${y - 1}-01-01`;
};
const labelOf = (b: string, p: Period, long = false) => {
  const [y, m, d] = b.split('-');
  if (p === 'day') return long ? `${d}/${m}/${y}` : `${d}/${m}`;
  if (p === 'week') { const e = addDays(b, 6).split('-'); return long ? `Tuần ${d}/${m} – ${e[2]}/${e[1]}/${e[0]}` : `${d}/${m}`; }
  if (p === 'month') return long ? `Tháng ${Number(m)}/${y}` : `T${Number(m)}`;
  if (p === 'quarter') return long ? `Quý ${Math.floor((Number(m) - 1) / 3) + 1}/${y}` : `Q${Math.floor((Number(m) - 1) / 3) + 1}/${y.slice(2)}`;
  return y;
};

// ── Lưới thẻ nhân sự ─────────────────────────────────────────────────────
export const PeopleGrid: React.FC<{ people: PersonStats[]; onOpen: (id: string) => void }> = ({ people, onOpen }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
    {people.map(p => (
      <button key={p.w.id} onClick={() => onOpen(p.w.id)}
        className="text-left rounded-[20px] border border-primary/10 hover:border-primary/30 transition-all bg-surface p-5">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-black text-primary shrink-0">{initials(p.w.full_name)}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate">{p.w.full_name}</div>
            <Badge color={p.w.type === 'freelancer' ? C.purple : C.blue}>{p.w.type || '—'}</Badge>
          </div>
          <span className="text-primary/70 text-[15px] font-black">›</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div><div className={kpiLabel}>Đã xong (kỳ)</div><div className="text-2xl font-black text-white">{p.done}</div></div>
          <div><div className={kpiLabel}>Đang làm</div><div className="text-2xl font-black text-white">{p.activeNow}<span className="text-sm text-neutral-600">/{p.doing}</span></div></div>
          <div><div className={kpiLabel}>Giờ làm</div><div className="text-2xl font-black text-white">{p.hours.total ? fmtH(p.hours.total) : '—'}</div></div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {p.overdue > 0 && <Badge color={C.red}>{p.overdue} trễ hạn</Badge>}
          {p.fix > 0 && <Badge color={C.amber}>{p.fix} lần FIX</Badge>}
          {p.hours.firstPass != null && <Badge color={C.green}>{p.hours.firstPass}% duyệt lần đầu</Badge>}
          {p.onTimePct != null && <Badge color={C.blue}>{p.onTimePct}% đúng hạn · {p.onTimeN} task</Badge>}
          {p.activeNow >= 4 && <Badge color={C.orange}>Đang ôm nhiều việc</Badge>}
        </div>
      </button>
    ))}
  </div>
);

// ── Chi tiết 1 nhân sự ───────────────────────────────────────────────────
interface DetailProps {
  tasks: PmTask[]; times: PmTaskTime[];
  deliveredOn: (t: PmTask) => string | null; onBack: () => void; onOpenTask: (id: string) => void;
  /** Dùng chung cho nhân sự (stats) và dự án (heading + extra). */
  stats?: PersonStats;
  heading?: { title: string; sub: string; avatar: string; back: string };
  extra?: React.ReactNode;
}

export const PersonDetail: React.FC<DetailProps> = ({ stats, heading, extra, tasks, times, deliveredOn, onBack, onOpenTask }) => {
  const [period, setPeriod] = useState<Period>('week');
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const timeOf = useMemo(() => new Map(times.map(x => [x.task_id, x])), [times]);

  const buckets = useMemo(() => {
    const n = PERIODS.find(p => p.id === period)!.n;
    const keys: string[] = []; let b = bucketOf(vnToday(), period);
    for (let i = 0; i < n; i++) { keys.unshift(b); b = prevBucket(b, period); }
    return keys.map(k => {
      const ts = tasks.filter(t => { const d = deliveredOn(t); return d && bucketOf(d, period) === k; });
      const tracked = ts.map(t => timeOf.get(t.id)).filter(x => x?.first_client_review_at) as PmTaskTime[];
      const withDue = ts.filter(t => t.due_date);
      return {
        k, tasks: ts, count: ts.length,
        hours: tracked.reduce((n, x) => n + x.active_hours, 0),
        avgH: tracked.length ? tracked.reduce((n, x) => n + x.active_hours, 0) / tracked.length : null,
        firstPass: tracked.length ? Math.round(tracked.filter(x => x.fix_rounds === 0).length / tracked.length * 100) : null,
        fix: tracked.reduce((n, x) => n + x.fix_rounds, 0),
        onTime: withDue.length ? Math.round(withDue.filter(t => (deliveredOn(t) || '') <= t.due_date!).length / withDue.length * 100) : null,
      };
    });
  }, [tasks, period, deliveredOn, timeOf]);

  const cur = buckets.find(b => b.k === sel) || buckets[buckets.length - 1];
  const prev = buckets[buckets.indexOf(cur) - 1];
  const max = Math.max(1, ...buckets.map(b => b.count));
  const openTasks = tasks.filter(t => !isDone(t));
  const delta = prev ? cur.count - prev.count : null;

  // SVG bar chart (viewBox co giãn theo bề ngang thẻ)
  const W = 720, H = 180, padL = 28, padB = 24, padT = 12;
  const bw = (W - padL) / buckets.length;
  const yOf = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, Math.ceil(max / 2), max];

  return (
    <div className="animate-fadeInUp space-y-6">
      <button onClick={onBack} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">‹ {heading?.back || 'Tất cả nhân sự'}</button>

      <div className="flex items-center gap-4 flex-wrap">
        <span className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-lg font-black text-primary">{heading ? heading.avatar : initials(stats!.w.full_name)}</span>
        <div>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>{heading ? heading.title : stats!.w.full_name}</h2>
          <p className="text-sm text-neutral-medium mt-1">
            {heading ? heading.sub : <>{stats!.w.type === 'freelancer' ? 'Freelancer — giờ làm là giờ đồng hồ (tương đối)' : 'Nội bộ — giờ làm tính trong giờ chấm công'} · {tasks.length - openTasks.length} task đã xong · {openTasks.length} chưa xong</>}
          </p>
        </div>
      </div>
      {extra}

      {/* Bộ chọn kỳ */}
      <div className="flex gap-2 flex-wrap">
        {PERIODS.map(p => (
          <button key={p.id} onClick={() => { setPeriod(p.id); setSel(null); }}
            className={'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ' + (period === p.id ? 'text-white' : 'text-neutral-400 border border-white/10 hover:bg-white/5')}
            style={period === p.id ? { background: '#FF9500' } : {}}>{p.label}</button>
        ))}
      </div>

      <div className={card}>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="text-base font-black uppercase tracking-wider text-white">Task hoàn thành theo {PERIODS.find(p => p.id === period)!.label.toLowerCase()}</div>
            <p className="text-xs text-neutral-medium mt-1">Bấm 1 cột để xem chi tiết kỳ đó · tính theo lần đầu giao khách (task cũ: ngày đóng)</p>
          </div>
        </div>
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Số task hoàn thành theo kỳ">
            {ticks.map(t => (
              <g key={t}>
                <line x1={padL} x2={W} y1={yOf(t)} y2={yOf(t)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                <text x={padL - 6} y={yOf(t) + 3} textAnchor="end" fontSize="10" fill="#9D9C9D">{t}</text>
              </g>
            ))}
            {buckets.map((b, i) => {
              const x = padL + i * bw + 1, w = Math.max(2, bw - 2), y = yOf(b.count), h = H - padB - y;
              const active = b.k === cur.k;
              return (
                <g key={b.k} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setSel(b.k)} style={{ cursor: 'pointer' }}>
                  <rect x={padL + i * bw} y={padT} width={bw} height={H - padT - padB} fill="transparent" />
                  {b.count > 0 && (
                    <path d={`M${x},${H - padB} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + w - 4} Q${x + w},${y} ${x + w},${y + 4} V${H - padB} Z`}
                      fill="#FF9500" opacity={active ? 1 : hover === i ? 0.8 : 0.45} />
                  )}
                  {(buckets.length <= 14 || i % 2 === 0) && (
                    <text x={padL + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={active ? '#F2F2F2' : '#9D9C9D'}>{labelOf(b.k, period)}</text>
                  )}
                </g>
              );
            })}
          </svg>
          {hover != null && (
            <div className="absolute pointer-events-none rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2 text-xs text-white shadow-lg"
              style={{ left: `${((padL + hover * bw + bw / 2) / W) * 100}%`, top: 0, transform: 'translateX(-50%)' }}>
              <div className="font-semibold">{labelOf(buckets[hover].k, period, true)}</div>
              <div className="text-neutral-300">{buckets[hover].count} task{buckets[hover].avgH != null ? ` · TB ${fmtH(buckets[hover].avgH!)}` : ''}</div>
            </div>
          )}
        </div>
      </div>

      {/* KPI của kỳ đang chọn */}
      <div>
        <div className={kpiLabel + ' mb-3'}>{labelOf(cur.k, period, true)}</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <div className="rounded-[20px] border border-primary/10 p-5 space-y-1 bg-surface"><div className={kpiLabel}>Task hoàn thành</div>
            <div className="text-2xl font-black text-white">{cur.count}</div>
            {delta != null && <div className={'text-xs font-semibold ' + (delta >= 0 ? 'text-status-success' : 'text-status-error')}>{delta >= 0 ? '+' : ''}{delta} so với kỳ trước</div>}</div>
          <div className="rounded-[20px] border border-primary/10 p-5 space-y-1 bg-surface"><div className={kpiLabel}>Giờ làm</div>
            <div className="text-2xl font-black text-white">{cur.hours ? fmtH(cur.hours) : '—'}</div></div>
          <div className="rounded-[20px] border border-primary/10 p-5 space-y-1 bg-surface"><div className={kpiLabel}>TB / task</div>
            <div className="text-2xl font-black text-white">{cur.avgH == null ? '—' : fmtH(cur.avgH)}</div></div>
          <div className="rounded-[20px] border border-primary/10 p-5 space-y-1 bg-surface"><div className={kpiLabel}>Duyệt lần đầu</div>
            <div className="text-2xl font-black text-white">{cur.firstPass == null ? '—' : cur.firstPass + '%'}</div>
            {cur.fix > 0 && <div className="text-xs text-neutral-medium">{cur.fix} vòng FIX</div>}</div>
          <div className="rounded-[20px] border border-primary/10 p-5 space-y-1 bg-surface"><div className={kpiLabel}>Đúng hạn</div>
            <div className="text-2xl font-black text-white">{cur.onTime == null ? '—' : cur.onTime + '%'}</div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <TaskList title={`Hoàn thành · ${labelOf(cur.k, period, true)}`} tasks={cur.tasks} timeOf={timeOf} onOpenTask={onOpenTask} empty="Không có task hoàn thành trong kỳ này" />
        <TaskList title="Đang làm / chưa xong" tasks={openTasks} timeOf={timeOf} onOpenTask={onOpenTask} empty="Không có task đang mở" />
      </div>
    </div>
  );
};

const TaskList: React.FC<{ title: string; tasks: PmTask[]; timeOf: Map<string, PmTaskTime>; onOpenTask: (id: string) => void; empty: string }> =
  ({ title, tasks, timeOf, onOpenTask, empty }) => (
  <div className={card}>
    <div className="text-base font-black uppercase tracking-wider text-white mb-4">{title} <span className="text-neutral-600">({tasks.length})</span></div>
    {tasks.length === 0 ? <p className="text-sm text-neutral-600 py-6 text-center">{empty}</p> : (
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {tasks.map(t => {
          const x = timeOf.get(t.id);
          return (
            <div key={t.id} onClick={() => onOpenTask(t.id)} className="flex items-center justify-between gap-3 cursor-pointer rounded-xl px-3 py-2 hover:bg-white/5 transition-colors">
              <div className="min-w-0"><div className="text-sm font-semibold text-white truncate">{t.title}</div>
                <div className="text-xs text-neutral-medium truncate">{projectOf(t)}{x ? ` · ${fmtH(x.active_hours)} làm` : ''}{x?.fix_rounds ? ` · ${x.fix_rounds} FIX` : ''}</div></div>
              <div className="flex gap-1 shrink-0">
                {isOverdue(t, isDone(t)) && <Badge color={C.red}>Trễ</Badge>}
                <Badge color={isDone(t) ? C.green : C.orange}>{t.clickup_status || '—'}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

// ── Bảng so sánh nhân sự (xếp hạng theo kỳ đang chọn) ─────────────────────
type SortKey = 'done' | 'hours' | 'avg' | 'firstPass' | 'onTime' | 'fix' | 'active';
const COLS: { k: SortKey; label: string; title: string; lowerBetter?: boolean }[] = [
  { k: 'done', label: 'Đã xong', title: 'Task giao khách / đóng trong kỳ' },
  { k: 'hours', label: 'Giờ làm', title: 'Tổng giờ ở trạng thái đang làm (task giao trong kỳ)' },
  { k: 'avg', label: 'TB / task', title: 'Giờ làm trung bình mỗi task — thấp hơn = nhanh hơn', lowerBetter: true },
  { k: 'firstPass', label: 'Duyệt lần đầu', title: '% task không bị FIX' },
  { k: 'onTime', label: 'Đúng hạn', title: '% giao khách ≤ hạn chót' },
  { k: 'fix', label: 'Lần FIX', title: 'Số lần chuyển sang FIX — thấp hơn = tốt hơn', lowerBetter: true },
  { k: 'active', label: 'Đang làm', title: 'Task đang ở trạng thái đang làm (hiện tại)' },
];
const valOf = (p: PersonStats, k: SortKey): number | null => ({
  done: p.done, hours: p.hours.total || null, avg: p.hours.avg, firstPass: p.hours.firstPass,
  onTime: p.onTimePct, fix: p.fix, active: p.activeNow,
}[k]);

export const PeopleTable: React.FC<{ people: PersonStats[]; onOpen: (id: string) => void }> = ({ people, onOpen }) => {
  const [sort, setSort] = useState<{ k: SortKey; desc: boolean }>({ k: 'done', desc: true });
  // Cột tỷ lệ: < MIN_N task thì kết quả không đáng tin (1 task = 100%) ⇒ xếp sau người đủ mẫu.
  const MIN_N = 3;
  const nOf = (p: PersonStats, k: SortKey) => k === 'firstPass' || k === 'avg' ? (p.hours.n ?? 0) : k === 'onTime' ? (p.onTimeN ?? 0) : MIN_N;
  const rows = [...people].sort((a, b) => {
    const ea = nOf(a, sort.k) >= MIN_N, eb = nOf(b, sort.k) >= MIN_N;
    if (ea !== eb) return ea ? -1 : 1;
    const va = valOf(a, sort.k), vb = valOf(b, sort.k);
    if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1; // "—" luôn xuống cuối
    return sort.desc ? vb - va : va - vb;
  });
  const fmt = (p: PersonStats, k: SortKey) => {
    const v = valOf(p, k); if (v == null) return <span className="text-neutral-600">—</span>;
    if (k === 'hours' || k === 'avg') return fmtH(v) + (k === 'hours' && !p.hours.fulltime ? '*' : '');
    if (k === 'firstPass' || k === 'onTime') {
      const n = k === 'onTime' ? p.onTimeN : p.hours.n;
      return <span className={n != null && n < MIN_N ? 'text-neutral-600' : ''} title={n != null && n < MIN_N ? 'Ít hơn 3 task — chưa đủ tin cậy' : undefined}>{v}%{n ? ` · ${n}` : ''}</span>;
    }
    return v;
  };
  return (
    <div className="rounded-[20px] border border-primary/10 bg-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead><tr className={kpiLabel + ' text-left border-b border-white/5'}>
            <th className="py-3 px-4 sticky left-0 bg-surface w-10">#</th>
            <th className="py-3 pr-4 sticky left-10 bg-surface">Nhân sự</th>
            {COLS.map(c => (
              <th key={c.k} title={c.title} className="py-3 px-3 text-right cursor-pointer select-none hover:text-white transition-colors"
                onClick={() => setSort(s => ({ k: c.k, desc: s.k === c.k ? !s.desc : !c.lowerBetter }))}>
                {c.label}{sort.k === c.k ? (sort.desc ? ' ↓' : ' ↑') : ''}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.w.id} onClick={() => onOpen(p.w.id)} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
                <td className="py-3 px-4 sticky left-0 bg-surface text-neutral-600 font-black">{i + 1}</td>
                <td className="py-3 pr-4 sticky left-10 bg-surface">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-sm font-semibold text-white">{p.w.full_name}</span>
                    <Badge color={p.w.type === 'freelancer' ? C.purple : C.blue}>{p.w.type === 'freelancer' ? 'FL' : 'IN'}</Badge>
                  </div>
                </td>
                {COLS.map(c => <td key={c.k} className={'py-3 px-3 text-right whitespace-nowrap ' + (sort.k === c.k ? 'text-white font-semibold' : 'text-neutral-300')}>{fmt(p, c.k)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-medium px-4 py-3 border-t border-white/5">Bấm tiêu đề cột để xếp hạng · tỷ lệ % kèm số task (chữ mờ = dưới 3 task, xếp sau) · * freelancer: giờ đồng hồ (tương đối) · "—" chưa có dữ liệu (luôn xếp cuối) · bấm 1 dòng để xem chi tiết</p>
    </div>
  );
};
