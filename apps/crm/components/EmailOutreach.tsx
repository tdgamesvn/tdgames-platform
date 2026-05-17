import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CrmClient, CrmOutreachLead, CrmEmailTemplate, CrmEmailLog } from '@/types';
import * as svc from '../services/outreachService';
import type { PipelineStats } from '../services/outreachService';
import { getOutreachApiBase, outreachRequest, supabaseEdgeFunctionPost } from '../services/outreachApi';

// ══════════════════════════════════════════════════════════════
// ── Constants ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

const STATUS_CFG: Record<string, { label: string; color: string; icon: string }> = {
  pending:        { label: 'Chờ gửi',     color: '#888',    icon: '⏳' },
  initial_sent:   { label: 'Đã gửi',      color: '#0A84FF', icon: '📤' },
  followup1_sent: { label: 'Follow-up 1', color: '#FF9500', icon: '📨' },
  followup2_sent: { label: 'Follow-up 2', color: '#BF5AF2', icon: '📩' },
  replied:        { label: 'Đã phản hồi', color: '#34C759', icon: '💬' },
  bounced:        { label: 'Bị bounce',   color: '#FF453A', icon: '⚠️' },
  invalid_email:  { label: 'Email lỗi',   color: '#FF3B30', icon: '❌' },
  unsubscribed:   { label: 'Huỷ',         color: '#555',    icon: '🚫' },
};

const TIER_CFG: Record<number, { label: string; color: string; icon: string; desc: string }> = {
  1: { label: 'Tier 1', color: '#FFD60A', icon: '⭐', desc: 'Art Director / Outsource Manager' },
  2: { label: 'Tier 2', color: '#FF9500', icon: '★',  desc: 'Producer / Lead Artist' },
  3: { label: 'Tier 3', color: '#888',    icon: '☆',  desc: 'CEO / BD Manager' },
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#1A1A1A', border: '1px solid #333',
  borderRadius: '8px', color: '#F5F5F5', fontSize: '13px', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888',
};

type SubTab = 'dashboard' | 'leads' | 'discovery' | 'emails' | 'settings';

// ══════════════════════════════════════════════════════════════
// ── Main Component ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

interface Props { clients: CrmClient[]; }

const EmailOutreach: React.FC<Props> = ({ clients }) => {
  const [tab, setTab] = useState<SubTab>('dashboard');
  const [leads, setLeads] = useState<CrmOutreachLead[]>([]);
  const [templates, setTemplates] = useState<CrmEmailTemplate[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // Filters
  const [searchQ, setSearchQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTier, setFilterTier] = useState<number | ''>('');

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [l, t, s] = await Promise.all([
        svc.fetchLeads({ search: searchQ || undefined, status: filterStatus || undefined, tier: filterTier || undefined }),
        svc.fetchTemplates(),
        svc.getPipelineStats(),
      ]);
      setLeads(l); setTemplates(t); setStats(s);
    } catch { } finally { setIsLoading(false); }
  }, [searchQ, filterStatus, filterTier]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const tabs: { key: SubTab; icon: string; label: string }[] = [
    { key: 'dashboard', icon: '📊', label: 'Dashboard' },
    { key: 'leads',     icon: '👥', label: `Leads (${stats?.total || 0})` },
    { key: 'discovery', icon: '🔍', label: 'Discovery' },
    { key: 'emails',    icon: '📧', label: `Templates (${templates.length})` },
    { key: 'settings',  icon: '⚙️', label: 'Settings' },
  ];

  return (
    <>
      <div className="animate-fadeInUp" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#FF9500', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
            📧 Email Outreach
          </h2>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>Lead Discovery + Cold Email Pipeline — TD Games Outsourcing</p>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #222' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              background: tab === t.key ? '#222' : 'transparent',
              color: tab === t.key ? '#FF9500' : '#888',
              border: 'none', borderBottom: tab === t.key ? '2px solid #FF9500' : '2px solid transparent',
              borderRadius: '8px 8px 0 0', transition: 'all 0.2s',
            }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && stats && <DashboardTab stats={stats} />}

        {/* ── LEADS ── */}
        {tab === 'leads' && (
          <LeadsTab
            leads={leads} clients={clients} isLoading={isLoading} templates={templates}
            searchQ={searchQ} setSearchQ={setSearchQ}
            filterStatus={filterStatus} setFilterStatus={setFilterStatus}
            filterTier={filterTier} setFilterTier={setFilterTier}
            onRefresh={loadAll}
          />
        )}

        {/* ── DISCOVERY ── */}
        {tab === 'discovery' && <DiscoveryTab onRefresh={loadAll} leads={leads} />}

        {/* ── EMAILS/TEMPLATES ── */}
        {tab === 'emails' && <TemplatesTab templates={templates} onRefresh={loadAll} onPreview={setPreviewHtml} />}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && <SettingsTab />}
      </div>

      {/* Preview Modal — rendered OUTSIDE animate-fadeInUp to avoid CSS transform breaking position:fixed */}
      {previewHtml && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999,
          background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column',
        }} onClick={() => setPreviewHtml(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px',
            background: '#111', borderBottom: '1px solid #333', height: '50px', flexShrink: 0,
          }}>
            <span style={{ color: '#F5F5F5', fontSize: '14px', fontWeight: 700, flex: 1 }}>📧 Email Preview</span>
            <button onClick={() => setPreviewHtml(null)} style={{
              padding: '6px 14px', border: 'none', borderRadius: '6px', background: '#FF453A',
              color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            }}>✕ Đóng</button>
          </div>
          <div onClick={e => e.stopPropagation()} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '20px', overflow: 'auto' }}>
            <iframe srcDoc={previewHtml} style={{ width: '650px', height: '100%', minHeight: '600px', border: 'none', borderRadius: '12px', background: '#fff' }} title="Email Preview" />
          </div>
        </div>
      )}
    </>
  );
};

// ══════════════════════════════════════════════════════════════
// ── DASHBOARD TAB ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

const DashboardTab: React.FC<{ stats: PipelineStats }> = ({ stats }) => {
  const [autoBatchConfig, setAutoBatchConfig] = useState<any>(null);
  const [batchLogs, setBatchLogs] = useState<any[]>([]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [triggeringBatch, setTriggeringBatch] = useState(false);

  useEffect(() => {
    // Load config
    import('@/services/supabaseClient').then(({ supabase }) => {
      supabase.from('crm_outreach_config').select('value').eq('key', 'auto_batch').single()
        .then(({ data }) => { if (data) setAutoBatchConfig(data.value); });
      supabase.from('crm_outreach_batch_log').select('*').order('created_at', { ascending: false }).limit(10)
        .then(({ data }) => { if (data) setBatchLogs(data); });
    });
  }, []);

  const handleToggleAutoBatch = async () => {
    const { supabase } = await import('@/services/supabaseClient');
    const newConfig = { ...autoBatchConfig, enabled: !autoBatchConfig.enabled };
    await supabase.from('crm_outreach_config').update({ value: newConfig, updated_at: new Date().toISOString() }).eq('key', 'auto_batch');
    setAutoBatchConfig(newConfig);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    const { supabase } = await import('@/services/supabaseClient');
    await supabase.from('crm_outreach_config').update({ value: autoBatchConfig, updated_at: new Date().toISOString() }).eq('key', 'auto_batch');
    setSavingConfig(false);
    alert('✅ Đã lưu cấu hình!');
  };

  const handleTriggerBatch = async () => {
    if (!confirm('Chạy auto batch ngay bây giờ?')) return;
    setTriggeringBatch(true);
    try {
      const res = await supabaseEdgeFunctionPost('outreach-auto-batch', {});
      if (!res.ok) {
        const errText = await res.text();
        alert(`Lỗi batch (${res.status}): ${errText.slice(0, 200)}`);
        return;
      }
      const data = await res.json();
      alert(`Batch hoàn thành!\n\nĐã gửi: ${data.total_sent || 0}\nThất bại: ${data.total_failed || 0}`);
      // Reload logs
      const { supabase } = await import('@/services/supabaseClient');
      const { data: logs } = await supabase.from('crm_outreach_batch_log').select('*').order('created_at', { ascending: false }).limit(10);
      if (logs) setBatchLogs(logs);
    } catch (err: any) { alert(`Lỗi: ${err.message}`); }
    setTriggeringBatch(false);
  };

  const pipelineSteps = [
    { label: 'Pending', count: stats.pending, color: '#888', pct: stats.total > 0 ? (stats.pending / stats.total) * 100 : 0 },
    { label: 'Initial Sent', count: stats.initial_sent, color: '#0A84FF', pct: stats.total > 0 ? (stats.initial_sent / stats.total) * 100 : 0 },
    { label: 'Follow-up 1', count: stats.followup1_sent, color: '#FF9500', pct: stats.total > 0 ? (stats.followup1_sent / stats.total) * 100 : 0 },
    { label: 'Follow-up 2', count: stats.followup2_sent, color: '#BF5AF2', pct: stats.total > 0 ? (stats.followup2_sent / stats.total) * 100 : 0 },
    { label: 'Replied! 🎉', count: stats.replied, color: '#34C759', pct: stats.total > 0 ? (stats.replied / stats.total) * 100 : 0 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Tổng Leads', value: stats.total, color: '#FF9500' },
          { label: '⭐ Tier 1', value: stats.tier1, color: '#FFD60A' },
          { label: '★ Tier 2', value: stats.tier2, color: '#FF9500' },
          { label: '☆ Tier 3', value: stats.tier3, color: '#888' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '16px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888' }}>{s.label}</p>
            <p style={{ fontSize: '28px', fontWeight: 900, color: s.color, marginTop: '4px' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pipeline Funnel */}
      <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#F5F5F5', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Pipeline Funnel
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pipelineSteps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '120px', fontSize: '12px', fontWeight: 700, color: step.color, textAlign: 'right' }}>{step.label}</span>
              <div style={{ flex: 1, height: '28px', background: '#222', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${Math.max(step.pct, step.count > 0 ? 2 : 0)}%`,
                  height: '100%', background: step.color, borderRadius: '6px',
                  transition: 'width 0.8s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px',
                }}>
                  {step.count > 0 && (
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff' }}>{step.count}</span>
                  )}
                </div>
              </div>
              <span style={{ width: '50px', fontSize: '11px', color: '#555', textAlign: 'right' }}>{step.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>

        {/* Bounce row */}
        {stats.bounced > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', opacity: 0.6 }}>
            <span style={{ width: '120px', fontSize: '12px', fontWeight: 700, color: '#FF453A', textAlign: 'right' }}>Bounced</span>
            <div style={{ flex: 1, height: '28px', background: '#222', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${(stats.bounced / stats.total) * 100}%`, height: '100%', background: '#FF453A', borderRadius: '6px' }} />
            </div>
            <span style={{ width: '50px', fontSize: '11px', color: '#555', textAlign: 'right' }}>{stats.bounced}</span>
          </div>
        )}
      </div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[
          { label: 'Đã gửi email', value: stats.total - stats.pending, total: stats.total, color: '#0A84FF' },
          { label: 'Reply Rate', value: stats.replied, total: stats.total - stats.pending || 1, color: '#34C759', isPct: true },
          { label: 'Bounce Rate', value: stats.bounced, total: stats.total - stats.pending || 1, color: '#FF453A', isPct: true },
        ].map((m, i) => (
          <div key={i} style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: '8px' }}>{m.label}</p>
            <p style={{ fontSize: '32px', fontWeight: 900, color: m.color }}>
              {m.isPct ? `${m.total > 0 ? ((m.value / m.total) * 100).toFixed(1) : 0}%` : m.value}
            </p>
            {!m.isPct && <p style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>/ {m.total} leads</p>}
          </div>
        ))}
      </div>

      {/* ═══ AUTO BATCH CONFIG ═══ */}
      {autoBatchConfig && (
        <div style={{ background: '#161616', border: `1px solid ${autoBatchConfig.enabled ? '#34C75930' : '#33333380'}`, borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#F5F5F5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                🤖 Auto Daily Batch
              </h3>
              <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>Tự động gửi email hàng ngày theo lịch</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={handleTriggerBatch} disabled={triggeringBatch} style={{
                padding: '8px 14px', border: 'none', borderRadius: '8px',
                background: triggeringBatch ? '#333' : '#FF950020', color: triggeringBatch ? '#888' : '#FF9500',
                fontSize: '11px', fontWeight: 700, cursor: triggeringBatch ? 'wait' : 'pointer',
              }}>{triggeringBatch ? '⏳ Đang gửi...' : '▶ Chạy ngay'}</button>
              <button onClick={handleToggleAutoBatch} style={{
                padding: '8px 20px', border: 'none', borderRadius: '20px',
                background: autoBatchConfig.enabled ? '#34C759' : '#555',
                color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                transition: 'background 0.3s',
              }}>{autoBatchConfig.enabled ? '✓ BẬT' : '✗ TẮT'}</button>
            </div>
          </div>

          {/* Config fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Batch size (mỗi lần)</label>
              <input type="number" style={inputStyle} value={autoBatchConfig.batch_size || 15}
                onChange={e => setAutoBatchConfig({ ...autoBatchConfig, batch_size: +e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Daily limit</label>
              <input type="number" style={inputStyle} value={autoBatchConfig.daily_limit || 30}
                onChange={e => setAutoBatchConfig({ ...autoBatchConfig, daily_limit: +e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Min delay giữa follow-up (giờ)</label>
              <input type="number" style={inputStyle} value={autoBatchConfig.min_delay_hours || 72}
                onChange={e => setAutoBatchConfig({ ...autoBatchConfig, min_delay_hours: +e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', color: '#888', fontWeight: 700 }}>⏰ Lịch gửi: 7:00 sáng & 14:00 chiều (VN)</span>
            <button onClick={handleSaveConfig} disabled={savingConfig} style={{
              padding: '6px 14px', border: 'none', borderRadius: '6px', marginLeft: 'auto',
              background: '#0A84FF', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            }}>{savingConfig ? '⏳...' : '💾 Lưu cấu hình'}</button>
          </div>

          {/* Batch Log */}
          {batchLogs.length > 0 && (
            <div style={{ borderTop: '1px solid #222', paddingTop: '14px' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#666', marginBottom: '8px' }}>Lịch sử batch gần đây</p>
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {batchLogs.map(log => (
                  <div key={log.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1A1A1A', fontSize: '12px' }}>
                    <span style={{ color: '#555', width: '130px', flexShrink: 0 }}>{new Date(log.created_at).toLocaleString('vi-VN')}</span>
                    <span style={{ color: log.batch_type === 'auto' ? '#BF5AF2' : '#0A84FF', fontWeight: 700, width: '50px' }}>{log.batch_type === 'auto' ? '🤖 Auto' : '👤 Manual'}</span>
                    <span style={{ color: log.status === 'completed' ? '#34C759' : log.status === 'running' ? '#FF9500' : '#FF453A', fontWeight: 700 }}>
                      {log.status === 'completed' ? '✅' : log.status === 'running' ? '⏳' : '❌'} {log.status}
                    </span>
                    <span style={{ color: '#888' }}>Sent: {log.total_sent || 0} | Failed: {log.total_failed || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// ── LEADS TAB ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

interface QuotaStatus { sent_today: number; daily_limit: number; remaining: number; }

async function fetchQuota(): Promise<QuotaStatus> {
  const base = getOutreachApiBase();
  if (!base) return { sent_today: 0, daily_limit: 30, remaining: 30 };
  try {
    const res = await outreachRequest('/api/email/status');
    if (!res.ok) throw new Error();
    return res.json();
  } catch { return { sent_today: 0, daily_limit: 30, remaining: 30 }; }
}

interface LeadsProps {
  leads: CrmOutreachLead[]; clients: CrmClient[]; isLoading: boolean;
  templates: CrmEmailTemplate[];
  searchQ: string; setSearchQ: (v: string) => void;
  filterStatus: string; setFilterStatus: (v: string) => void;
  filterTier: number | ''; setFilterTier: (v: number | '') => void;
  onRefresh: () => void;
}

const LeadsTab: React.FC<LeadsProps> = ({ leads, clients, isLoading, templates, searchQ, setSearchQ, filterStatus, setFilterStatus, filterTier, setFilterTier, onRefresh }) => {
  const [showImport, setShowImport] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ studio_name: '', contact_name: '', first_name: '', email: '', job_title: '', linkedin_url: '', tier: 1 });
  const fileRef = useRef<HTMLInputElement>(null);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  // Ref for the polling interval so we can clear it on unmount (avoid memory leak / API spam)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ verified: number; valid: number; invalid: number; high_risk?: number } | null>(null);
  const [checkingBounces, setCheckingBounces] = useState(false);
  const [bounceResult, setBounceResult] = useState<{ bounces_found: number; leads_updated: number; bounces?: any[] } | null>(null);

  useEffect(() => { fetchQuota().then(setQuota); }, []);

  // Send email to a single lead
  const handleSendEmail = async (leadId: string, templateName: string = 'initial_outreach') => {
    if (!getOutreachApiBase()) {
      alert('Outreach API chưa cấu hình: VITE_OUTREACH_API_URL hoặc Supabase + Edge outreach-proxy.');
      return;
    }
    // Idempotency: nếu đang gửi cùng lead này thì bỏ qua double-click
    if (sendingId === leadId) return;
    setSendingId(leadId);
    try {
      const res = await outreachRequest('/api/email/send', {
        method: 'POST',
        body: JSON.stringify({ lead_id: leadId, template_name: templateName }),
      });
      if (res.status === 429) { alert('Đã đạt giới hạn email/ngày. Thử lại ngày mai.'); return; }
      if (!res.ok) { const err = await res.json().catch(() => ({})); alert(`Gửi thất bại: ${err.detail || res.status}`); return; }
      const data = await res.json();
      alert(`✅ Đã gửi tới ${data.to}!\nSubject: ${data.subject}`);
      onRefresh();
      fetchQuota().then(setQuota);
    } catch (err: any) { alert(`Lỗi: ${err.message}`); } finally { setSendingId(null); }
  };

  // Bulk send via server-side batch (with 2-5 min delay between each email)
  const handleBulkSend = async () => {
    if (!getOutreachApiBase()) {
      alert('Outreach API chưa cấu hình: VITE_OUTREACH_API_URL hoặc Supabase + Edge outreach-proxy.');
      return;
    }
    // Idempotency: nếu đang gửi rồi thì bỏ qua
    if (bulkSending) { alert('Đang gửi batch trước, vui lòng chờ.'); return; }

    // Refresh quota TRƯỚC khi confirm — tránh trường hợp user cầm state cũ vài giờ
    let liveQuota = quota;
    try { liveQuota = await fetchQuota(); setQuota(liveQuota); } catch { /* fallback to cached */ }

    const pendingCount = leads.filter(l => l.outreach_status === 'pending').length;
    const remaining = liveQuota?.remaining ?? 30;
    const batchSize = Math.min(pendingCount, remaining);
    if (batchSize === 0) { alert(remaining <= 0 ? 'Đã hết quota hôm nay.' : 'Không có leads pending.'); return; }
    const estTime = Math.round(batchSize * 3.5); // avg 3.5 min per email
    if (!confirm(`Gửi email initial cho ${batchSize} leads?\n\n⏱ Ước tính: ~${estTime} phút (delay 2-5 phút giữa mỗi email)\n🔒 Server tự xử lý — bạn có thể đóng tab.`)) return;

    // Trigger server-side batch
    try {
      const res = await outreachRequest('/api/email/batch', {
        method: 'POST',
        body: JSON.stringify({ template_name: 'initial_outreach', limit: batchSize, min_delay: 120, max_delay: 300 }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); alert(`Lỗi: ${err.error || err.detail || res.status}`); return; }
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setBulkSending(true);
      setBulkProgress({ current: 0, total: data.count || batchSize, success: 0, failed: 0 });

      // Clear any prior poll first (defensive — không nên có nhưng đề phòng)
      if (pollRef.current) clearInterval(pollRef.current);

      // Poll status every 10 seconds; pollRef cho phép cleanup khi unmount
      pollRef.current = setInterval(async () => {
        try {
          const sr = await outreachRequest('/api/email/batch-status');
          if (!sr.ok) return;
          const st = await sr.json();
          setBulkProgress({
            current: st.current || 0,
            total: st.total || data.count || batchSize,
            success: st.success || 0,
            failed: st.failed || 0,
          });
          if (!st.running) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            setBulkSending(false);
            alert(`✅ Batch hoàn thành!\nThành công: ${st.success || 0}\nThất bại: ${st.failed || 0}`);
            onRefresh();
            fetchQuota().then(setQuota);
          }
        } catch { /* ignore poll errors — sẽ retry tick sau */ }
      }, 10000);
    } catch (err: any) {
      alert(`Lỗi kết nối: ${err.message}`);
      setBulkSending(false);
    }
  };

  // Verify pending emails before sending
  const handleVerifyEmails = async () => {
    if (!getOutreachApiBase()) {
      alert('Outreach API chưa cấu hình: VITE_OUTREACH_API_URL hoặc Supabase + Edge outreach-proxy.');
      return;
    }
    const pendingCount = leads.filter(l => l.outreach_status === 'pending').length;
    if (pendingCount === 0) { alert('Không có leads pending cần verify.'); return; }
    if (!confirm(`Verify ${Math.min(pendingCount, 100)} email addresses?\n\nKiểm tra: MX records, SMTP, catch-all, domain match, disposable, role-based.\nEmail không hợp lệ sẽ được đánh dấu "invalid_email".`)) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await outreachRequest('/api/email/verify-pending', {
        method: 'POST',
        body: JSON.stringify({ limit: 100 }),
      });
      if (!res.ok) { alert(`Lỗi: ${res.status}`); return; }
      const data = await res.json();
      setVerifyResult({ verified: data.verified, valid: data.valid, invalid: data.invalid, high_risk: data.high_risk || 0 });
      alert(`✅ Verify hoàn thành!\n\nĐã kiểm tra: ${data.verified}\nHợp lệ: ${data.valid}\n⚠️ High Risk: ${data.high_risk || 0}\n❌ Invalid: ${data.invalid} (đã đánh dấu)`);
      onRefresh();
    } catch (err: any) { alert(`Lỗi: ${err.message}`); } finally { setVerifying(false); }
  };

  // Check bounces from Gmail inbox
  const handleCheckBounces = async () => {
    if (!getOutreachApiBase()) {
      alert('Outreach API chưa cấu hình: VITE_OUTREACH_API_URL hoặc Supabase + Edge outreach-proxy.');
      return;
    }
    if (!confirm('Quét Gmail inbox tìm email bị bounce?\n\nSẽ tự động đánh dấu leads bị bounce trong database.')) return;
    setCheckingBounces(true);
    setBounceResult(null);
    try {
      const res = await outreachRequest('/api/email/check-bounces', {
        method: 'POST',
        body: JSON.stringify({ days_back: 14, max_results: 50, auto_update: true }),
      });
      if (!res.ok) { alert(`Lỗi: ${res.status}`); return; }
      const data = await res.json();
      setBounceResult(data);
      alert(`📬 Bounce check hoàn thành!\n\nBounce tìm thấy: ${data.bounces_found}\nLeads đã cập nhật: ${data.leads_updated}\nĐã đánh dấu trước: ${data.already_marked}`);
      onRefresh();
      fetchQuota().then(setQuota);
    } catch (err: any) { alert(`Lỗi: ${err.message}`); } finally { setCheckingBounces(false); }
  };

  // CSV Import
  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    const { leads: parsed, skipped } = svc.parseCsvLeads(text);
    if (parsed.length === 0) {
      const skipMsg = skipped.length > 0
        ? `\n\nBị skip ${skipped.length} dòng (lý do: ${skipped[0]?.reason || 'không rõ'}...)`
        : '';
      alert(`Không tìm thấy leads hợp lệ${skipMsg}`);
      return;
    }
    try {
      await svc.createLeadsBatch(parsed);
      onRefresh(); setShowImport(false);
      const skipNote = skipped.length > 0 ? `\n⚠️ Đã bỏ qua ${skipped.length} dòng (email trống/không hợp lệ)` : '';
      alert(`✅ Đã import ${parsed.length} leads!${skipNote}`);
    } catch (err: any) { alert('Error: ' + err.message); }
    if (fileRef.current) fileRef.current.value = '';
  };

  // CRM Import
  const handleCrmImport = async () => {
    const newLeads: Omit<CrmOutreachLead, 'id' | 'created_at' | 'updated_at'>[] = [];
    clients.forEach(c => {
      (c.contacts || []).forEach(ct => {
        if (ct.email && !leads.some(l => l.email === ct.email)) {
          newLeads.push({
            client_id: c.id, studio_name: c.name, contact_name: ct.name,
            first_name: ct.name.split(' ')[0] || '', email: ct.email,
            job_title: ct.role || '', linkedin_url: '', tier: 3,
            outreach_status: 'pending', initial_sent_at: null, followup1_sent_at: null,
            followup2_sent_at: null, replied_at: null, source: 'crm_import', tags: [], notes: '',
          });
        }
      });
      if (c.email && !leads.some(l => l.email === c.email) && !newLeads.some(l => l.email === c.email)) {
        newLeads.push({
          client_id: c.id, studio_name: c.name,
          contact_name: c.contact_person || c.name, first_name: (c.contact_person || c.name).split(' ')[0],
          email: c.email, job_title: '', linkedin_url: '', tier: 3,
          outreach_status: 'pending', initial_sent_at: null, followup1_sent_at: null,
          followup2_sent_at: null, replied_at: null, source: 'crm_import', tags: [], notes: '',
        });
      }
    });
    if (newLeads.length === 0) { alert('Không có contacts mới'); return; }
    try {
      await svc.createLeadsBatch(newLeads);
      onRefresh(); setShowImport(false);
      alert(`Đã import ${newLeads.length} leads từ CRM!`);
    } catch (err: any) { alert('Error: ' + err.message); }
  };

  // Add single lead
  const handleAdd = async () => {
    if (!addForm.email.trim()) return;
    try {
      await svc.createLead({
        ...addForm, client_id: null, outreach_status: 'pending',
        initial_sent_at: null, followup1_sent_at: null, followup2_sent_at: null,
        replied_at: null, source: 'manual', tags: [], notes: '',
      });
      setShowAddForm(false);
      setAddForm({ studio_name: '', contact_name: '', first_name: '', email: '', job_title: '', linkedin_url: '', tier: 1 });
      onRefresh();
    } catch (err: any) { alert('Error: ' + err.message); }
  };

  // Status update
  const handleStatusChange = async (id: string, status: string) => {
    try { await svc.updateLead(id, { outreach_status: status } as any); onRefresh(); } catch { }
  };

  // Delete
  const handleDelete = async (id: string) => {
    try { await svc.deleteLead(id); onRefresh(); } catch { }
  };

  // Determine next template for a lead
  const getNextTemplate = (lead: CrmOutreachLead): { name: string; label: string } | null => {
    if (lead.outreach_status === 'pending') return { name: 'initial_outreach', label: 'Gửi Initial' };
    if (lead.outreach_status === 'initial_sent') return { name: 'followup_1', label: 'Gửi FU1' };
    if (lead.outreach_status === 'followup1_sent') return { name: 'followup_2', label: 'Gửi FU2' };
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Quota Bar */}
      {quota && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 20px',
          background: '#161616', border: '1px solid #222', borderRadius: '12px',
        }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#888' }}>📊 Quota hôm nay</span>
          <div style={{ flex: 1, height: '8px', background: '#222', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${(quota.sent_today / quota.daily_limit) * 100}%`, height: '100%', background: quota.remaining > 10 ? '#34C759' : quota.remaining > 0 ? '#FF9500' : '#FF453A', borderRadius: '4px', transition: 'width 0.5s' }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 800, color: quota.remaining > 10 ? '#34C759' : quota.remaining > 0 ? '#FF9500' : '#FF453A' }}>
            {quota.sent_today}/{quota.daily_limit}
          </span>
          <span style={{ fontSize: '11px', color: '#555' }}>({quota.remaining} còn lại)</span>
          {leads.filter(l => l.outreach_status === 'pending').length > 0 && quota.remaining > 0 && (
            <button onClick={handleBulkSend} disabled={bulkSending} style={{
              padding: '8px 16px', border: 'none', borderRadius: '8px',
              background: bulkSending ? '#333' : '#34C759', color: bulkSending ? '#888' : '#000',
              fontSize: '11px', fontWeight: 800, cursor: bulkSending ? 'wait' : 'pointer', whiteSpace: 'nowrap',
            }}>{bulkSending ? `⏳ ${bulkProgress.current}/${bulkProgress.total}` : `🚀 Gửi batch (${Math.min(leads.filter(l => l.outreach_status === 'pending').length, quota.remaining)})`}</button>
          )}
        </div>
      )}

      {/* Bulk Progress */}
      {bulkSending && (
        <div style={{ background: '#0A84FF10', border: '1px solid #0A84FF30', borderRadius: '10px', padding: '14px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0A84FF' }}>📧 Đang gửi email...</span>
            <span style={{ fontSize: '12px', color: '#888' }}>{bulkProgress.current}/{bulkProgress.total}</span>
          </div>
          <div style={{ height: '6px', background: '#222', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%`, height: '100%', background: '#0A84FF', borderRadius: '3px', transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
            <span style={{ fontSize: '11px', color: '#34C759' }}>✅ {bulkProgress.success}</span>
            <span style={{ fontSize: '11px', color: '#FF453A' }}>❌ {bulkProgress.failed}</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input style={{ ...inputStyle, flex: 1, minWidth: '220px' }} placeholder="🔍 Tìm tên, email, studio..."
          value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        <select style={{ ...inputStyle, width: '160px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <select style={{ ...inputStyle, width: '120px' }} value={filterTier} onChange={e => setFilterTier(e.target.value ? +e.target.value : '')}>
          <option value="">Tất cả tier</option>
          {[1, 2, 3].map(t => <option key={t} value={t}>{TIER_CFG[t].icon} Tier {t}</option>)}
        </select>
        <button onClick={() => setShowImport(!showImport)} style={{
          padding: '10px 16px', border: 'none', borderRadius: '8px', background: '#0A84FF',
          color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
        }}>📥 Import</button>
        <button onClick={() => setShowAddForm(!showAddForm)} style={{
          padding: '10px 16px', border: 'none', borderRadius: '8px', background: '#FF9500',
          color: '#000', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
        }}>＋ Thêm Lead</button>
        <button type="button" onClick={handleVerifyEmails} disabled={verifying} style={{
          padding: '10px 16px', border: 'none', borderRadius: '8px',
          background: verifying ? '#555' : '#34C759',
          color: '#fff', fontSize: '12px', fontWeight: 700, cursor: verifying ? 'not-allowed' : 'pointer',
        }}>{verifying ? '⏳ Đang verify...' : '✅ Verify Emails'}</button>
        <button type="button" onClick={handleCheckBounces} disabled={checkingBounces} style={{
          padding: '10px 16px', border: 'none', borderRadius: '8px',
          background: checkingBounces ? '#555' : '#FF453A',
          color: '#fff', fontSize: '12px', fontWeight: 700, cursor: checkingBounces ? 'not-allowed' : 'pointer',
        }}>{checkingBounces ? '⏳ Scanning...' : '📬 Check Bounces'}</button>
      </div>
      {verifyResult && (
        <div style={{ padding: '8px 14px', background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.3)', borderRadius: '8px', fontSize: '12px', color: '#34C759', marginTop: '8px' }}>
          ✅ Đã verify: {verifyResult.verified} | Hợp lệ: {verifyResult.valid}{verifyResult.high_risk ? ` | ⚠️ High Risk: ${verifyResult.high_risk}` : ''} | ❌ Invalid: {verifyResult.invalid}
        </div>
      )}
      {bounceResult && (
        <div style={{ padding: '8px 14px', background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: '8px', fontSize: '12px', color: '#FF453A', marginTop: '8px' }}>
          📬 Bounces: {bounceResult.bounces_found} tìm thấy | {bounceResult.leads_updated} leads đã cập nhật
          {bounceResult.bounces && bounceResult.bounces.length > 0 && (
            <details style={{ marginTop: '6px' }}>
              <summary style={{ cursor: 'pointer', color: '#FF9500' }}>Chi tiết ({bounceResult.bounces.length})</summary>
              <div style={{ marginTop: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {bounceResult.bounces.map((b: any, i: number) => (
                  <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #222', fontSize: '11px' }}>
                    <span style={{ color: '#FF453A' }}>{b.email}</span>
                    <span style={{ color: '#888', marginLeft: '8px' }}>— {b.reason}</span>
                    <span style={{ color: '#555', marginLeft: '8px' }}>{b.db_status}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Import Panel */}
      {showImport && (
        <div style={{ background: '#161616', border: '1px solid #0A84FF', borderRadius: '12px', padding: '20px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#F5F5F5', marginBottom: '16px' }}>Import Leads</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: '#1A1A1A', borderRadius: '10px', padding: '20px', border: '1px solid #333', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>📄</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#F5F5F5', marginBottom: '6px' }}>Upload CSV</p>
              <p style={{ fontSize: '11px', color: '#888', marginBottom: '14px', lineHeight: 1.5 }}>
                Hỗ trợ SalesQL format: Studio, Contact_Name, Work_Email, Job_Title, Tier
              </p>
              <input type="file" ref={fileRef} accept=".csv" onChange={handleCsvImport} style={{ display: 'none' }} id="csv-imp" />
              <label htmlFor="csv-imp" style={{
                padding: '10px 20px', borderRadius: '8px', background: '#FF9500', color: '#000',
                fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'inline-block',
              }}>Chọn file CSV</label>
            </div>
            <div style={{ background: '#1A1A1A', borderRadius: '10px', padding: '20px', border: '1px solid #333', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>👥</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#F5F5F5', marginBottom: '6px' }}>Từ CRM Clients</p>
              <p style={{ fontSize: '11px', color: '#888', marginBottom: '14px', lineHeight: 1.5 }}>
                Import {clients.length} khách hàng + contacts (bỏ qua trùng email)
              </p>
              <button onClick={handleCrmImport} style={{
                padding: '10px 20px', borderRadius: '8px', background: '#0A84FF', color: '#fff',
                fontSize: '12px', fontWeight: 800, cursor: 'pointer', border: 'none',
              }}>Import từ CRM</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Form */}
      {showAddForm && (
        <div style={{ background: '#161616', border: '1px solid #FF9500', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div><label style={labelStyle}>Studio *</label><input style={inputStyle} value={addForm.studio_name} onChange={e => setAddForm({ ...addForm, studio_name: e.target.value })} /></div>
            <div><label style={labelStyle}>Contact Name *</label><input style={inputStyle} value={addForm.contact_name} onChange={e => setAddForm({ ...addForm, contact_name: e.target.value, first_name: e.target.value.split(' ')[0] })} /></div>
            <div><label style={labelStyle}>Email *</label><input style={inputStyle} value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div><label style={labelStyle}>Job Title</label><input style={inputStyle} value={addForm.job_title} onChange={e => setAddForm({ ...addForm, job_title: e.target.value })} /></div>
            <div><label style={labelStyle}>LinkedIn URL</label><input style={inputStyle} value={addForm.linkedin_url} onChange={e => setAddForm({ ...addForm, linkedin_url: e.target.value })} /></div>
            <div><label style={labelStyle}>Tier</label>
              <select style={inputStyle} value={addForm.tier} onChange={e => setAddForm({ ...addForm, tier: +e.target.value })}>
                {[1, 2, 3].map(t => <option key={t} value={t}>{TIER_CFG[t].icon} {TIER_CFG[t].label} — {TIER_CFG[t].desc}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAddForm(false)} style={{ padding: '8px 16px', border: '1px solid #333', borderRadius: '8px', background: 'transparent', color: '#ccc', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Huỷ</button>
            <button onClick={handleAdd} style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', background: '#FF9500', color: '#000', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>Thêm Lead</button>
          </div>
        </div>
      )}

      {/* Status pills */}
      {leads.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {Object.entries(STATUS_CFG).map(([key, cfg]) => {
            const count = leads.filter(l => l.outreach_status === key).length;
            if (count === 0 && filterStatus !== key) return null;
            return (
              <button key={key} onClick={() => setFilterStatus(filterStatus === key ? '' : key)} style={{
                padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                background: filterStatus === key ? cfg.color + '20' : '#161616',
                border: `1px solid ${filterStatus === key ? cfg.color + '40' : '#333'}`,
                color: filterStatus === key ? cfg.color : '#888', cursor: 'pointer',
              }}>{cfg.icon} {cfg.label} ({count})</button>
            );
          })}
        </div>
      )}

      {/* Leads Table */}
      {isLoading ? (
        <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>Đang tải...</p>
      ) : leads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#161616', border: '1px solid #222', borderRadius: '12px' }}>
          <p style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.4 }}>👥</p>
          <p style={{ fontSize: '14px', color: '#888', fontWeight: 700 }}>Chưa có leads</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                {['Tier', 'Contact', 'Email', 'Studio', 'Chức vụ', 'Trạng thái', 'Nguồn', 'Actions'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#666' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => {
                const tc = TIER_CFG[lead.tier] || TIER_CFG[3];
                const sc = STATUS_CFG[lead.outreach_status] || STATUS_CFG.pending;
                return (
                  <tr key={lead.id} style={{ borderBottom: '1px solid #1A1A1A', transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#161616'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <td style={{ padding: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: tc.color + '15', color: tc.color }}>{tc.icon} {tc.label}</span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: 600, color: '#F5F5F5' }}>{lead.contact_name || '—'}</div>
                      {lead.linkedin_url && <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', color: '#0A84FF' }}>LinkedIn ↗</a>}
                    </td>
                    <td style={{ padding: '10px', color: '#0A84FF', fontSize: '12px' }}>{lead.email}</td>
                    <td style={{ padding: '10px', color: '#ccc' }}>{lead.studio_name || '—'}</td>
                    <td style={{ padding: '10px', color: '#888', fontSize: '12px' }}>{lead.job_title || '—'}</td>
                    <td style={{ padding: '10px' }}>
                      <select value={lead.outreach_status} onChange={e => handleStatusChange(lead.id, e.target.value)} style={{
                        fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                        background: sc.color + '15', color: sc.color, border: `1px solid ${sc.color}30`, cursor: 'pointer', outline: 'none',
                      }}>
                        {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k} style={{ background: '#1A1A1A', color: v.color }}>{v.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px', fontSize: '10px', color: '#555' }}>{lead.source}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {(() => {
                          const next = getNextTemplate(lead);
                          if (!next) return null;
                          return (
                            <button
                              onClick={() => { if (confirm(`Gửi "${next.label}" tới ${lead.email}?`)) handleSendEmail(lead.id, next.name); }}
                              disabled={sendingId === lead.id}
                              style={{
                                padding: '4px 10px', border: 'none', borderRadius: '4px',
                                background: sendingId === lead.id ? '#333' : 'rgba(52,199,89,0.15)',
                                color: sendingId === lead.id ? '#888' : '#34C759',
                                fontSize: '10px', fontWeight: 700, cursor: sendingId === lead.id ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                              }}
                            >{sendingId === lead.id ? '⏳...' : `📧 ${next.label}`}</button>
                          );
                        })()}
                        <button onClick={() => { if (confirm('Xoá lead?')) handleDelete(lead.id); }} style={{
                          padding: '4px 8px', border: 'none', borderRadius: '4px', background: 'rgba(255,69,58,0.1)',
                          color: '#FF453A', fontSize: '11px', cursor: 'pointer',
                        }}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// ── DISCOVERY TAB ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

/** Fuzzy match: check if query appears in target (normalized, word-order agnostic) */
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (!q || !t) return false;
  if (t.includes(q) || q.includes(t)) return true;
  // word-level: all words in query appear in target
  const words = q.split(/\s+/).filter(w => w.length > 2);
  return words.length > 0 && words.every(w => t.includes(w));
}

const DiscoveryTab: React.FC<{ onRefresh: () => void; leads: CrmOutreachLead[] }> = ({ onRefresh, leads }) => {
  const [company, setCompany] = useState('');
  const [domain, setDomain] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Unique studio names from existing leads
  const existingStudios = useMemo(() => {
    const map = new Map<string, { studio: string; emails: number; status: string }>();
    for (const l of leads) {
      const key = (l.studio_name || '').trim();
      if (!key) continue;
      if (!map.has(key)) map.set(key, { studio: key, emails: 0, status: l.outreach_status });
      map.get(key)!.emails++;
    }
    return Array.from(map.values());
  }, [leads]);

  // Fuzzy suggestions based on current company input
  const suggestions = useMemo(() => {
    if (!company.trim() || company.length < 2) return [];
    return existingStudios.filter(s => fuzzyMatch(company, s.studio)).slice(0, 5);
  }, [company, existingStudios]);

  // Batch import state
  const [showImport, setShowImport] = useState(false);
  const [importList, setImportList] = useState<{ company: string; domain: string }[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, found: 0, failed: 0 });
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [manualAdd, setManualAdd] = useState({ company: '', domain: '' });
  const importRef = useRef<HTMLInputElement>(null);
  const batchPollRef = useRef<number | null>(null);

  // Cleanup poll on unmount
  useEffect(() => () => { if (batchPollRef.current) clearInterval(batchPollRef.current); }, []);

  const handleDiscover = async () => {
    if (!company.trim()) return;
    setDiscovering(true); setError(''); setResults(null);
    try {
      const contacts = await svc.discoverContacts(company, domain);
      setResults(contacts);
    } catch (err: any) {
      setError(err.message || 'Discovery failed');
    } finally { setDiscovering(false); }
  };

  const handleAddToLeads = async (contact: any, studioName?: string) => {
    try {
      await svc.createLead({
        client_id: null,
        studio_name: studioName || company,
        contact_name: contact.name || '',
        first_name: (contact.name || '').split(' ')[0],
        email: contact.email || '',
        job_title: contact.title || '',
        linkedin_url: contact.linkedin_url || '',
        tier: contact.tier_num || 3,
        outreach_status: 'pending',
        initial_sent_at: null, followup1_sent_at: null, followup2_sent_at: null, replied_at: null,
        source: 'discovery', tags: [], notes: '',
      });
      onRefresh();
      alert(`Đã thêm ${contact.name} vào leads!`);
    } catch (err: any) { alert('Error: ' + err.message); }
  };

  // Add ALL contacts from single discovery result at once
  const handleAddAllSingle = async () => {
    if (!results || results.length === 0) return;
    const eligible = results.filter(c => c.email);
    if (!confirm(`Thêm ${eligible.length} contacts của "${company}" vào Leads?`)) return;
    let added = 0;
    for (const c of eligible) {
      try {
        await svc.createLead({
          client_id: null, studio_name: company,
          contact_name: c.name || '', first_name: (c.name || '').split(' ')[0],
          email: c.email || '', job_title: c.title || '',
          linkedin_url: c.linkedin_url || '', tier: c.tier_num || 3,
          outreach_status: 'pending',
          initial_sent_at: null, followup1_sent_at: null, followup2_sent_at: null, replied_at: null,
          source: 'discovery', tags: [], notes: '',
        });
        added++;
      } catch { /* skip duplicate email */ }
    }
    alert(`✅ Đã thêm ${added}/${eligible.length} contacts vào Leads!`);
    onRefresh();
  };

  // Parse CSV file for company list
  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const header = lines[0].toLowerCase();
      const hasHeader = header.includes('company') || header.includes('name') || header.includes('domain') || header.includes('studio');
      const startIdx = hasHeader ? 1 : 0;

      const parsed: { company: string; domain: string }[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(/[,;\t]/).map(s => s.replace(/"/g, '').trim());
        if (parts[0]) {
          parsed.push({ company: parts[0], domain: parts[1] || '' });
        }
      }
      setImportList(prev => {
        // Deduplicate
        const existing = new Set(prev.map(p => p.company.toLowerCase()));
        const newOnes = parsed.filter(p => !existing.has(p.company.toLowerCase()));
        return [...prev, ...newOnes];
      });
      if (importRef.current) importRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Add single company manually
  const handleManualAdd = () => {
    if (!manualAdd.company.trim()) return;
    setImportList(prev => {
      if (prev.some(p => p.company.toLowerCase() === manualAdd.company.toLowerCase())) return prev;
      return [...prev, { company: manualAdd.company.trim(), domain: manualAdd.domain.trim() }];
    });
    setManualAdd({ company: '', domain: '' });
  };

  // Remove from list
  const handleRemove = (idx: number) => {
    setImportList(prev => prev.filter((_, i) => i !== idx));
  };

  // Run batch discovery — background job on server, poll for status
  const handleBatchDiscovery = async () => {
    if (importList.length === 0) return;
    if (!confirm(`Chạy Discovery cho ${importList.length} công ty?\n\nServer sẽ tự động tìm contacts qua Web Scraping + Google CSE + SalesQL.\nBạn có thể tiếp tục dùng app trong lúc chờ.`)) return;

    setBatchRunning(true);
    setBatchProgress({ current: 0, total: importList.length, found: 0, failed: 0 });
    setBatchResults([]);

    let jobId: string;
    try {
      const started = await svc.discoverBatch(importList);
      jobId = started.job_id;
    } catch (err: any) {
      setBatchRunning(false);
      alert('Không thể khởi động batch: ' + err.message);
      return;
    }

    // Poll every 3s until done
    batchPollRef.current = window.setInterval(async () => {
      try {
        const status = await svc.getDiscoverBatchStatus(jobId);
        setBatchProgress({
          current: status.current,
          total: status.total,
          found: status.results?.length ?? 0,
          failed: status.error_count,
        });

        if (status.status === 'done') {
          clearInterval(batchPollRef.current!);
          batchPollRef.current = null;
          setBatchRunning(false);

          // Group flat results by company for display
          const grouped: Record<string, any[]> = {};
          for (const c of status.results ?? []) {
            const key = c.company || 'Unknown';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(c);
          }
          const groupedArr = Object.entries(grouped).map(([company, contacts]) => ({
            company, contacts, status: 'ok' as const,
          }));
          for (const e of status.errors ?? []) {
            groupedArr.push({ company: e.company, contacts: [], status: 'error' as const });
          }
          setBatchResults(groupedArr);

          const totalFound = status.results?.length ?? 0;
          alert(`✅ Batch Discovery hoàn thành!\n\nĐã quét: ${status.total} công ty\nTìm thấy: ${totalFound} contacts\nThất bại: ${status.error_count}`);
          onRefresh();
        }
      } catch { /* transient poll error, retry next interval */ }
    }, 3000);
  };

  // Add all contacts from batch results to leads
  const handleAddAllToLeads = async () => {
    const allContacts = batchResults.flatMap(r => r.contacts.map((c: any) => ({ ...c, _studio: r.company })));
    if (allContacts.length === 0) { alert('Không có contacts để thêm.'); return; }
    if (!confirm(`Thêm ${allContacts.length} contacts vào Leads?`)) return;

    let added = 0;
    for (const c of allContacts) {
      try {
        await svc.createLead({
          client_id: null,
          studio_name: c._studio,
          contact_name: c.name || '',
          first_name: (c.name || '').split(' ')[0],
          email: c.email || '',
          job_title: c.title || '',
          linkedin_url: c.linkedin_url || '',
          tier: c.tier_num || 3,
          outreach_status: 'pending',
          initial_sent_at: null, followup1_sent_at: null, followup2_sent_at: null, replied_at: null,
          source: 'batch_discovery', tags: [], notes: '',
        });
        added++;
      } catch { /* skip duplicate */ }
    }
    alert(`✅ Đã thêm ${added}/${allContacts.length} contacts vào Leads!`);
    onRefresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Single Discovery */}
      <div style={{ background: '#161616', border: '1px solid #FF950030', borderRadius: '12px', padding: '20px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#F5F5F5', marginBottom: '8px' }}>🔍 Lead Discovery Pipeline</h4>
        <p style={{ fontSize: '13px', color: '#888', lineHeight: 1.6, marginBottom: '16px' }}>
          Nhập tên công ty + domain → Hệ thống tự động tìm contacts qua Web Scraping, Google CSE, và SalesQL Enrichment.
          Contacts được phân loại theo 3-tier: ⭐Tier 1 (Art Director), ★Tier 2 (Producer), ☆Tier 3 (CEO/BD).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: '12px', alignItems: 'end' }}>
          <div style={{ position: 'relative' }}>
            <label style={labelStyle}>Company Name *</label>
            <input
              style={inputStyle} value={company}
              onChange={e => { setCompany(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Supercell"
            />
            {/* Fuzzy suggestion dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: '#1E1E1E', border: '1px solid #FF950060', borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)', marginTop: '4px', overflow: 'hidden',
              }}>
                <div style={{ padding: '6px 12px', fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #333' }}>
                  ⚠️ Công ty đã có trong Leads
                </div>
                {suggestions.map((s, i) => (
                  <div key={i} onClick={() => { setCompany(s.studio); setShowSuggestions(false); }}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #2A2A2A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FF950015')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: '12px', color: '#F5F5F5', fontWeight: 600 }}>{s.studio}</span>
                    <span style={{ fontSize: '10px', color: '#888' }}>{s.emails} leads · {s.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div><label style={labelStyle}>Domain (optional)</label>
            <input style={inputStyle} value={domain} onChange={e => setDomain(e.target.value)} placeholder="supercell.com" /></div>
          <button onClick={handleDiscover} disabled={discovering || !company.trim()} style={{
            padding: '10px 24px', border: 'none', borderRadius: '8px',
            background: discovering ? '#333' : '#FF9500', color: discovering ? '#888' : '#000',
            fontSize: '12px', fontWeight: 800, cursor: discovering ? 'wait' : 'pointer', whiteSpace: 'nowrap',
            height: '42px',
          }}>{discovering ? '⏳ Đang tìm...' : '🔍 Discover'}</button>
        </div>
      </div>

      {/* ── Batch Import Section ── */}
      <div style={{ background: '#161616', border: '1px solid #0A84FF30', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#F5F5F5' }}>📋 Batch Discovery — Import danh sách công ty</h4>
          <button onClick={() => setShowImport(!showImport)} style={{
            padding: '6px 14px', border: '1px solid #0A84FF50', borderRadius: '8px',
            background: showImport ? '#0A84FF20' : 'transparent', color: '#0A84FF',
            fontSize: '12px', fontWeight: 700, cursor: 'pointer',
          }}>{showImport ? '▲ Thu gọn' : '▼ Mở rộng'}</button>
        </div>

        {showImport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* CSV Upload + Manual add */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>📥 Upload CSV</label>
                <input ref={importRef} type="file" accept=".csv,.txt,.tsv" onChange={handleCsvImport} style={{
                  ...inputStyle, padding: '8px', fontSize: '12px',
                }} />
              </div>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label style={labelStyle}>Thêm thủ công - Company</label>
                <input style={inputStyle} value={manualAdd.company} onChange={e => setManualAdd(p => ({ ...p, company: e.target.value }))}
                  placeholder="Zynga" onKeyDown={e => e.key === 'Enter' && handleManualAdd()} />
              </div>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label style={labelStyle}>Domain</label>
                <input style={inputStyle} value={manualAdd.domain} onChange={e => setManualAdd(p => ({ ...p, domain: e.target.value }))}
                  placeholder="zynga.com" onKeyDown={e => e.key === 'Enter' && handleManualAdd()} />
              </div>
              <button onClick={handleManualAdd} style={{
                padding: '10px 14px', border: 'none', borderRadius: '8px', background: '#34C759',
                color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', height: '42px',
              }}>＋ Thêm</button>
            </div>

            <p style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
              ℹ️ CSV format: company_name, domain (mỗi dòng 1 công ty). Cột domain là optional.
            </p>

            {/* Company List */}
            {importList.length > 0 && (
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #333', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #333', position: 'sticky', top: 0, background: '#1A1A1A' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: '#666', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>#</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: '#666', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Company</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: '#666', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Domain</th>
                      <th style={{ padding: '8px 12px', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {importList.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #222' }}>
                        <td style={{ padding: '6px 12px', color: '#555' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 12px', color: '#F5F5F5', fontWeight: 600 }}>{item.company}</td>
                        <td style={{ padding: '6px 12px', color: '#0A84FF', fontSize: '11px' }}>{item.domain || '—'}</td>
                        <td style={{ padding: '6px 12px' }}>
                          <button onClick={() => handleRemove(idx)} style={{
                            border: 'none', background: 'none', color: '#FF453A', cursor: 'pointer', fontSize: '14px',
                          }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button onClick={handleBatchDiscovery} disabled={batchRunning || importList.length === 0} style={{
                padding: '10px 24px', border: 'none', borderRadius: '8px',
                background: batchRunning ? '#333' : '#FF9500', color: batchRunning ? '#888' : '#000',
                fontSize: '13px', fontWeight: 800, cursor: batchRunning ? 'wait' : 'pointer',
              }}>{batchRunning ? `⏳ Đang quét ${batchProgress.current}/${batchProgress.total}...` : `🚀 Chạy Discovery (${importList.length} công ty)`}</button>
              {importList.length > 0 && !batchRunning && (
                <button onClick={() => { if (confirm('Xóa toàn bộ danh sách?')) setImportList([]); }} style={{
                  padding: '10px 14px', border: '1px solid #FF453A30', borderRadius: '8px',
                  background: 'transparent', color: '#FF453A', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}>🗑 Xóa danh sách</button>
              )}
              <span style={{ fontSize: '12px', color: '#888' }}>
                {importList.length > 0 && `${importList.length} công ty`}
              </span>
            </div>

            {/* Batch Progress */}
            {batchRunning && (
              <div style={{ background: '#FF950010', border: '1px solid #FF950030', borderRadius: '10px', padding: '14px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#FF9500', fontWeight: 600 }}>⏳ Đang chạy batch discovery...</span>
                  <span style={{ fontSize: '12px', color: '#888' }}>{batchProgress.current}/{batchProgress.total}</span>
                </div>
                <div style={{ height: '6px', background: '#222', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${batchProgress.total ? (batchProgress.current / batchProgress.total * 100) : 0}%`, background: 'linear-gradient(90deg, #FF9500, #FFD60A)', borderRadius: '3px', transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '11px' }}>
                  <span style={{ color: '#34C759' }}>✅ Tìm thấy: {batchProgress.found}</span>
                  <span style={{ color: '#FF453A' }}>❌ Lỗi: {batchProgress.failed}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Batch Results */}
      {batchResults.length > 0 && (
        <div style={{ background: '#161616', border: '1px solid #34C75930', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#F5F5F5' }}>
              📊 Kết quả Batch: {batchResults.reduce((sum, r) => sum + r.contacts.length, 0)} contacts từ {batchResults.filter(r => r.status === 'ok').length}/{batchResults.length} công ty
            </h4>
            {batchResults.some(r => r.contacts.length > 0) && (
              <button onClick={handleAddAllToLeads} style={{
                padding: '6px 14px', border: 'none', borderRadius: '6px', background: '#34C759',
                color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
              }}>＋ Thêm tất cả vào Leads</button>
            )}
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {batchResults.map((r, ri) => (
              <div key={ri} style={{ borderBottom: '1px solid #1A1A1A' }}>
                <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1A1A1A' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: r.status === 'ok' ? '#34C759' : r.status === 'empty' ? '#888' : '#FF453A' }}>
                    {r.status === 'ok' ? '✅' : r.status === 'empty' ? '⬚' : '❌'} {r.company}
                    <span style={{ color: '#555', fontWeight: 400, marginLeft: '8px' }}>({r.contacts.length} contacts)</span>
                  </span>
                </div>
                {r.contacts.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <tbody>
                      {r.contacts.map((c: any, ci: number) => {
                        const tc = TIER_CFG[c.tier_num] || TIER_CFG[3];
                        return (
                          <tr key={ci} style={{ borderBottom: '1px solid #161616' }}>
                            <td style={{ padding: '6px 12px 6px 32px', width: '80px' }}><span style={{ fontSize: '10px', color: tc.color, fontWeight: 700 }}>{tc.icon} T{c.tier_num}</span></td>
                            <td style={{ padding: '6px 12px', color: '#F5F5F5', fontWeight: 600 }}>{c.name}</td>
                            <td style={{ padding: '6px 12px', color: '#888', fontSize: '11px' }}>{c.title}</td>
                            <td style={{ padding: '6px 12px', color: '#0A84FF', fontSize: '11px' }}>{c.email}</td>
                            <td style={{ padding: '6px 8px', width: '60px' }}>
                              <button onClick={() => handleAddToLeads(c, r.company)} style={{
                                padding: '3px 8px', border: 'none', borderRadius: '4px', background: '#34C75920',
                                color: '#34C759', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                              }}>＋ Add</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: '#FF453A15', border: '1px solid #FF453A30', borderRadius: '10px', padding: '14px 20px' }}>
          <p style={{ fontSize: '13px', color: '#FF453A', fontWeight: 600 }}>⚠️ {error}</p>
          {(error.includes('Outreach API') || error.includes('OUTREACH') || error.includes('outreach-proxy')) && (
            <p style={{ fontSize: '12px', color: '#888', marginTop: '6px' }}>
              Cấu hình <code style={{ color: '#ccc' }}>VITE_OUTREACH_API_URL</code> (FastAPI + CORS) hoặc deploy Edge{' '}
              <code style={{ color: '#ccc' }}>outreach-proxy</code> trên Supabase và secret{' '}
              <code style={{ color: '#ccc' }}>OUTREACH_API_URL</code>.
            </p>
          )}
        </div>
      )}

      {/* Single Discovery Results */}
      {results && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#555' }}>Không tìm thấy contacts</div>
      )}
      {results && results.length > 0 && (
        <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#F5F5F5' }}>Kết quả: {results.length} contacts — <span style={{ color: '#888', fontWeight: 400 }}>{company}</span></h4>
            <button onClick={handleAddAllSingle} style={{
              padding: '6px 14px', border: 'none', borderRadius: '6px', background: '#34C759',
              color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            }}>＋ Thêm tất cả vào Leads</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                {['Tier', 'Name', 'Title', 'Email', 'LinkedIn', ''].map((h, i) => (
                  <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#666' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((c: any, i: number) => {
                const tc = TIER_CFG[c.tier_num] || TIER_CFG[3];
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #1A1A1A' }}>
                    <td style={{ padding: '8px 12px' }}><span style={{ fontSize: '11px', fontWeight: 700, color: tc.color }}>{tc.icon} {tc.label}</span></td>
                    <td style={{ padding: '8px 12px', color: '#F5F5F5', fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: '8px 12px', color: '#888', fontSize: '12px' }}>{c.title}</td>
                    <td style={{ padding: '8px 12px', color: '#0A84FF', fontSize: '12px' }}>{c.email}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#0A84FF' }}>↗</a>}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <button onClick={() => handleAddToLeads(c)} style={{
                        padding: '4px 10px', border: 'none', borderRadius: '6px', background: '#34C75920',
                        color: '#34C759', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                      }}>＋ Add</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// ── TEMPLATES TAB ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

const TemplatesTab: React.FC<{ templates: CrmEmailTemplate[]; onRefresh: () => void; onPreview: (html: string) => void }> = ({ templates, onRefresh, onPreview }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ subject_lines: [''], html_content: '', delay_days: 0 });

  const handleEdit = (tpl: CrmEmailTemplate) => {
    setEditingId(tpl.id);
    setEditForm({
      subject_lines: tpl.subject_lines.length > 0 ? [...tpl.subject_lines] : [''],
      html_content: tpl.html_content,
      delay_days: tpl.delay_days,
    });
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      await svc.updateTemplate(editingId, {
        subject_lines: editForm.subject_lines.filter(s => s.trim()),
        html_content: editForm.html_content,
        delay_days: editForm.delay_days,
      });
      setEditingId(null); onRefresh();
    } catch (err: any) { alert('Error: ' + err.message); }
  };

  const STEP_NAMES: Record<string, { step: number; desc: string; icon: string }> = {
    'initial_outreach': { step: 1, desc: 'First Contact — Giới thiệu TD Games + Free Trial', icon: '📤' },
    'followup_1':       { step: 2, desc: 'Follow-up — Portfolio highlights + Case study', icon: '📨' },
    'followup_2':       { step: 3, desc: 'Breakup — Standing offer + Wish well', icon: '📩' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ fontSize: '13px', color: '#888' }}>
        Email sequence 3 bước. Mỗi step có delay tính từ step trước. Dùng biến: {'{contact_name}'}, {'{studio_name}'}, {'{company}'}.
      </p>

      {/* Sequence Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {templates.map((tpl, idx) => {
          const info = STEP_NAMES[tpl.name] || { step: idx + 1, desc: tpl.name, icon: '📧' };
          const isEditing = editingId === tpl.id;

          return (
            <div key={tpl.id} style={{
              background: '#161616', border: `1px solid ${isEditing ? '#FF9500' : '#222'}`, borderRadius: '12px', overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '16px 20px' }}>
                {/* Step number */}
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  background: '#FF950015', border: '1px solid #FF950025',
                }}>
                  <span style={{ fontSize: '12px' }}>{info.icon}</span>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#FF9500' }}>{info.step}</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#F5F5F5' }}>Step {info.step}: {tpl.name.replace(/_/g, ' ')}</span>
                    {tpl.delay_days > 0 && <span style={{ fontSize: '11px', color: '#FF9500', fontWeight: 600 }}>⏰ +{tpl.delay_days} ngày</span>}
                    <span style={{
                      fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                      background: tpl.is_active ? '#34C75915' : '#FF453A15',
                      color: tpl.is_active ? '#34C759' : '#FF453A',
                    }}>{tpl.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>{info.desc}</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {tpl.subject_lines.map((s, si) => (
                      <span key={si} style={{
                        fontSize: '11px', padding: '3px 8px', borderRadius: '4px',
                        background: '#0A84FF15', color: '#0A84FF', fontWeight: 600, maxWidth: '300px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>📧 {s}</span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {tpl.html_content && tpl.html_content !== 'placeholder' && (
                    <button onClick={() => onPreview(tpl.html_content)} style={{
                      padding: '6px 10px', border: '1px solid #0A84FF30', borderRadius: '6px',
                      background: 'rgba(10,132,255,0.1)', color: '#0A84FF', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                    }}>👁️ Preview</button>
                  )}
                  <button onClick={() => isEditing ? setEditingId(null) : handleEdit(tpl)} style={{
                    padding: '6px 10px', border: '1px solid #FF950030', borderRadius: '6px',
                    background: 'rgba(255,149,0,0.1)', color: '#FF9500', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  }}>{isEditing ? '✕ Đóng' : '✏️ Sửa'}</button>
                </div>
              </div>

              {/* Edit Form */}
              {isEditing && (
                <div style={{ borderTop: '1px solid #222', padding: '20px', background: '#111' }}>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Subject Lines (A/B test)</label>
                    {editForm.subject_lines.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                        <input style={{ ...inputStyle, flex: 1 }} value={s}
                          onChange={e => { const arr = [...editForm.subject_lines]; arr[i] = e.target.value; setEditForm({ ...editForm, subject_lines: arr }); }}
                          placeholder={`Subject variant ${i + 1}...`} />
                        {editForm.subject_lines.length > 1 && (
                          <button onClick={() => setEditForm({ ...editForm, subject_lines: editForm.subject_lines.filter((_, idx) => idx !== i) })}
                            style={{ padding: '0 10px', border: 'none', borderRadius: '6px', background: 'rgba(255,69,58,0.1)', color: '#FF453A', cursor: 'pointer' }}>✕</button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => setEditForm({ ...editForm, subject_lines: [...editForm.subject_lines, ''] })}
                      style={{ padding: '4px 12px', border: '1px dashed #555', borderRadius: '6px', background: 'transparent', color: '#888', fontSize: '11px', cursor: 'pointer' }}>+ Thêm variant</button>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
                    <div style={{ width: '120px' }}><label style={labelStyle}>Delay (ngày)</label>
                      <input type="number" min={0} style={inputStyle} value={editForm.delay_days} onChange={e => setEditForm({ ...editForm, delay_days: +e.target.value })} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>HTML Content</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {['{contact_name}', '{studio_name}', '{company}'].map(v => (
                            <button key={v} onClick={() => setEditForm({ ...editForm, html_content: editForm.html_content + v })} style={{
                              padding: '2px 6px', border: '1px solid #444', borderRadius: '4px', background: 'transparent',
                              color: '#FF9500', fontSize: '9px', fontWeight: 700, cursor: 'pointer',
                            }}>{v}</button>
                          ))}
                        </div>
                      </div>
                      <textarea style={{ ...inputStyle, minHeight: '160px', fontFamily: 'monospace', fontSize: '11px' }}
                        value={editForm.html_content} onChange={e => setEditForm({ ...editForm, html_content: e.target.value })} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingId(null)} style={{ padding: '8px 16px', border: '1px solid #333', borderRadius: '8px', background: 'transparent', color: '#ccc', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Huỷ</button>
                    {editForm.html_content && editForm.html_content !== 'placeholder' && (
                      <button onClick={() => onPreview(editForm.html_content)} style={{ padding: '8px 16px', border: '1px solid #0A84FF', borderRadius: '8px', background: 'transparent', color: '#0A84FF', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>👁️ Preview</button>
                    )}
                    <button onClick={handleSave} style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', background: '#FF9500', color: '#000', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>💾 Lưu</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Arrow connectors between steps */}
      {templates.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#555' }}>
          <p style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.4 }}>📝</p>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#888' }}>Chưa có template nào</p>
        </div>
      )}


    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// ── SETTINGS TAB ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

const SettingsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [s, setS] = useState<svc.OutreachSettings | null>(null);
  // Local draft (chỉ commit khi user bấm Save)
  const [draft, setDraft] = useState<svc.OutreachSettings | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await svc.fetchOutreachSettings();
      setS(data); setDraft(data);
    } catch (e: any) { setError(e.message || String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasChange = !!s && !!draft && JSON.stringify(s) !== JSON.stringify(draft);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true); setError(null); setOkMsg(null);
    try {
      const updated = await svc.updateOutreachSettings(
        {
          resend_from:         draft.resend_from,
          resend_reply_to:     draft.resend_reply_to,
          resend_tag_campaign: draft.resend_tag_campaign,
          sending_paused:      draft.sending_paused,
          daily_limit:         draft.daily_limit,
        },
        'crm-ui',
      );
      setS(updated); setDraft(updated);
      setOkMsg('✅ Đã lưu — settings có hiệu lực trong tối đa 30 giây (cache).');
    } catch (e: any) { setError(e.message || String(e)); }
    finally { setSaving(false); }
  };

  const set = <K extends keyof svc.OutreachSettings>(k: K, v: svc.OutreachSettings[K]) =>
    setDraft(prev => prev ? { ...prev, [k]: v } : prev);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '40px', color: '#888' }} className="animate-pulse">
      Đang tải settings...
    </div>
  );

  if (!draft) return (
    <div style={{ padding: '20px', background: '#1A1A1A', border: '1px solid #FF453A40', borderRadius: '12px', color: '#FF453A' }}>
      Lỗi tải settings: {error || 'unknown'}
    </div>
  );

  const isEnvSource = s?.source === 'env';

  return (
    <div className="animate-fadeInUp" style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '720px' }}>
      <div>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#F5F5F5' }}>⚙️ Outreach Settings</h3>
        <p style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>
          Cấu hình runtime cho cold outreach. Thay đổi áp dụng trong vòng ~30s (cache TTL).
        </p>
      </div>

      {isEnvSource && (
        <div style={{ padding: '12px 16px', background: '#FF950015', border: '1px solid #FF950030', borderRadius: '8px', fontSize: '12px', color: '#FF9500' }}>
          ⚠️ Đang đọc từ <b>ENV fallback</b> (DB chưa migrate). Lưu lần đầu sẽ tạo record vĩnh viễn.
        </div>
      )}

      {/* From */}
      <div>
        <label style={labelStyle}>📤 Email gửi đi (From)</label>
        <input
          style={inputStyle} type="text"
          placeholder='Tony Dang <tony@tdgamestudio.com>'
          value={draft.resend_from}
          onChange={e => set('resend_from', e.target.value)}
        />
        <p style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
          Định dạng: <code>"Display Name &lt;email@domain&gt;"</code>. Domain PHẢI đã verify trên Resend.
        </p>
      </div>

      {/* Reply-To */}
      <div>
        <label style={labelStyle}>↩️ Email nhận reply (Reply-To)</label>
        <input
          style={inputStyle} type="email"
          placeholder='toan.dang@tdgamestudio.com'
          value={draft.resend_reply_to}
          onChange={e => set('resend_reply_to', e.target.value)}
        />
        <p style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
          Khi recipient bấm Reply, mail sẽ về địa chỉ này. Nên là Gmail Workspace bạn check hàng ngày.
        </p>
      </div>

      {/* Campaign tag */}
      <div>
        <label style={labelStyle}>🏷️ Campaign tag (Resend dashboard)</label>
        <input
          style={inputStyle} type="text"
          placeholder='outreach'
          value={draft.resend_tag_campaign}
          onChange={e => set('resend_tag_campaign', e.target.value)}
        />
      </div>

      {/* Daily limit */}
      <div>
        <label style={labelStyle}>📊 Giới hạn email/ngày</label>
        <input
          style={{ ...inputStyle, width: '140px' }} type="number" min={0} max={1000}
          value={draft.daily_limit}
          onChange={e => set('daily_limit', Number(e.target.value) || 0)}
        />
        <p style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
          Warm-up: tuần 1 ≤10, tuần 2 ≤30, tăng dần. Resend free = 100/ngày tối đa.
        </p>
      </div>

      {/* Pause toggle */}
      <div style={{
        padding: '14px 16px',
        background: draft.sending_paused ? '#FF453A15' : '#34C75915',
        border: `1px solid ${draft.sending_paused ? '#FF453A40' : '#34C75940'}`,
        borderRadius: '10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: draft.sending_paused ? '#FF453A' : '#34C759' }}>
            {draft.sending_paused ? '⏸️ Sending PAUSED' : '▶️ Sending ACTIVE'}
          </div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
            {draft.sending_paused
              ? 'Mọi /send và /batch bị chặn (503). Verify endpoints vẫn chạy.'
              : 'Sẵn sàng gửi. Chỉ bật khi list đã verify và bounce rate < 5%.'}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!draft.sending_paused}
            onChange={e => set('sending_paused', !e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#F5F5F5' }}>
            {draft.sending_paused ? 'Bật gửi' : 'Đang gửi'}
          </span>
        </label>
      </div>

      {/* Errors / messages */}
      {error && (
        <div style={{ padding: '12px 16px', background: '#FF453A15', border: '1px solid #FF453A40', borderRadius: '8px', fontSize: '12px', color: '#FF453A' }}>
          ❌ {error}
        </div>
      )}
      {okMsg && !error && (
        <div style={{ padding: '12px 16px', background: '#34C75915', border: '1px solid #34C75940', borderRadius: '8px', fontSize: '12px', color: '#34C759' }}>
          {okMsg}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #222' }}>
        <button
          type="button" onClick={handleSave} disabled={!hasChange || saving}
          style={{
            padding: '10px 22px', borderRadius: '8px', border: 'none',
            background: !hasChange || saving ? '#333' : 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
            color: !hasChange || saving ? '#666' : '#fff',
            fontSize: '13px', fontWeight: 800, cursor: !hasChange || saving ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}
        >
          {saving ? '⏳ Đang lưu...' : '💾 Lưu thay đổi'}
        </button>
        <button
          type="button" onClick={() => draft && s && setDraft(s)} disabled={!hasChange || saving}
          style={{
            padding: '10px 18px', borderRadius: '8px', border: '1px solid #333', background: 'transparent',
            color: '#888', fontSize: '12px', fontWeight: 700, cursor: hasChange ? 'pointer' : 'not-allowed',
          }}
        >
          Reset
        </button>
        <button
          type="button" onClick={load} disabled={loading || saving}
          style={{
            padding: '10px 18px', borderRadius: '8px', border: '1px solid #333', background: 'transparent',
            color: '#888', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
          }}
        >
          🔄 Reload
        </button>
        <span style={{ fontSize: '11px', color: '#555', marginLeft: 'auto' }}>
          Nguồn: <code>{s?.source || '?'}</code>
          {s?.updated_at && ` • cập nhật ${new Date(s.updated_at).toLocaleString('vi-VN')}`}
          {s?.updated_by && ` bởi ${s.updated_by}`}
        </span>
      </div>
    </div>
  );
};

export default EmailOutreach;
