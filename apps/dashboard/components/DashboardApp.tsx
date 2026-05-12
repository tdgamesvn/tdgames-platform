import React, { useState, useEffect } from 'react';
import AppBackground from '@/components/AppBackground';
import { AccountUser } from '@/types';
import { Navbar } from '@/components/Navbar';
import { fetchCeoDashboard, CeoDashboardData, Alert } from '../services/dashboardService';
import TrendChart from './TrendChart';
import PlTable from './PlTable';

interface Props { currentUser: AccountUser; onBack: () => void; initialTab?: string | null }

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');
const fmtM = (n: number) => {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'tr';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'k';
  return n.toString();
};
const pctChange = (cur: number, prev: number) => {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS = [2024, 2025, 2026, 2027];

const DashboardApp: React.FC<Props> = ({ currentUser, onBack }) => {
  const [data, setData] = useState<CeoDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1);
  const [selYear, setSelYear] = useState(new Date().getFullYear());

  const load = () => {
    setLoading(true);
    fetchCeoDashboard(selMonth, selYear)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [selMonth, selYear]);

  return (
    <div className="min-h-screen bg-bg-dark relative overflow-hidden">
      <AppBackground />
      <Navbar theme="dark" currentUser={currentUser} activeTab="history"
        accessibleTabs={['history']} onTabChange={() => {}} onLogout={onBack} onBack={onBack}
        appName="CEO Dashboard" tabLabels={{ history: 'Tổng quan' }} />

      <main className="max-w-[1440px] mx-auto px-4 py-6 relative z-10">
        {/* ── Header + Month Filter ── */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">📊 CEO Dashboard</h1>
            <p className="text-neutral-medium text-sm mt-1">
              Xin chào <span className="text-primary font-bold">{currentUser.username}</span> — tổng quan TD Games
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select value={selMonth} onChange={e => setSelMonth(+e.target.value)}
              style={{ backgroundColor: '#1a1a2e', color: '#fff' }}
              className="border border-primary/20 text-xs rounded-lg px-3 py-2 font-bold focus:outline-none focus:border-primary appearance-none cursor-pointer">
              {MONTHS.map(m => <option key={m} value={m} style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>Tháng {m}</option>)}
            </select>
            <select value={selYear} onChange={e => setSelYear(+e.target.value)}
              style={{ backgroundColor: '#1a1a2e', color: '#fff' }}
              className="border border-primary/20 text-xs rounded-lg px-3 py-2 font-bold focus:outline-none focus:border-primary appearance-none cursor-pointer">
              {YEARS.map(y => <option key={y} value={y} style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>{y}</option>)}
            </select>
            <button onClick={load} className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition text-sm">🔄</button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : data ? (
          <div className="space-y-5">
            {/* ══════ Section 1: KPI Strip ══════ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon="💰" label="Doanh thu" value={fmtM(data.current.revenue)} suffix="đ"
                change={pctChange(data.current.revenue, data.prev.revenue)} gradient="from-emerald-500 to-teal-600" />
              <KpiCard icon="📉" label="Chi phí" value={fmtM(data.current.expense)} suffix="đ"
                change={pctChange(data.current.expense, data.prev.expense)} invertColor gradient="from-red-500 to-orange-600" />
              <KpiCard icon={data.current.profit >= 0 ? '📈' : '📉'} label="Lợi nhuận"
                value={`${data.current.profit >= 0 ? '+' : ''}${fmtM(data.current.profit)}`} suffix="đ"
                change={pctChange(data.current.profit, data.prev.profit)}
                gradient={data.current.profit >= 0 ? 'from-emerald-400 to-green-600' : 'from-red-400 to-red-600'} />
              <HealthCard score={data.healthScore} margin={data.current.marginPct} />
            </div>

            {/* ══════ Section 2: Chart + Alerts ══════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <TrendChart data={data.trend} />
              </div>
              <AlertCenter alerts={data.alerts} />
            </div>

            {/* ══════ Section 3: Business Modules ══════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Cash Flow */}
              <Panel title="Dòng tiền" icon="💰">
                <div className="space-y-3">
                  <FlowRow label="Thu tháng này" value={fmt(data.current.revenue)} suffix="đ" color="text-emerald-400" />
                  <FlowRow label="Chi tháng này" value={`-${fmt(data.current.expense)}`} suffix="đ" color="text-red-400" />
                  <div className="border-t border-white/10 pt-2">
                    <FlowRow label="Net cash flow" value={`${data.current.profit >= 0 ? '+' : ''}${fmt(data.current.profit)}`}
                      suffix="đ" color={data.current.profit >= 0 ? 'text-emerald-400' : 'text-red-400'} bold />
                  </div>
                  <div className="border-t border-white/5 pt-2 space-y-2">
                    <FlowRow label={`🔴 Công nợ phải thu (${data.cashFlow.receivableCount} HĐ)`}
                      value={fmt(data.cashFlow.receivable)} suffix="đ" color="text-orange-400" />
                    <FlowRow label="🟡 Workforce chưa TT" value={fmt(data.cashFlow.workforcePayable)} suffix="đ" color="text-yellow-400" />
                    <FlowRow label="💵 Quỹ lương" value={fmt(data.cashFlow.payrollCost)} suffix="đ" color="text-indigo-400" />
                  </div>
                </div>
              </Panel>

              {/* Team */}
              <Panel title="Nhân sự & Năng suất" icon="👥">
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-neutral-medium text-xs">Headcount</span>
                    <span className="text-white font-black text-xl">{data.current.headcount} <span className="text-xs text-neutral-medium font-normal">người</span></span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-neutral-medium text-xs">Revenue/người</span>
                    <span className="text-emerald-400 font-bold text-sm">{fmtM(data.current.revenuePerHead)} đ</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-neutral-medium text-xs">Tasks tháng</span>
                    <span className="text-white font-bold text-sm">{data.current.tasksCompleted}/{data.current.tasksTotal}
                      <span className="text-emerald-400 ml-1">({data.current.tasksTotal > 0 ? Math.round(data.current.tasksCompleted / data.current.tasksTotal * 100) : 0}%)</span>
                    </span>
                  </div>
                  <div className="border-t border-white/5 pt-2 space-y-1.5">
                    {data.team.departments.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <span className="text-white text-xs">{d.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500"
                              style={{ width: `${(d.count / data.current.headcount) * 100}%` }} />
                          </div>
                          <span className="text-white font-bold text-[10px] w-4 text-right">{d.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {data.team.latestPayroll && (
                    <div className="border-t border-white/5 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-medium text-[10px]">{data.team.latestPayroll.title}</span>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                          data.team.latestPayroll.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>{data.team.latestPayroll.status === 'confirmed' ? 'Đã XN' : data.team.latestPayroll.status}</span>
                      </div>
                      <p className="text-white font-bold text-sm mt-1">{fmt(data.team.latestPayroll.totalCost)} đ</p>
                    </div>
                  )}
                </div>
              </Panel>

              {/* Pipeline */}
              <Panel title="Pipeline & Tăng trưởng" icon="📈">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat label="Clients" value={`${data.pipeline.activeClients}`} />
                    <MiniStat label="Projects" value={`${data.pipeline.activeProjects}`} />
                  </div>
                  {data.pipeline.pipelineValue > 0 && (
                    <FlowRow label="Pipeline value" value={fmtM(data.pipeline.pipelineValue)} suffix="đ" color="text-purple-400" />
                  )}
                  <div className="border-t border-white/5 pt-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-medium mb-2">OUTREACH</p>
                    <div className="grid grid-cols-2 gap-2">
                      <MiniStat label="Tổng leads" value={`${data.pipeline.outreachLeads}`} />
                      <MiniStat label="Tier 1" value={`${data.pipeline.outreachTier1}`} color="#34C759" />
                      <MiniStat label="Emails sent" value={`${data.pipeline.emailsSent}`} />
                      <MiniStat label="New tháng này" value={`${data.pipeline.newLeadsThisMonth}`} color="#0A84FF" />
                    </div>
                  </div>
                </div>
              </Panel>
            </div>

            {/* ══════ Section 4: P&L Table ══════ */}
            <PlTable trend={data.trend} />
          </div>
        ) : (
          <p className="text-red-400 text-center py-16">Không thể tải dữ liệu dashboard</p>
        )}
      </main>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════

const KpiCard: React.FC<{
  icon: string; label: string; value: string; suffix: string;
  change?: number; gradient: string; invertColor?: boolean;
}> = ({ icon, label, value, suffix, change, gradient, invertColor }) => {
  const hasChange = change !== undefined && change !== 0;
  const isPositive = invertColor ? change! < 0 : change! > 0;
  return (
    <div className="p-4 rounded-2xl bg-card-dark border border-primary/10 relative overflow-hidden group hover:border-primary/20 transition-all">
      <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-10 bg-gradient-to-br ${gradient}`} />
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-base">{icon}</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-black text-white">{value}</span>
        {suffix && <span className="text-[10px] font-bold text-neutral-medium">{suffix}</span>}
      </div>
      {hasChange && (
        <p className={`text-[10px] font-bold mt-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(change!).toFixed(0)}% vs tháng trước
        </p>
      )}
    </div>
  );
};

const HealthCard: React.FC<{ score: number; margin: number }> = ({ score, margin }) => {
  const color = score >= 75 ? '#34C759' : score >= 50 ? '#FFD60A' : '#FF3B30';
  const label = score >= 75 ? 'Tốt' : score >= 50 ? 'Cần chú ý' : 'Cảnh báo';
  const circumference = 2 * Math.PI * 32;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="p-4 rounded-2xl bg-card-dark border border-primary/10 flex items-center gap-3">
      <div className="relative w-[72px] h-[72px] flex-shrink-0">
        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
          <circle cx="36" cy="36" r="32" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
          <circle cx="36" cy="36" r="32" fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-1000" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-black text-white">{score}</span>
        </div>
      </div>
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-medium">Health Score</p>
        <p className="font-black text-sm" style={{ color }}>{label}</p>
        <p className="text-[10px] text-neutral-medium mt-0.5">Biên LN: <span className="text-white font-bold">{margin.toFixed(0)}%</span></p>
      </div>
    </div>
  );
};

const AlertCenter: React.FC<{ alerts: Alert[] }> = ({ alerts }) => (
  <div className="p-5 rounded-2xl bg-card-dark border border-primary/10 h-full">
    <h3 className="text-xs font-black uppercase tracking-widest text-white mb-3">⚠️ Cảnh báo & Hành động</h3>
    {alerts.length === 0 ? (
      <p className="text-neutral-medium text-sm text-center py-6">✅ Không có cảnh báo</p>
    ) : (
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <div key={i} className={`flex items-start gap-2 p-2.5 rounded-xl text-xs ${
            a.level === 'critical' ? 'bg-red-500/10 border border-red-500/20' :
            a.level === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/20' :
            a.level === 'good' ? 'bg-emerald-500/10 border border-emerald-500/20' :
            'bg-blue-500/10 border border-blue-500/20'
          }`}>
            <span className="text-sm flex-shrink-0">{a.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium">{a.message}</p>
              {a.value && <p className="text-neutral-medium font-bold mt-0.5">{a.value}</p>}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const Panel: React.FC<{ title: string; icon: string; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="p-5 rounded-2xl bg-card-dark border border-primary/10">
    <div className="flex items-center gap-2 mb-4">
      <span className="text-lg">{icon}</span>
      <h3 className="text-xs font-black uppercase tracking-widest text-white">{title}</h3>
    </div>
    {children}
  </div>
);

const FlowRow: React.FC<{ label: string; value: string; suffix: string; color: string; bold?: boolean; small?: boolean }> = ({ label, value, suffix, color, bold, small }) => (
  <div className="flex justify-between items-baseline">
    <span className={`text-neutral-medium ${small ? 'text-[10px]' : 'text-xs'}`}>{label}</span>
    <span className={`${color} ${bold ? 'font-black text-base' : 'font-bold text-sm'} tabular-nums`}>
      {value} {suffix && <span className="text-[10px] font-normal">{suffix}</span>}
    </span>
  </div>
);

const MiniStat: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div className="text-center p-2 rounded-xl bg-white/[0.03]">
    <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-medium mb-1">{label}</p>
    <p className="text-sm font-black" style={{ color: color || 'white' }}>{value}</p>
  </div>
);

export default DashboardApp;
