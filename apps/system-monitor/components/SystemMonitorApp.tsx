// apps/system-monitor/components/SystemMonitorApp.tsx
import React, { useState, useEffect, useCallback } from 'react';
import AppBackground from '@/components/AppBackground';
import { Navbar } from '@/components/Navbar';
import { AccountUser } from '@/types';
import {
  fetchLatestHealthChecks,
  triggerHealthCheck,
  HealthCheck,
} from '../services/systemMonitorService';

interface Props {
  currentUser: AccountUser;
  onBack: () => void;
}

const STATUS_CFG = {
  up:       { label: 'UP',       color: '#4CAF50', bg: 'rgba(76,175,80,0.12)',  border: 'rgba(76,175,80,0.25)',  dot: '🟢' },
  degraded: { label: 'DEGRADED', color: '#FFA726', bg: 'rgba(255,167,38,0.10)', border: 'rgba(255,167,38,0.25)', dot: '🟡' },
  down:     { label: 'DOWN',     color: '#F44336', bg: 'rgba(244,67,54,0.10)',  border: 'rgba(244,67,54,0.25)',  dot: '🔴' },
} as const;

const SERVICE_ICONS: Record<string, string> = {
  supabase: '🗄️',
  'app.tdgamestudio.com': '🌐',
  '9router.tdgamestudio.com': '🤖',
  'cliproxy.tdgamestudio.com': '🔗',
  'gog.tdgamestudio.com': '🎮',
  'openclaw.tdgamestudio.com': '🦅',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m}p trước`;
  return `${Math.floor(m / 60)}h trước`;
}

const SystemMonitorApp: React.FC<Props> = ({ currentUser, onBack }) => {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchLatestHealthChecks();
      setChecks(data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(() => load(true), 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleRunCheck = async () => {
    setRunning(true);
    const res = await triggerHealthCheck();
    if (res.ok) {
      setToast({ msg: 'Đang chạy kiểm tra — kết quả sẽ có sau vài giây...', ok: true });
      setTimeout(() => load(true), 5000);
    } else {
      setToast({ msg: `Lỗi: ${res.error?.slice(0, 80)}`, ok: false });
    }
    setRunning(false);
  };

  const up = checks.filter(c => c.status === 'up').length;
  const down = checks.filter(c => c.status === 'down').length;
  const degraded = checks.filter(c => c.status === 'degraded').length;
  const overallOk = down === 0 && degraded === 0;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fadeInUp">
          <div className={`px-4 py-3 rounded-xl text-sm font-semibold border ${
            toast.ok
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {toast.msg}
          </div>
        </div>
      )}

      <Navbar
        theme="dark"
        currentUser={currentUser}
        onLogout={onBack}
        onBack={onBack}
        appName="System Monitor"
        activeTab=""
        accessibleTabs={[]}
        onTabChange={() => {}}
        tabLabels={{}}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 relative z-10">
        {/* ── Overall status hero ───────────────────────────── */}
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: overallOk
              ? 'linear-gradient(135deg, rgba(76,175,80,0.07) 0%, rgba(255,255,255,0.02) 60%)'
              : 'linear-gradient(135deg, rgba(244,67,54,0.08) 0%, rgba(255,255,255,0.02) 60%)',
            border: `1px solid ${overallOk ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)'}`,
          }}>
          <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${overallOk ? '#4CAF50' : '#F44336'}, transparent)` }} />
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{
                  background: overallOk ? 'rgba(76,175,80,0.12)' : 'rgba(244,67,54,0.12)',
                  border: `1px solid ${overallOk ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)'}`,
                  boxShadow: `0 0 20px ${overallOk ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)'}`,
                }}>
                {overallOk ? '✅' : '🚨'}
              </div>
              <div>
                <h1 className="text-lg font-black text-white">
                  {loading ? 'Đang kiểm tra...' : overallOk ? 'Tất cả hệ thống hoạt động bình thường' : `${down} dịch vụ gặp sự cố`}
                </h1>
                <p className="text-xs text-neutral-medium mt-0.5">
                  {checks.length} dịch vụ được giám sát
                  {lastRefresh && ` • Cập nhật ${timeAgo(lastRefresh.toISOString())}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleRunCheck}
              disabled={running}
              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50 shrink-0"
              style={{ background: 'linear-gradient(135deg, #FF9500, #FF6B00)', boxShadow: running ? 'none' : '0 4px 16px rgba(255,149,0,0.3)' }}
            >
              {running ? '⟳ Đang chạy...' : '▶ Kiểm tra ngay'}
            </button>
          </div>
        </div>

        {/* ── Summary KPI strip ─────────────────────────────── */}
        {!loading && checks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Hoạt động', value: up, color: '#4CAF50', icon: '✓' },
              { label: 'Có vấn đề', value: degraded, color: '#FFA726', icon: '⚠' },
              { label: 'Ngừng hoạt động', value: down, color: '#F44336', icon: '✕' },
            ].map((kpi, i) => (
              <div key={i} className="rounded-2xl border border-white/8 overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.025)' }}>
                <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${kpi.color}, transparent)` }} />
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{kpi.label}</p>
                    <span className="text-xs font-black" style={{ color: kpi.color }}>{kpi.icon}</span>
                  </div>
                  <p className="text-[26px] leading-none font-black text-white">{kpi.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Service cards grid ────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : checks.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-2xl mb-3">📡</p>
            <p className="text-neutral-500 text-sm font-semibold">Chưa có dữ liệu monitoring</p>
            <p className="text-xs text-neutral-700 mt-1 mb-6">Nhấn "Kiểm tra ngay" để bắt đầu</p>
            <button onClick={handleRunCheck} disabled={running}
              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
              style={{ background: '#FF9500' }}>
              {running ? 'Đang chạy...' : '▶ Chạy kiểm tra'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {checks.map(check => {
              const cfg = STATUS_CFG[check.status] ?? STATUS_CFG.degraded;
              const icon = SERVICE_ICONS[check.service_name] ?? '🖥️';
              const maxLatency = 3000;
              const latencyPct = check.latency_ms
                ? Math.min(100, (check.latency_ms / maxLatency) * 100)
                : 0;
              const latencyColor = !check.latency_ms ? '#444'
                : check.latency_ms < 500 ? '#4CAF50'
                : check.latency_ms < 1500 ? '#FFA726'
                : '#F44336';

              return (
                <div key={check.id} className="rounded-2xl border overflow-hidden transition-all hover:border-white/15"
                  style={{ background: cfg.bg, borderColor: cfg.border }}>
                  <div className="flex">
                    <div className="w-[3px] shrink-0" style={{ background: cfg.color }} />
                    <div className="flex-1 p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{icon}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white truncate">{check.service_name}</p>
                            <p className="text-[10px] text-neutral-600 uppercase tracking-wider">{check.service_type}</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg shrink-0"
                          style={{ background: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                          {cfg.dot} {cfg.label}
                        </span>
                      </div>

                      {/* Latency bar */}
                      {check.latency_ms !== null && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] text-neutral-600 font-semibold">Latency</p>
                            <p className="text-[10px] font-black" style={{ color: latencyColor }}>
                              {check.latency_ms}ms
                            </p>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${latencyPct}%`, background: latencyColor }} />
                          </div>
                        </div>
                      )}

                      {/* Error */}
                      {check.error_msg && (
                        <p className="text-[10px] text-red-400/80 truncate mb-2">{check.error_msg}</p>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-neutral-700">{timeAgo(check.checked_at)}</p>
                        {check.status_code && (
                          <span className="text-[10px] font-mono text-neutral-600">HTTP {check.status_code}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default SystemMonitorApp;
