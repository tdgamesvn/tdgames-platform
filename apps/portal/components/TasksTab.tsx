import React, { useState, useEffect, useMemo } from 'react';
import { AccountUser, WorkforceTask } from '@/types';
import { fetchMyTasks } from '../services/portalService';

// ── Types ─────────────────────────────────────────────────────

type TimePeriod = 'week' | 'month' | 'quarter' | 'year';
type StatusFilter = 'all' | 'in_progress' | 'completed' | 'approved' | 'rejected';

interface Props {
  currentUser: AccountUser;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

// ── Helpers ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  in_progress: { label: 'Đang thực hiện', color: '#2196F3', bg: 'rgba(33,150,243,0.12)', icon: '🔵' },
  completed:   { label: 'Hoàn thành',     color: '#FF9500', bg: 'rgba(255,149,0,0.12)',  icon: '🟠' },
  approved:    { label: 'Đã duyệt',        color: '#4CAF50', bg: 'rgba(76,175,80,0.12)', icon: '🟢' },
  rejected:    { label: 'Từ chối',          color: '#F44336', bg: 'rgba(244,67,54,0.12)', icon: '🔴' },
};

function getStatusCfg(s: string) {
  return STATUS_CONFIG[s] ?? { label: s, color: '#888', bg: 'rgba(128,128,128,0.12)', icon: '⚪' };
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function startOfWeek(d: Date): Date {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday-start
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function addDays(d: Date, n: number): Date {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
}

function addWeeks(d: Date, n: number): Date { return addDays(d, n * 7); }

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Returns task's reference date (closed_date if done, else start_date, else created_at)
function taskRefDate(t: WorkforceTask): string {
  return t.closed_date || t.start_date || t.created_at || '';
}

// ── Chart Bar Item ────────────────────────────────────────────

interface BarData {
  label: string;
  total: number;
  done: number;      // approved + completed
  in_progress: number;
  rejected: number;
  isCurrent: boolean;
}

function ChartBar({ bar, maxVal }: { bar: BarData; maxVal: number }) {
  const pct = maxVal > 0 ? (bar.total / maxVal) * 100 : 0;
  const donePct   = bar.total > 0 ? (bar.done / bar.total) * 100 : 0;
  const progPct   = bar.total > 0 ? (bar.in_progress / bar.total) * 100 : 0;
  const rejPct    = bar.total > 0 ? (bar.rejected / bar.total) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
      {/* Bar container */}
      <div style={{ width: '100%', height: '120px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div style={{
          width: bar.isCurrent ? '70%' : '55%',
          height: `${pct}%`,
          minHeight: bar.total > 0 ? '4px' : '2px',
          borderRadius: '4px 4px 0 0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: bar.total === 0 ? 'rgba(255,255,255,0.04)' : 'transparent',
          border: bar.isCurrent ? '1px solid rgba(255,149,0,0.3)' : 'none',
          transition: 'height 0.4s ease',
        }}>
          {/* Stacked from bottom: approved/completed → in_progress → rejected */}
          {bar.done > 0 && (
            <div style={{ flex: donePct, background: 'rgba(76,175,80,0.7)', minHeight: '2px' }} />
          )}
          {bar.in_progress > 0 && (
            <div style={{ flex: progPct, background: 'rgba(33,150,243,0.7)', minHeight: '2px' }} />
          )}
          {bar.rejected > 0 && (
            <div style={{ flex: rejPct, background: 'rgba(244,67,54,0.7)', minHeight: '2px' }} />
          )}
        </div>
      </div>
      {/* Count */}
      <p style={{
        fontSize: '11px', fontWeight: bar.total > 0 ? 700 : 400,
        color: bar.isCurrent ? '#FF9500' : bar.total > 0 ? '#F5F5F5' : '#444',
      }}>
        {bar.total > 0 ? bar.total : '·'}
      </p>
      {/* Label */}
      <p style={{
        fontSize: '9px', fontWeight: 600, color: bar.isCurrent ? '#FF9500' : '#666',
        textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
      }}>
        {bar.label}
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

const TasksTab: React.FC<Props> = ({ currentUser, onToast }) => {
  const [tasks, setTasks] = useState<WorkforceTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasWorker, setHasWorker] = useState<boolean | null>(null); // null = unknown

  const [period, setPeriod] = useState<TimePeriod>('month');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQ, setSearchQ] = useState('');

  // ── Load ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser.employee_id) {
      setHasWorker(false);
      return;
    }
    setIsLoading(true);
    fetchMyTasks(currentUser.employee_id)
      .then(data => {
        setTasks(data);
        setHasWorker(data.length >= 0); // even empty = worker found (or at least tried)
      })
      .catch(() => {
        onToast('Không thể tải danh sách task', 'error');
        setHasWorker(false);
      })
      .finally(() => setIsLoading(false));
  }, [currentUser.employee_id]);

  // ── KPIs ──────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const total       = tasks.length;
    const inProgress  = tasks.filter(t => t.status === 'in_progress').length;
    const completed   = tasks.filter(t => t.status === 'completed').length;
    const approved    = tasks.filter(t => t.status === 'approved').length;
    const rejected    = tasks.filter(t => t.status === 'rejected').length;
    const done        = completed + approved;
    const qualityPct  = total > 0 ? Math.round((approved / total) * 100) : 0;
    return { total, inProgress, completed, approved, rejected, done, qualityPct };
  }, [tasks]);

  // ── Chart Data ────────────────────────────────────────────
  const chartData = useMemo((): BarData[] => {
    const now = new Date();

    function buildBars(labels: string[], starts: string[], ends: string[]): BarData[] {
      return labels.map((label, i) => {
        const from = starts[i];
        const to   = ends[i];

        // Is this bar the current period?
        const todayIso = isoDate(now);
        const isCurrent = todayIso >= from && todayIso <= to;

        // Tasks whose reference date falls in [from, to]
        const inRange = tasks.filter(t => {
          const ref = taskRefDate(t).slice(0, 10);
          return ref >= from && ref <= to;
        });

        return {
          label,
          total:       inRange.length,
          done:        inRange.filter(t => t.status === 'approved' || t.status === 'completed').length,
          in_progress: inRange.filter(t => t.status === 'in_progress').length,
          rejected:    inRange.filter(t => t.status === 'rejected').length,
          isCurrent,
        };
      });
    }

    if (period === 'week') {
      // 8 weeks ending this week
      const thisMonStart = startOfWeek(now);
      const weekLabels: string[] = [];
      const weekStarts: string[] = [];
      const weekEnds:   string[] = [];
      for (let i = 7; i >= 0; i--) {
        const ws = addWeeks(thisMonStart, -i);
        const we = addDays(ws, 6);
        const label = i === 0 ? 'Tuần này' : `T${isoDate(ws).slice(5, 10)}`;
        weekLabels.push(label);
        weekStarts.push(isoDate(ws));
        weekEnds.push(isoDate(we));
      }
      return buildBars(weekLabels, weekStarts, weekEnds);
    }

    if (period === 'month') {
      // 12 months: current month + 11 prior
      const monthLabels: string[] = [];
      const monthStarts: string[] = [];
      const monthEnds:   string[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const label = i === 0 ? 'Tháng này' : `T${m + 1}/${String(y).slice(2)}`;
        const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const end   = isoDate(new Date(y, m + 1, 0)); // last day of month
        monthLabels.push(label);
        monthStarts.push(start);
        monthEnds.push(end);
      }
      return buildBars(monthLabels, monthStarts, monthEnds);
    }

    if (period === 'quarter') {
      // 4 quarters of current year
      const y = now.getFullYear();
      const qLabels  = ['Q1', 'Q2', 'Q3', 'Q4'];
      const qStarts  = [`${y}-01-01`, `${y}-04-01`, `${y}-07-01`, `${y}-10-01`];
      const qEnds    = [`${y}-03-31`, `${y}-06-30`, `${y}-09-30`, `${y}-12-31`];
      return buildBars(qLabels, qStarts, qEnds);
    }

    // year: last 5 years
    const yearLabels: string[] = [];
    const yearStarts: string[] = [];
    const yearEnds:   string[] = [];
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      yearLabels.push(i === 0 ? 'Năm nay' : String(y));
      yearStarts.push(`${y}-01-01`);
      yearEnds.push(`${y}-12-31`);
    }
    return buildBars(yearLabels, yearStarts, yearEnds);
  }, [tasks, period]);

  const chartMax = useMemo(() => Math.max(...chartData.map(b => b.total), 1), [chartData]);

  // ── Filtered task list ────────────────────────────────────
  const filteredTasks = useMemo(() => {
    const q = searchQ.toLowerCase();
    return tasks.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (q && !t.title.toLowerCase().includes(q) && !(t.project || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, statusFilter, searchQ]);

  // ── No employee_id ────────────────────────────────────────
  if (!currentUser.employee_id) {
    return (
      <div className="animate-fadeInUp">
        <div style={{ marginBottom: '28px' }}>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>
            🎯 Công việc của tôi
          </h2>
          <p className="text-sm text-neutral-medium mt-1">Danh sách task ClickUp được giao cho bạn</p>
        </div>
        <div style={{ textAlign: 'center', padding: '60px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>🔗</p>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Tài khoản chưa liên kết nhân viên</p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>Liên hệ HR để liên kết tài khoản với hồ sơ nhân viên</p>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="animate-fadeInUp">
        <div style={{ marginBottom: '28px' }}>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>
            🎯 Công việc của tôi
          </h2>
          <p className="text-sm text-neutral-medium mt-1">Đang tải dữ liệu...</p>
        </div>
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <p className="animate-pulse" style={{ color: '#888', fontSize: '13px' }}>Đang kết nối với ClickUp...</p>
        </div>
      </div>
    );
  }

  // ── No worker linked ──────────────────────────────────────
  if (hasWorker === false || (tasks.length === 0 && hasWorker === null)) {
    return (
      <div className="animate-fadeInUp">
        <div style={{ marginBottom: '28px' }}>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>
            🎯 Công việc của tôi
          </h2>
          <p className="text-sm text-neutral-medium mt-1">Danh sách task ClickUp được giao cho bạn</p>
        </div>
        <div style={{ textAlign: 'center', padding: '60px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>📋</p>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Chưa có task nào</p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>Task sẽ hiển thị khi admin đồng bộ ClickUp và giao việc cho bạn</p>
        </div>
      </div>
    );
  }

  const PERIOD_OPTIONS: { key: TimePeriod; label: string }[] = [
    { key: 'week',    label: 'Tuần' },
    { key: 'month',   label: 'Tháng' },
    { key: 'quarter', label: 'Quý' },
    { key: 'year',    label: 'Năm' },
  ];

  return (
    <div className="animate-fadeInUp" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>
            🎯 Công việc của tôi
          </h2>
          <p className="text-sm text-neutral-medium mt-1">Tổng quan chất lượng và tiến độ công việc theo thời gian</p>
        </div>
        {/* Period selector */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px' }}>
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              style={{
                padding: '6px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 700,
                background: period === opt.key ? '#FF9500' : 'transparent',
                color: period === opt.key ? '#000' : '#888',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Tổng task',      value: kpi.total,       color: '#F5F5F5', icon: '📋' },
          { label: 'Đã duyệt',        value: kpi.approved,    color: '#4CAF50', icon: '✅' },
          { label: 'Đang thực hiện', value: kpi.inProgress,  color: '#2196F3', icon: '🔄' },
          { label: 'Từ chối',          value: kpi.rejected,    color: '#F44336', icon: '❌' },
        ].map(kp => (
          <div key={kp.label} style={{
            background: '#161616', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px', padding: '16px 20px',
          }}>
            <p style={{ fontSize: '10px', fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              {kp.icon} {kp.label}
            </p>
            <p style={{ fontSize: '28px', fontWeight: 900, color: kp.color, lineHeight: 1 }}>{kp.value}</p>
          </div>
        ))}

        {/* Quality score card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,149,0,0.08), rgba(255,149,0,0.03))',
          border: '1px solid rgba(255,149,0,0.2)',
          borderRadius: '12px', padding: '16px 20px',
        }}>
          <p style={{ fontSize: '10px', fontWeight: 800, color: '#FF9500', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            ⭐ Chất lượng
          </p>
          <p style={{ fontSize: '28px', fontWeight: 900, color: '#FF9500', lineHeight: 1 }}>
            {kpi.qualityPct}<span style={{ fontSize: '14px' }}>%</span>
          </p>
          <p style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
            {kpi.approved} / {kpi.total} task được duyệt
          </p>
        </div>
      </div>

      {/* ── Bar Chart ── */}
      <div style={{
        background: '#161616', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px', padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            📊 Biểu đồ công việc
          </p>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {[
              { color: 'rgba(76,175,80,0.7)',  label: 'Hoàn thành/Duyệt' },
              { color: 'rgba(33,150,243,0.7)', label: 'Đang làm' },
              { color: 'rgba(244,67,54,0.7)',  label: 'Từ chối' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: l.color }} />
                <span style={{ fontSize: '10px', color: '#666' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
          {chartData.map((bar, i) => (
            <ChartBar key={i} bar={bar} maxVal={chartMax} />
          ))}
        </div>
      </div>

      {/* ── Task List ── */}
      <div style={{
        background: '#161616', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px', overflow: 'hidden',
      }}>
        {/* Filter bar */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
        }}>
          {/* Search */}
          <input
            type="text"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Tìm task..."
            style={{
              flex: 1, minWidth: '160px', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
              padding: '7px 12px', fontSize: '12px', color: '#F5F5F5', outline: 'none',
            }}
          />
          {/* Status filter */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {(['all', 'in_progress', 'completed', 'approved', 'rejected'] as StatusFilter[]).map(s => {
              const cfg = s === 'all' ? { label: 'Tất cả', color: '#888', bg: 'rgba(255,255,255,0.08)' } : getStatusCfg(s);
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    fontSize: '11px', fontWeight: 700,
                    background: active ? cfg.color : 'rgba(255,255,255,0.04)',
                    color: active ? '#000' : cfg.color,
                    transition: 'all 0.15s',
                  }}
                >
                  {s === 'all' ? 'Tất cả' : cfg.label}
                  {s !== 'all' && (
                    <span style={{ marginLeft: '4px', opacity: 0.7 }}>
                      ({tasks.filter(t => t.status === s).length})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 120px 100px 90px 90px',
          padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {['Tên Task / Dự án', 'Space / List', 'Trạng thái', 'Bắt đầu', 'Đóng'].map((h, i) => (
            <span key={i} style={{ fontSize: '10px', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {filteredTasks.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#444' }}>Không có task nào</p>
          </div>
        ) : (
          <div>
            {filteredTasks.map((t, i) => {
              const cfg = getStatusCfg(t.status);
              const isLast = i === filteredTasks.length - 1;
              return (
                <div
                  key={t.id || i}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 120px 100px 90px 90px',
                    padding: '12px 20px',
                    borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                    alignItems: 'center',
                  }}
                >
                  {/* Title + project */}
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      fontSize: '13px', fontWeight: 600, color: '#F2F2F2',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {t.title}
                    </p>
                    {(t.project || t.client_name) && (
                      <p style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                        {[t.project, t.client_name].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>

                  {/* Space / List */}
                  <div style={{ minWidth: 0 }}>
                    {t.clickup_space_name ? (
                      <>
                        <p style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.clickup_space_name}
                        </p>
                        {t.clickup_list_name && (
                          <p style={{ fontSize: '10px', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.clickup_list_name}
                          </p>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#333' }}>—</span>
                    )}
                  </div>

                  {/* Status badge */}
                  <div>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
                      fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                      background: cfg.bg, color: cfg.color,
                    }}>
                      {cfg.label}
                    </span>
                    {t.clickup_status && (
                      <p style={{ fontSize: '9px', color: '#444', marginTop: '2px' }}>
                        {t.clickup_status}
                      </p>
                    )}
                  </div>

                  {/* Start date */}
                  <p style={{ fontSize: '11px', color: '#888' }}>{formatDate(t.start_date || t.created_at)}</p>

                  {/* Closed date */}
                  <p style={{ fontSize: '11px', color: t.closed_date ? '#4CAF50' : '#444' }}>
                    {formatDate(t.closed_date)}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer count */}
        {filteredTasks.length > 0 && (
          <div style={{
            padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.01)',
          }}>
            <p style={{ fontSize: '11px', color: '#444' }}>
              Hiển thị {filteredTasks.length} / {tasks.length} task
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TasksTab;
