import React, { useState, useEffect } from 'react';
import type { AccountUser, CrmClient, CrmDeal, CrmActivity, CrmBdTarget } from '@/types';
import { fetchDeals, fetchActivities, fetchApprovedContracts, fetchBdTargets, upsertBdTarget, currentPeriod } from '../services/crmService';
import { getWorkspace, matchesWorkspace, useWorkspace } from '@/services/WorkspaceContext';
import { supabase } from '@/services/supabaseClient';
import { hasRole, hasAnyRole } from '@/utils/roleUtils';
import { STAGES, STAGE_MAP, fmtValue, fmtDate } from './pipeline/constants';

// ── Date preset filter ────────────────────────────────────────

type DatePreset = 'this_month' | 'last_month' | 'this_quarter' | 'all';

function getDateRange(preset: DatePreset): { start: Date | null; end: Date | null } {
  const now = new Date();
  if (preset === 'all') return { start: null, end: null };
  if (preset === 'this_month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }
  if (preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start, end };
  }
  // this_quarter
  const quarter = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), quarter * 3, 1);
  return { start, end: now };
}

function inRange(dateStr: string | null | undefined, start: Date | null, end: Date | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

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
  const totContract = bdPerf.reduce((s: number, b: any) => s + (b.contractVal ?? 0), 0);
  const totClosed = totWon + totLost;
  const totWr = totClosed > 0 ? Math.round((totWon / totClosed) * 100) : 0;
  const allDays: number[] = bdPerf.flatMap((b: any) => b.closeDays);
  const avgAll = allDays.length > 0 ? Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length) : 0;
  return (
    <div className="grid grid-cols-7 gap-2 pt-2 mt-2 border-t border-white/5">
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
      <span className="text-xs font-black" style={{ color: '#22c55e' }}>
        {totContract > 0 ? fmtValue(totContract, 'USD') : '—'}
      </span>
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
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [myStudiosCount, setMyStudiosCount] = useState(0);
  const [approvedContracts, setApprovedContracts] = useState<Array<{ id: number; created_by: string; contract_value: number | null; contract_currency: string | null }>>([]);
  const [meetingClientIds, setMeetingClientIds] = useState<Set<string>>(new Set());
  const [quotedClientIds, setQuotedClientIds] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState<CrmBdTarget[]>([]);
  const [targetInput, setTargetInput] = useState('');
  const { workspace } = useWorkspace();

  useEffect(() => {
    Promise.all([
      fetchDeals().catch(() => []),
      fetchActivities(undefined, 8).catch(() => []),
      fetchApprovedContracts().catch(() => []),
      supabase.from('crm_studios').select('id', { count: 'exact', head: true }).eq('owner_id', currentUser.id),
      // Conversion-theo-nguồn: cần biết client nào từng có meeting / từng được gửi báo giá
      // (toàn thời gian, không phụ thuộc date preset) — chỉ lấy client_id, không cần full row.
      supabase.from('crm_activities').select('client_id').eq('activity_type', 'meeting'),
      supabase.from('crm_quotations').select('client_id, status'),
      fetchBdTargets(currentPeriod()).catch(() => []),
    ]).then(([d, a, contracts, studiosRes, meetingsRes, quotationsRes, bdTargets]) => {
      // Ghi chú thương lượng (notes) là riêng tư — BD thuần (không kiêm admin/ke_toan) không đọc được
      // notes của deal người khác, dù vẫn thấy số liệu tổng hợp (title/value/stage) để so sánh hiệu suất.
      const isBdOnly = hasRole(currentUser, 'bd') && !hasAnyRole(currentUser, ['admin', 'ke_toan']);
      const dd = isBdOnly ? d.map(x => x.owner_id === currentUser.id ? x : { ...x, notes: '' }) : d;
      setDeals(dd);
      setActivities(a);
      setApprovedContracts(contracts);
      setMyStudiosCount(studiosRes.count ?? 0);
      setMeetingClientIds(new Set((meetingsRes.data || []).map((r: any) => r.client_id)));
      // "Gửi báo giá" = có báo giá đã ra khỏi draft (sent/accepted/rejected/expired)
      setQuotedClientIds(new Set((quotationsRes.data || []).filter((r: any) => r.status !== 'draft').map((r: any) => r.client_id)));
      setTargets(bdTargets);
    }).finally(() => setLoading(false));
  }, [currentUser.id]);

  // ── Date range ─────────────────────────────────────────────
  const { start: rangeStart, end: rangeEnd } = getDateRange(preset);

  // ── Derived stats ──────────────────────────────────────────
  const activeDeals = deals.filter(d =>
    !['won', 'lost'].includes(d.stage) &&
    (rangeStart === null || inRange(d.created_at, rangeStart, rangeEnd))
  );
  const pipelineValue = activeDeals.reduce((s, d) => s + d.value, 0);
  const wonDeals = deals.filter(d =>
    d.stage === 'won' &&
    (rangeStart === null || inRange(d.actual_close_date, rangeStart, rangeEnd))
  );
  const totalWon = wonDeals.reduce((s, d) => s + d.value, 0);
  const closedDeals = deals.filter(d =>
    ['won', 'lost'].includes(d.stage) &&
    (rangeStart === null || inRange(d.actual_close_date, rangeStart, rangeEnd))
  );
  const winRate = closedDeals.length > 0 ? Math.round((wonDeals.length / closedDeals.length) * 100) : 0;
  const activeClients = clients.filter(c => c.status === 'active').length;

  // ── BD Target: attainment / weighted forecast / coverage ───
  // Target là quý + cá nhân + USD → numerator cũng phải quý + cá nhân + USD (không theo date preset)
  // ponytail: deal VND bỏ khỏi phép so target USD — thêm quy đổi tỷ giá khi có deal VND đáng kể
  const myTarget = targets.find(t => t.bd_id === currentUser.id && matchesWorkspace(t.entity, workspace)) || null;
  const qStart = new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1);
  const myUsdDeals = deals.filter(d => d.owner_id === currentUser.id && d.currency === 'USD');
  const wonQuarter = myUsdDeals
    .filter(d => d.stage === 'won' && d.actual_close_date && new Date(d.actual_close_date) >= qStart)
    .reduce((s, d) => s + d.value, 0);
  const myOpenDeals = myUsdDeals.filter(d => !['won', 'lost'].includes(d.stage));
  const myPipeline = myOpenDeals.reduce((s, d) => s + d.value, 0);
  const weightedForecast = myOpenDeals.reduce((s, d) => s + d.value * (d.probability || 0) / 100, 0);
  const target = myTarget?.target_usd || 0;
  const attainment = target > 0 ? Math.round((wonQuarter / target) * 100) : null;
  const gap = Math.max(0, target - wonQuarter);
  const coverage = gap > 0 ? (myPipeline / gap) : null; // chuẩn sales: >= 3x là khỏe

  // ── Contract aggregates ────────────────────────────────────
  const totalContractValue = approvedContracts.reduce((s, c) => s + (c.contract_value ?? 0), 0);
  const contractByBd: Record<string, number> = {};
  approvedContracts.forEach(c => {
    const key = c.created_by || 'Chưa gán';
    contractByBd[key] = (contractByBd[key] ?? 0) + (c.contract_value ?? 0);
  });

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
  type BdStat = { name: string; userId?: string; active: number; won: number; lost: number; pipelineVal: number; wonVal: number; avgDaysToClose: number; closeDays: number[]; contractVal: number };
  const bdPerf = (() => {
    const owners: Map<string, BdStat> = new Map();
    deals.forEach(d => {
      const name = d.owner_name || 'Chưa gán';
      const userId = d.owner_id || undefined;
      if (!owners.has(name)) owners.set(name, { name, userId, active: 0, won: 0, lost: 0, pipelineVal: 0, wonVal: 0, avgDaysToClose: 0, closeDays: [], contractVal: 0 });
      const o = owners.get(name)!;
      if (d.stage === 'won' && (rangeStart === null || inRange(d.actual_close_date, rangeStart, rangeEnd))) {
        o.won++;
        o.wonVal += d.value;
        if (d.actual_close_date && d.created_at) {
          const days = Math.max(1, Math.floor((new Date(d.actual_close_date).getTime() - new Date(d.created_at).getTime()) / 86_400_000));
          o.closeDays.push(days);
        }
      } else if (d.stage === 'lost' && (rangeStart === null || inRange(d.actual_close_date, rangeStart, rangeEnd))) {
        o.lost++;
      } else if (!['won', 'lost'].includes(d.stage) && (rangeStart === null || inRange(d.created_at, rangeStart, rangeEnd))) {
        o.active++;
        o.pipelineVal += d.value;
      }
    });
    // Inject contract values per BD (by created_by user id)
    approvedContracts.forEach(c => {
      owners.forEach(o => {
        if (o.userId && o.userId === c.created_by) {
          o.contractVal += c.contract_value ?? 0;
        }
      });
    });
    owners.forEach(o => {
      o.avgDaysToClose = o.closeDays.length > 0 ? Math.round(o.closeDays.reduce((a, b) => a + b, 0) / o.closeDays.length) : 0;
    });
    return [...owners.values()].sort((a, b) => b.wonVal - a.wonVal);
  })();

  // ── Conversion theo nguồn (toàn thời gian, không theo date preset) ──
  type SourceStat = { source: string; total: number; meeting: number; deal: number; quoted: number; won: number };
  const dealClientIds = new Set(deals.map(d => d.client_id));
  const wonClientIds = new Set(deals.filter(d => d.stage === 'won').map(d => d.client_id));
  const sourceFunnel: SourceStat[] = Object.values(
    clients.reduce((acc: Record<string, SourceStat>, c) => {
      const key = c.lead_source || 'Không rõ';
      if (!acc[key]) acc[key] = { source: key, total: 0, meeting: 0, deal: 0, quoted: 0, won: 0 };
      acc[key].total++;
      if (meetingClientIds.has(c.id)) acc[key].meeting++;
      if (dealClientIds.has(c.id)) acc[key].deal++;
      if (quotedClientIds.has(c.id)) acc[key].quoted++;
      if (wonClientIds.has(c.id)) acc[key].won++;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  // Client map for activity feed
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));

  if (loading) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-600 text-sm animate-td-pulse">Đang tải dashboard...</p>
      </div>
    );
  }

  const DATE_PRESETS: { key: DatePreset; label: string }[] = [
    { key: 'this_month', label: 'Tháng này' },
    { key: 'last_month', label: 'Tháng trước' },
    { key: 'this_quarter', label: 'Quý này' },
    { key: 'all', label: 'Tất cả' },
  ];

  return (
    <div className="animate-fadeInUp space-y-6">
      {/* ── Greeting ── */}
      <div>
        <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>
          Xin chào, {currentUser.username}
        </h2>
        <p className="text-sm text-neutral-medium mt-1">Tổng quan CRM hôm nay</p>
      </div>

      {/* ── Date preset chips ── */}
      <div className="flex flex-wrap gap-2">
        {DATE_PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className="px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all"
            style={preset === p.key
              ? { background: '#FF9500', color: '#000', borderRadius: '9999px', border: 'none' }
              : { background: 'transparent', color: '#aaa', borderRadius: '9999px', border: '1px solid #333' }
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Pipeline', value: fmtValue(pipelineValue, 'USD'), sub: `${activeDeals.length} deals đang xử lý`, color: 'text-white' },
          { label: 'Tổng Won', value: fmtValue(totalWon, 'USD'), sub: `${wonDeals.length} deals`, color: 'text-status-success' },
          { label: 'Win Rate', value: `${winRate}%`, sub: closedDeals.length > 0 ? `${wonDeals.length}W / ${closedDeals.length - wonDeals.length}L` : 'Chưa có data', color: 'text-white' },
          { label: 'Khách hàng', value: `${activeClients}`, sub: `/ ${clients.length} tổng`, color: 'text-white' },
          { label: 'Studios của tôi', value: `${myStudiosCount}`, sub: 'studio đang phụ trách', color: 'text-white' },
          { label: 'Hợp đồng', value: totalContractValue > 0 ? fmtValue(totalContractValue, 'USD') : '—', sub: `${approvedContracts.length} hợp đồng`, color: 'text-white' },
          { label: 'Target quý', value: attainment !== null ? `${attainment}%` : 'Chưa đặt', sub: target > 0 ? `${fmtValue(wonQuarter, 'USD')} / ${fmtValue(target, 'USD')}` : 'Admin đặt target', color: attainment !== null && attainment >= 100 ? 'text-status-success' : 'text-white' },
          { label: 'Forecast (weighted)', value: fmtValue(Math.round(weightedForecast), 'USD'), sub: 'Σ value × probability', color: 'text-white' },
          { label: 'Pipeline coverage', value: coverage !== null ? `${coverage.toFixed(1)}x` : '—', sub: 'mục tiêu ≥ 3x phần còn thiếu', color: coverage === null ? 'text-white' : coverage < 3 ? 'text-status-error' : 'text-status-success' },
        ].map(c => (
          <div key={c.label} className="rounded-[20px] border border-primary/10 p-4 space-y-1 bg-surface">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{c.label}</p>
            <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
            {c.sub && <p className="text-xs font-semibold text-neutral-500">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Admin: đặt target quý ── */}
      {hasAnyRole(currentUser, ['admin']) && (
        // ponytail: admin đặt target từng BD qua dropdown — thêm khi có >2 BD
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Target {currentPeriod()} (USD)</p>
          <input
            type="number"
            value={targetInput}
            onChange={e => setTargetInput(e.target.value)}
            placeholder={myTarget ? `${myTarget.target_usd}` : '0'}
            className="w-32 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-xs font-semibold text-white"
          />
          <button
            onClick={async () => {
              const value = Number(targetInput);
              if (!targetInput || isNaN(value) || value < 0) return;
              await upsertBdTarget({ bd_id: currentUser.id, period: currentPeriod(), target_usd: value, entity: getWorkspace() });
              setTargets(await fetchBdTargets(currentPeriod()));
              setTargetInput('');
            }}
            className="px-4 py-2 rounded-lg bg-primary text-black text-[10px] font-black uppercase tracking-wider hover:opacity-90 transition-all"
          >
            Lưu
          </button>
        </div>
      )}

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
              <div className="grid grid-cols-7 gap-2 pb-2 border-b border-white/5 mb-2">
                {['BD', 'Active', 'Won', 'Lost', 'Win Rate', 'Avg Close', 'Contract'].map(h => (
                  <p key={h} className="text-[9px] font-black uppercase tracking-wider text-neutral-700">{h}</p>
                ))}
              </div>

              {/* Rows */}
              <div className="space-y-1">
                {bdPerf.map(bd => {
                  const total = bd.won + bd.lost;
                  const wr = total > 0 ? Math.round((bd.won / total) * 100) : 0;
                  return (
                    <div key={bd.name} className="grid grid-cols-7 gap-2 py-2 rounded-lg hover:bg-white/5 transition-all">
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
                      <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>
                        {bd.contractVal > 0 ? fmtValue(bd.contractVal, 'USD') : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Total row */}
              {bdPerf.length > 1 && <BdPerfTotalRow bdPerf={bdPerf} />}
            </div>
          )}

          {/* Conversion theo nguồn */}
          {sourceFunnel.length > 0 && (
            <div className="rounded-[20px] border border-primary/10 p-5 bg-surface">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-4">
                🔀 Conversion theo nguồn <span className="normal-case font-semibold text-neutral-700">(toàn thời gian)</span>
              </p>
              <div className="grid grid-cols-6 gap-2 pb-2 border-b border-white/5 mb-2">
                {['Nguồn', 'Clients', '% Meeting', '% Deal', '% Báo giá', '% Won'].map(h => (
                  <p key={h} className="text-[9px] font-black uppercase tracking-wider text-neutral-700">{h}</p>
                ))}
              </div>
              <div className="space-y-1">
                {sourceFunnel.map(s => (
                  <div key={s.source} className="grid grid-cols-6 gap-2 py-2 rounded-lg hover:bg-white/5 transition-all">
                    <p className="text-xs font-semibold text-white truncate">{s.source}</p>
                    <span className="text-xs font-semibold text-neutral-300">{s.total}</span>
                    <span className="text-xs font-semibold text-neutral-400">{Math.round((s.meeting / s.total) * 100)}%</span>
                    <span className="text-xs font-semibold text-neutral-400">{Math.round((s.deal / s.total) * 100)}%</span>
                    <span className="text-xs font-semibold text-neutral-400">{Math.round((s.quoted / s.total) * 100)}%</span>
                    <span className="text-xs font-black text-status-success">{Math.round((s.won / s.total) * 100)}%</span>
                  </div>
                ))}
              </div>
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
