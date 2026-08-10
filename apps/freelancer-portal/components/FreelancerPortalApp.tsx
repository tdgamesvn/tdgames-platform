import React, { useState, useEffect, useMemo } from 'react';
import AppBackground from '@/components/AppBackground';
import { AccountUser, WorkforceTask, Settlement } from '@/types';
import { ToastNotification } from '@/components/ToastNotification';
import { Navbar } from '@/components/Navbar';
import {
  fetchMyTasks,
  fetchMySettlements,
  fetchSettlementTasks,
  fetchMyContracts,
  fetchMyWorkerId,
  fetchDashboardStats,
  FreelancerDashboardStats,
} from '../services/freelancerPortalService';
import ProfileTab from '@/apps/portal/components/ProfileTab';

type FLTab = 'dashboard' | 'tasks' | 'settlements' | 'profile';

interface Props {
  currentUser: AccountUser;
  onBack: () => void;
}

const TAB_MAP: Record<FLTab, string> = {
  dashboard: 'history',
  tasks: 'activity',
  settlements: 'tasks',
  profile: 'edit',
};
const TAB_LABELS: Record<string, string> = {
  history: 'Dashboard',
  activity: 'Tasks',
  tasks: 'Nghiệm thu',
  edit: 'Hồ sơ',
};
const REVERSE: Record<string, FLTab> = {
  history: 'dashboard',
  activity: 'tasks',
  tasks: 'settlements',
  edit: 'profile',
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'Đang làm',
  completed: 'Hoàn thành',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};
const STATUS_COLORS: Record<string, string> = {
  in_progress: '#F59E0B',
  completed: '#06B6D4',
  approved: '#34C759',
  rejected: '#FF3B30',
};

const SETTLEMENT_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Bản nháp', color: '#888' },
  sent: { label: 'Đã gửi', color: '#F59E0B' },
  accepted: { label: 'Đã nghiệm thu', color: '#06B6D4' },
  paid: { label: 'Đã thanh toán', color: '#34C759' },
};

const fmt = (n: number) => n.toLocaleString('vi-VN');

const FreelancerPortalApp: React.FC<Props> = ({ currentUser, onBack }) => {
  const [tab, setTab] = useState<FLTab>('dashboard');
  const [tasks, setTasks] = useState<WorkforceTask[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [stats, setStats] = useState<FreelancerDashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Settlement detail
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [detailTasks, setDetailTasks] = useState<WorkforceTask[]>([]);

  const [workerId, setWorkerId] = useState<string | null>(currentUser.worker_id || null);
  const [resolvingWorker, setResolvingWorker] = useState(!currentUser.worker_id);

  useEffect(() => {
    if (!resolvingWorker) return;
    fetchMyWorkerId()
      .then(setWorkerId)
      .catch(() => setWorkerId(null))
      .finally(() => setResolvingWorker(false));
  }, []);

  // ── Data Loading ──
  useEffect(() => {
    if (!workerId) return;
    setLoading(true);
    Promise.all([
      fetchMyTasks(workerId),
      fetchMySettlements(workerId),
      fetchDashboardStats(workerId),
    ])
      .then(([t, s, d]) => { setTasks(t); setSettlements(s); setStats(d); })
      .catch(err => setToast({ message: err.message, type: 'error' }))
      .finally(() => setLoading(false));
  }, [workerId]);

  // Load settlement detail tasks
  useEffect(() => {
    if (selectedSettlement?.id) {
      fetchSettlementTasks(selectedSettlement.id).then(setDetailTasks).catch(() => setDetailTasks([]));
    }
  }, [selectedSettlement?.id]);

  // ── Task Filters ──
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const filteredTasks = useMemo(() => {
    if (taskFilter === 'all') return tasks;
    return tasks.filter(t => t.status === taskFilter);
  }, [tasks, taskFilter]);

  const navbarTab = TAB_MAP[tab];
  const handleNavChange = (t: string) => {
    const mapped = REVERSE[t];
    if (mapped) { setTab(mapped); setSelectedSettlement(null); }
  };

  // ── No worker_id ──
  if (resolvingWorker) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F0F0F' }}>
        <p className="text-white/40 font-bold text-sm">Đang tải…</p>
      </div>
    );
  }
  if (!workerId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F0F0F' }}>
        <div className="text-center p-8 rounded-2xl" style={{ background: '#161616', border: '1px solid #222' }}>
          <p className="text-4xl mb-4">🔗</p>
          <p className="text-white/40 font-bold">Tài khoản chưa liên kết hồ sơ Workforce</p>
          <p className="text-white/20 text-sm mt-2">Liên hệ HR để liên kết tài khoản</p>
          <button onClick={onBack} className="mt-6 px-6 py-2 rounded-xl font-bold text-sm text-amber-500 border border-amber-500/20 hover:bg-amber-500/10 transition-all">
            ← Quay lại
          </button>
        </div>
      </div>
    );
  }

  // ── Settlement Detail View ──
  if (selectedSettlement) {
    const s = selectedSettlement;
    const stStatus = SETTLEMENT_STATUS[s.status] || { label: s.status, color: '#888' };

    return (
      <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
        <AppBackground />
        <div className="min-h-screen flex flex-col relative z-10">
          <Navbar
            theme="dark" currentUser={currentUser} onBack={onBack}
            activeTab={navbarTab as any} onTabChange={handleNavChange as any}
            accessibleTabs={Object.keys(TAB_LABELS) as any}
            onLogout={onBack} tabLabels={TAB_LABELS} appName="Freelancer Portal"
          />
          <main className="flex-1 px-4 md:px-8 lg:px-12 py-8 max-w-7xl mx-auto w-full animate-fadeInUp">
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setSelectedSettlement(null)}
                className="text-amber-500 hover:text-amber-400 transition-all text-2xl">←</button>
              <div>
                <h2 className="text-2xl font-black text-amber-500 uppercase tracking-tight">Nghiệm thu</h2>
                <p className="text-white/40 text-sm">Kỳ {s.period}</p>
              </div>
              <span className="ml-auto px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider"
                style={{ background: `${stStatus.color}15`, color: stStatus.color, border: `1px solid ${stStatus.color}30` }}>
                {stStatus.label}
              </span>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-2xl border border-amber-500/10" style={{ background: '#161616' }}>
                <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Số task</p>
                <p className="text-2xl font-black text-white">{detailTasks.length}</p>
              </div>
              <div className="p-4 rounded-2xl border border-amber-500/10" style={{ background: '#161616' }}>
                <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Tổng giá</p>
                <p className="text-2xl font-black text-amber-500">{fmt(s.total_amount || 0)}</p>
              </div>
              <div className="p-4 rounded-2xl border border-red-500/10" style={{ background: '#161616' }}>
                <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Thuế TNCN ({s.tax_rate || 10}%)</p>
                <p className="text-2xl font-black text-red-400">-{fmt(s.tax_amount || 0)}</p>
              </div>
              <div className="p-4 rounded-2xl border border-emerald-500/20" style={{ background: '#161616' }}>
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-1">Thực nhận</p>
                <p className="text-2xl font-black text-emerald-400">{fmt(s.net_amount || 0)}</p>
              </div>
            </div>

            {/* Task table */}
            <div className="rounded-2xl border border-amber-500/10 overflow-hidden" style={{ background: '#161616' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30 w-8">#</th>
                      <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30 min-w-[200px]">Task</th>
                      <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Project</th>
                      <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Ngày đóng</th>
                      <th className="text-right px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailTasks.map((t, i) => (
                      <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-white/30">{i + 1}</td>
                        <td className="px-4 py-3 text-white font-medium">{t.title}</td>
                        <td className="px-4 py-3 text-white/50">{t.project}</td>
                        <td className="px-4 py-3 text-white/50">{t.closed_date || '—'}</td>
                        <td className="px-4 py-3 text-right text-white font-bold">{fmt(t.price || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10">
                      <td colSpan={4} className="px-4 py-3 text-right text-xs font-black uppercase tracking-widest text-white/40">Tổng</td>
                      <td className="px-4 py-3 text-right text-amber-500 font-black text-lg">{fmt(s.total_amount || 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ── Main Portal ──
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />
      <div className="min-h-screen flex flex-col relative z-10">
        <Navbar
          theme="dark" currentUser={currentUser} onBack={onBack}
          activeTab={navbarTab as any} onTabChange={handleNavChange as any}
          accessibleTabs={Object.keys(TAB_LABELS) as any}
          onLogout={onBack} tabLabels={TAB_LABELS} appName="Freelancer Portal"
        />
        <main className="flex-1 px-4 md:px-8 lg:px-12 py-8 max-w-7xl mx-auto w-full">

          {/* ════════════════ DASHBOARD ════════════════ */}
          {tab === 'dashboard' && (
            <div className="animate-fadeInUp">
              <div className="mb-8">
                <h2 className="text-3xl font-black text-amber-500 uppercase tracking-tight">📊 Dashboard</h2>
                <p className="text-white/40 text-sm mt-1">Tổng quan công việc & thu nhập</p>
              </div>

              {loading ? (
                <div className="text-center py-20">
                  <p className="animate-pulse text-white/40 text-sm">Đang tải...</p>
                </div>
              ) : stats ? (
                <>
                  {/* KPI Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    {[
                      { label: 'Tổng task', value: stats.totalTasks, color: '#F59E0B', icon: '📋' },
                      { label: 'Đang làm', value: stats.inProgressTasks, color: '#F59E0B', icon: '⏳' },
                      { label: 'Hoàn thành', value: stats.completedTasks, color: '#34C759', icon: '✅' },
                      { label: 'Phiếu NT', value: stats.totalSettlements, color: '#06B6D4', icon: '📑' },
                      { label: 'Đã nhận', value: fmt(stats.totalEarnings), color: '#34C759', icon: '💰', suffix: ' ₫' },
                      { label: 'Chờ TT', value: fmt(stats.pendingPayment), color: '#FF9500', icon: '⏰', suffix: ' ₫' },
                    ].map((kpi, i) => (
                      <div key={i} className="p-4 rounded-2xl border" style={{ background: '#161616', borderColor: `${kpi.color}15` }}>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: `${kpi.color}80` }}>
                          {kpi.icon} {kpi.label}
                        </p>
                        <p className="text-xl font-black" style={{ color: kpi.color }}>
                          {kpi.value}{kpi.suffix || ''}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Income Chart (simple bar chart) */}
                  <div className="rounded-2xl border border-amber-500/10 p-6" style={{ background: '#161616' }}>
                    <p className="text-xs font-black uppercase tracking-widest text-white/40 mb-4">📈 Thu nhập 6 tháng gần nhất</p>
                    <div className="flex items-end gap-3 h-40">
                      {stats.monthlyEarnings.map((m, i) => {
                        const maxAmount = Math.max(...stats.monthlyEarnings.map(e => e.amount), 1);
                        const heightPct = (m.amount / maxAmount) * 100;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2">
                            <span className="text-[10px] text-white/50 font-bold">{m.amount > 0 ? fmt(m.amount) : ''}</span>
                            <div className="w-full rounded-t-lg transition-all duration-500"
                              style={{
                                height: `${Math.max(heightPct, 4)}%`,
                                background: m.amount > 0
                                  ? 'linear-gradient(180deg, #F59E0B 0%, #D97706 100%)'
                                  : 'rgba(255,255,255,0.04)',
                                minHeight: '4px',
                              }} />
                            <span className="text-[10px] text-white/40 font-bold">{m.month}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* ════════════════ TASKS ════════════════ */}
          {tab === 'tasks' && (
            <div className="animate-fadeInUp">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-black text-amber-500 uppercase tracking-tight">📋 Tasks</h2>
                  <p className="text-white/40 text-sm mt-1">Danh sách công việc được giao</p>
                </div>
                <div className="flex gap-2">
                  {['all', 'in_progress', 'completed', 'approved'].map(f => (
                    <button key={f} onClick={() => setTaskFilter(f)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                      style={{
                        background: taskFilter === f ? '#F59E0B15' : 'transparent',
                        color: taskFilter === f ? '#F59E0B' : '#666',
                        border: `1px solid ${taskFilter === f ? '#F59E0B30' : '#333'}`,
                      }}>
                      {f === 'all' ? 'Tất cả' : STATUS_LABELS[f]}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="text-center py-20"><p className="animate-pulse text-white/40">Đang tải...</p></div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-20 rounded-2xl" style={{ background: '#161616', border: '1px solid #222' }}>
                  <p className="text-4xl mb-3">📋</p>
                  <p className="text-white/30 font-bold">Chưa có task nào</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredTasks.map(t => {
                    const stColor = STATUS_COLORS[t.status] || '#888';
                    return (
                      <div key={t.id} className="p-5 rounded-2xl border hover:border-amber-500/20 transition-all"
                        style={{ background: '#161616', borderColor: '#222' }}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-[15px] mb-1 truncate">{t.title}</p>
                            <div className="flex items-center gap-3 text-white/40 text-xs">
                              <span>📁 {t.project}</span>
                              {t.client_name && <span>👤 {t.client_name}</span>}
                              {t.closed_date && <span>📅 {t.closed_date}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-lg font-black text-white">{fmt(t.price || 0)} <span className="text-xs text-white/30">{t.currency}</span></span>
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                              style={{ background: `${stColor}15`, color: stColor, border: `1px solid ${stColor}30` }}>
                              {STATUS_LABELS[t.status] || t.status}
                            </span>
                          </div>
                        </div>
                        {t.notes && <p className="text-white/30 text-xs mt-2 italic">📝 {t.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════════ SETTLEMENTS ════════════════ */}
          {tab === 'settlements' && (
            <div className="animate-fadeInUp">
              <div className="mb-6">
                <h2 className="text-3xl font-black text-amber-500 uppercase tracking-tight">📑 Nghiệm thu</h2>
                <p className="text-white/40 text-sm mt-1">Phiếu nghiệm thu & thanh toán</p>
              </div>

              {loading ? (
                <div className="text-center py-20"><p className="animate-pulse text-white/40">Đang tải...</p></div>
              ) : settlements.length === 0 ? (
                <div className="text-center py-20 rounded-2xl" style={{ background: '#161616', border: '1px solid #222' }}>
                  <p className="text-4xl mb-3">📑</p>
                  <p className="text-white/30 font-bold">Chưa có phiếu nghiệm thu</p>
                  <p className="text-white/15 text-sm mt-2">Phiếu sẽ hiện khi admin tạo nghiệm thu cho bạn</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {settlements.map(s => {
                    const st = SETTLEMENT_STATUS[s.status] || { label: s.status, color: '#888' };
                    return (
                      <button key={s.id} onClick={() => setSelectedSettlement(s)}
                        className="text-left p-5 rounded-2xl border hover:border-amber-500/20 transition-all group"
                        style={{ background: '#161616', borderColor: '#222' }}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-white/40 text-xs font-bold">Kỳ {s.period}</span>
                          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                            style={{ background: `${st.color}15`, color: st.color, border: `1px solid ${st.color}30` }}>
                            {st.label}
                          </span>
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-white/30 text-[10px] uppercase font-bold tracking-wider">Thực nhận</p>
                            <p className="text-2xl font-black text-emerald-400">{fmt(s.net_amount || 0)} <span className="text-xs text-white/30">{s.currency}</span></p>
                          </div>
                          <div className="text-right">
                            <p className="text-white/30 text-[10px] font-bold">{s.total_tasks} tasks</p>
                            <p className="text-amber-500/60 text-xs font-bold group-hover:text-amber-500 transition-all">Xem chi tiết →</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════════ PROFILE ════════════════ */}
          {tab === 'profile' && (
            <ProfileTab currentUser={currentUser} onToast={(msg, type) => setToast({ message: msg, type })} />
          )}

        </main>
        {toast && <ToastNotification message={{ text: toast.message, type: toast.type }} onDismiss={() => setToast(null)} />}
      </div>
    </div>
  );
};

export default FreelancerPortalApp;
