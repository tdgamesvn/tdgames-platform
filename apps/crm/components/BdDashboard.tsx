import React, { useState, useEffect } from 'react';
import type { AccountUser, CrmClient, CrmDeal, CrmActivity } from '@/types';
import { fetchDeals, fetchActivities } from '../services/crmService';
import { STAGES, STAGE_MAP, fmtValue, fmtDate } from './pipeline/constants';

// ── Helpers ───────────────────────────────────────────────────

const daysSince = (d: string): number =>
  Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000));

const daysUntil = (d: string): number =>
  Math.floor((new Date(d).getTime() - Date.now()) / 86_400_000);

const fmtRelative = (d: string): string => {
  const days = daysUntil(d);
  if (days < 0) return `${Math.abs(days)} ngày trước`;
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Ngày mai';
  return `${days} ngày nữa`;
};

const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  call:          { icon: '📞', label: 'Gọi điện',    color: '#34C759' },
  email:         { icon: '📧', label: 'Email',       color: '#0A84FF' },
  meeting:       { icon: '🤝', label: 'Meeting',     color: '#FF9500' },
  note:          { icon: '📝', label: 'Ghi chú',     color: '#AF52DE' },
  status_change: { icon: '🔄', label: 'Đổi trạng thái', color: '#FF3B30' },
};

// ── Props ─────────────────────────────────────────────────────

interface Props {
  currentUser: AccountUser;
  clients: CrmClient[];
  onSwitchTab: (tab: string) => void;
}

// ── BD Perf Total Row ─────────────────────────────────────────
const BdPerfTotalRow: React.FC<{ bdPerf: any[] }> = ({ bdPerf }) => {
  const totActive = bdPerf.reduce((s: number, b: any) => s + b.active, 0);
  const totWon = bdPerf.reduce((s: number, b: any) => s + b.won, 0);
  const totLost = bdPerf.reduce((s: number, b: any) => s + b.lost, 0);
  const totWonVal = bdPerf.reduce((s: number, b: any) => s + b.wonVal, 0);
  const totClosed = totWon + totLost;
  const totWr = totClosed > 0 ? Math.round((totWon / totClosed) * 100) : 0;
  const allDays: number[] = bdPerf.flatMap((b: any) => b.closeDays);
  const avgAll = allDays.length > 0 ? Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length) : 0;
  return (
    <div className="grid grid-cols-6 gap-2 pt-2 mt-2 border-t border-white/5">
      <p className="text-[10px] font-black uppercase text-neutral-500">Tổng</p>
      <span className="text-xs font-black text-white">{totActive}</span>
      <div>
        <span className="text-xs font-black text-status-success">{totWon}</span>
        {totWonVal > 0 && <p className="text-[9px] text-neutral-600">{fmtValue(totWonVal, 'USD')}</p>}
      </div>
      <span className="text-xs font-black text-neutral-400">{totLost}</span>
      <span className={`text-xs font-black ${totWr >= 50 ? 'text-status-success' : 'text-status-warning'}`}>
        {totClosed > 0 ? `${totWr}%` : '—'}
      </span>
      <span className="text-xs font-black text-neutral-400">{avgAll > 0 ? `${avgAll}d` : '—'}</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// BD DASHBOARD
// ═══════════════════════════════════════════════════════════════

const BdDashboard: React.FC<Props> = ({ currentUser, clients, onSwitchTab }) => {
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchDeals().catch(() => []),
      fetchActivities(undefined, 8).catch(() => []),
    ]).then(([d, a]) => {
      setDeals(d);
      setActivities(a);
    }).finally(() => setLoading(false));
  }, []);

  // ── Derived stats ──────────────────────────────────────────
  const activeDeals = deals.filter(d => !['won', 'lost'].includes(d.stage));
  const pipelineValue = activeDeals.reduce((s, d) => s + d.value, 0);
  const wonDeals = deals.filter(d => d.stage === 'won');
  const totalWon = wonDeals.reduce((s, d) => s + d.value, 0);
  const closedDeals = deals.filter(d => ['won', 'lost'].includes(d.stage));
  const winRate = closedDeals.length > 0 ? Math.round((wonDeals.length / closedDeals.length) * 100) : 0;
  const activeClients = clients.filter(c => c.status === 'active').length;

  // Stage breakdown for funnel
  const stageCounts = STAGES.filter(s => !['won', 'lost'].includes(s.key)).map(s => {
    const stageDeals = activeDeals.filter(d => d.stage === s.key);
    return { ...s, count: stageDeals.length, value: stageDeals.reduce((sum, d) => sum + d.value, 0) };
  });
  const maxCount = Math.max(...stageCounts.map(s => s.count), 1);

  // Stale deals (>14 days in same stage, active only)
  const staleDeals = activeDeals
    .filter(d => daysSince(d.updated_at) > 14)
    .sort((a, b) => daysSince(b.updated_at) - daysSince(a.updated_at))
    .slice(0, 5);

  // Upcoming closes (next 14 days, active deals with expected_close_date)
  const upcomingCloses = activeDeals
    .filter(d => d.expected_close_date && daysUntil(d.expected_close_date) <= 14)
    .sort((a, b) => new Date(a.expected_close_date).getTime() - new Date(b.expected_close_date).getTime())
    .slice(0, 5);

  // Follow-up reminders (overdue + today + next 3 days)
  const followUpDeals = activeDeals
    .filter(d => d.next_follow_up)
    .filter(d => daysUntil(d.next_follow_up!) <= 3)
    .sort((a, b) => new Date(a.next_follow_up!).getTime() - new Date(b.next_follow_up!).getTime());

  // ── BD Performance stats ────────────────────────────────────
  type BdStat = { name: string; active: number; won: number; lost: number; pipelineVal: number; wonVal: number; avgDaysToClose: number; closeDays: number[] };
  const bdPerf = (() => {
    const owners: Map<string, BdStat> = new Map();
    deals.forEach(d => {
      const name = d.owner_name || 'Chưa gán';
      if (!owners.has(name)) owners.set(name, { name, active: 0, won: 0, lost: 0, pipelineVal: 0, wonVal: 0, avgDaysToClose: 0, closeDays: [] });
      const o = owners.get(name)!;
      if (d.stage === 'won') {
        o.won++;
        o.wonVal += d.value;
        if (d.actual_close_date && d.created_at) {
          const days = Math.max(1, Math.floor((new Date(d.actual_close_date).getTime() - new Date(d.created_at).getTime()) / 86_400_000));
          o.closeDays.push(days);
        }
      } else if (d.stage === 'lost') {
        o.lost++;
      } else {
        o.active++;
        o.pipelineVal += d.value;
      }
    });
    owners.forEach(o => {
      o.avgDaysToClose = o.closeDays.length > 0 ? Math.round(o.closeDays.reduce((a, b) => a + b, 0) / o.closeDays.length) : 0;
    });
    return [...owners.values()].sort((a, b) => b.wonVal - a.wonVal);
  })();

  // Client map for activity feed
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));

  if (loading) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-600 text-sm animate-td-pulse">Đang tải dashboard...</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeInUp space-y-6">
      {/* ── Greeting ── */}
      <div>
        <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>
          Xin chào, {currentUser.username}
        </h2>
        <p className="text-sm text-neutral-medium mt-1">Tổng quan CRM hôm nay</p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pipeline', value: fmtValue(pipelineValue, 'USD'), sub: `${activeDeals.length} deals đang xử lý`, color: 'text-white' },
          { label: 'Tổng Won', value: fmtValue(totalWon, 'USD'), sub: `${wonDeals.length} deals`, color: 'text-status-success' },
          { label: 'Win Rate', value: `${winRate}%`, sub: closedDeals.length > 0 ? `${wonDeals.length}W / ${closedDeals.length - wonDeals.length}L` : 'Chưa có data', color: 'text-white' },
          { label: 'Khách hàng', value: `${activeClients}`, sub: `/ ${clients.length} tổng`, color: 'text-white' },
        ].map(c => (
          <div key={c.label} className="rounded-[20px] border border-primary/10 p-4 space-y-1 bg-surface">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{c.label}</p>
            <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
            {c.sub && <p className="text-xs font-semibold text-neutral-500">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Main layout: 2 columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ════ LEFT COLUMN (2/3) ════ */}
        <div className="lg:col-span-2 space-y-6">

          {/* Follow-up Reminders */}
          {followUpDeals.length > 0 && (
            <div className="rounded-[20px] border p-5" style={{ background: 'rgba(255,149,0,0.03)', borderColor: 'rgba(255,149,0,0.12)' }}>
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-3">
                📌 Follow-up ({followUpDeals.length})
              </p>
              <div className="space-y-2">
                {followUpDeals.map(deal => {
                  const fuDays = daysUntil(deal.next_follow_up!);
                  const stage = STAGE_MAP[deal.stage];
                  return (
                    <div key={`fu-${deal.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all cursor-pointer"
                      style={{ background: 'rgba(255,255,255,0.02)' }}
                      onClick={() => onSwitchTab('deals')}
                    >
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${
                        fuDays < 0 ? 'bg-red-500/15 text-red-400' :
                        fuDays === 0 ? 'bg-orange-500/15 text-orange-400' :
                        'bg-blue-500/15 text-blue-400'
                      }`}>
                        {fuDays < 0 ? `Quá ${Math.abs(fuDays)}d` : fuDays === 0 ? 'Hôm nay' : `${fuDays}d nữa`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{deal.title}</p>
                        <p className="text-[10px] text-neutral-600">{deal.client_name}</p>
                      </div>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background: `${stage.color}20`, color: stage.color }}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pipeline Funnel */}
          <div className="rounded-[20px] border border-primary/10 p-5 bg-surface">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Pipeline Funnel</p>
              <button
                onClick={() => onSwitchTab('deals')}
                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"
              >
                Xem board →
              </button>
            </div>
            <div className="space-y-2.5">
              {stageCounts.map(s => (
                <div key={s.key} className="flex items-center gap-3">
                  <div className="w-24 flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs">{s.icon}</span>
                    <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: s.color }}>{s.label}</span>
                  </div>
                  <div className="flex-1 h-6 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div
                      className="h-full rounded-lg flex items-center px-2 transition-all"
                      style={{
                        width: `${Math.max((s.count / maxCount) * 100, s.count > 0 ? 8 : 0)}%`,
                        background: `${s.color}30`,
                        minWidth: s.count > 0 ? '32px' : '0',
                      }}
                    >
                      {s.count > 0 && (
                        <span className="text-[10px] font-black" style={{ color: s.color }}>{s.count}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-neutral-600 font-semibold w-20 text-right flex-shrink-0">
                    {s.value > 0 ? fmtValue(s.value, 'USD') : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Deals Needing Attention */}
          <div className="rounded-[20px] border border-primary/10 p-5 bg-surface">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-4">
              Cần chú ý ({staleDeals.length + upcomingCloses.length})
            </p>

            {staleDeals.length === 0 && upcomingCloses.length === 0 ? (
              <div className="text-center py-6 text-neutral-700">
                <p className="text-2xl mb-1">✅</p>
                <p className="text-[10px] font-semibold">Không có deal nào cần chú ý</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Overdue close dates */}
                {upcomingCloses.filter(d => daysUntil(d.expected_close_date) < 0).map(deal => {
                  const stage = STAGE_MAP[deal.stage];
                  return (
                    <div key={`overdue-${deal.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-red-500/20 hover:border-red-500/30 transition-all cursor-pointer"
                      style={{ background: 'rgba(244,67,54,0.03)' }}
                      onClick={() => onSwitchTab('deals')}
                    >
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-red-500/15 text-red-400">QUÁ HẠN</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{deal.title}</p>
                        <p className="text-[10px] text-neutral-600">{deal.client_name} • {fmtRelative(deal.expected_close_date)}</p>
                      </div>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background: `${stage.color}20`, color: stage.color }}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}

                {/* Upcoming close dates */}
                {upcomingCloses.filter(d => daysUntil(d.expected_close_date) >= 0).map(deal => {
                  const stage = STAGE_MAP[deal.stage];
                  const days = daysUntil(deal.expected_close_date);
                  return (
                    <div key={`close-${deal.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all cursor-pointer"
                      style={{ background: 'rgba(255,255,255,0.02)' }}
                      onClick={() => onSwitchTab('deals')}
                    >
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${
                        days <= 3 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-blue-500/15 text-blue-400'
                      }`}>
                        {fmtRelative(deal.expected_close_date)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{deal.title}</p>
                        <p className="text-[10px] text-neutral-600">{deal.client_name}</p>
                      </div>
                      <span className="text-xs font-black text-white">{fmtValue(deal.value, deal.currency)}</span>
                    </div>
                  );
                })}

                {/* Stale deals */}
                {staleDeals.map(deal => {
                  const stage = STAGE_MAP[deal.stage];
                  const days = daysSince(deal.updated_at);
                  return (
                    <div key={`stale-${deal.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all cursor-pointer"
                      style={{ background: 'rgba(255,255,255,0.02)' }}
                      onClick={() => onSwitchTab('deals')}
                    >
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${
                        days > 30 ? 'bg-red-500/15 text-red-400' : 'bg-yellow-500/15 text-yellow-400'
                      }`}>
                        {days}d
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{deal.title}</p>
                        <p className="text-[10px] text-neutral-600">{deal.client_name} • Không cập nhật {days} ngày</p>
                      </div>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background: `${stage.color}20`, color: stage.color }}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* BD Performance Report */}
          {bdPerf.length > 0 && (
            <div className="rounded-[20px] border border-primary/10 p-5 bg-surface">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-4">📊 Hiệu suất BD</p>

              {/* Table header */}
              <div className="grid grid-cols-6 gap-2 pb-2 border-b border-white/5 mb-2">
                {['BD', 'Active', 'Won', 'Lost', 'Win Rate', 'Avg Close'].map(h => (
                  <p key={h} className="text-[9px] font-black uppercase tracking-wider text-neutral-700">{h}</p>
                ))}
              </div>

              {/* Rows */}
              <div className="space-y-1">
                {bdPerf.map(bd => {
                  const total = bd.won + bd.lost;
                  const wr = total > 0 ? Math.round((bd.won / total) * 100) : 0;
                  return (
                    <div key={bd.name} className="grid grid-cols-6 gap-2 py-2 rounded-lg hover:bg-white/5 transition-all">
                      <p className="text-xs font-semibold text-white truncate">{bd.name}</p>
                      <div>
                        <span className="text-xs font-semibold text-white">{bd.active}</span>
                        {bd.pipelineVal > 0 && (
                          <p className="text-[9px] text-neutral-600">{fmtValue(bd.pipelineVal, 'USD')}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-black text-status-success">{bd.won}</span>
                        {bd.wonVal > 0 && (
                          <p className="text-[9px] text-neutral-600">{fmtValue(bd.wonVal, 'USD')}</p>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-neutral-400">{bd.lost}</span>
                      <span className={`text-xs font-black ${wr >= 50 ? 'text-status-success' : wr > 0 ? 'text-status-warning' : 'text-neutral-600'}`}>
                        {total > 0 ? `${wr}%` : '—'}
                      </span>
                      <span className="text-xs font-semibold text-neutral-400">
                        {bd.avgDaysToClose > 0 ? `${bd.avgDaysToClose}d` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Total row */}
              {bdPerf.length > 1 && <BdPerfTotalRow bdPerf={bdPerf} />}
            </div>
          )}
        </div>

        {/* ════ RIGHT COLUMN (1/3) ════ */}
        <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-4">

          {/* Recent Activities */}
          <div className="rounded-[20px] border p-5" style={{ background: 'rgba(255,149,0,0.03)', borderColor: 'rgba(255,149,0,0.12)' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Hoạt động gần đây</p>
              <button
                onClick={() => onSwitchTab('activities')}
                className="text-[10px] font-black uppercase tracking-wider text-orange-400/60 hover:text-orange-400 transition-colors"
              >
                Tất cả →
              </button>
            </div>

            {activities.length === 0 ? (
              <div className="text-center py-6 text-neutral-700">
                <p className="text-2xl mb-1">📋</p>
                <p className="text-[10px] font-semibold">Chưa có hoạt động</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activities.slice(0, 6).map(act => {
                  const meta = TYPE_META[act.activity_type] || TYPE_META.note;
                  return (
                    <div key={act.id} className="flex gap-2.5 items-start p-2 rounded-lg hover:bg-white/5 transition-all">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs flex-shrink-0"
                        style={{ background: `${meta.color}15` }}>
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-white truncate">{act.title}</p>
                        <p className="text-[10px] text-neutral-600 truncate">
                          {clientMap[act.client_id] || '—'} • {fmtDate(act.activity_date)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Won deals summary */}
          {wonDeals.length > 0 && (
            <div className="rounded-[20px] border border-primary/10 p-5 bg-surface">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-3">Deals đã thắng</p>
              <div className="space-y-2">
                {wonDeals.slice(0, 4).map(deal => (
                  <div key={deal.id} className="flex items-center justify-between p-2 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-white truncate">{deal.title}</p>
                      <p className="text-[10px] text-neutral-600">{deal.client_name}</p>
                    </div>
                    <span className="text-xs font-black text-status-success whitespace-nowrap ml-2">
                      {fmtValue(deal.value, deal.currency)}
                    </span>
                  </div>
                ))}
                {wonDeals.length > 4 && (
                  <p className="text-[10px] text-neutral-600 text-center">+{wonDeals.length - 4} deals khác</p>
                )}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="rounded-[20px] border border-primary/10 p-5 space-y-2 bg-surface">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-3">Hành động nhanh</p>
            {[
              { label: '+ Tạo deal mới', tab: 'deals', icon: '🎯' },
              { label: 'Xem tài liệu', tab: 'documents', icon: '📁' },
              { label: 'Email Outreach', tab: 'outreach', icon: '📧' },
            ].map(a => (
              <button key={a.tab} onClick={() => onSwitchTab(a.tab)}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left hover:bg-white/5 transition-all">
                <span className="text-sm">{a.icon}</span>
                <span className="text-xs font-semibold text-neutral-300">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BdDashboard;
