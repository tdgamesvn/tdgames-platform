import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabaseEdgeFunctionPost, outreachRequest } from '../services/outreachApi';

// ── Shared styles (mirrors EmailOutreach.tsx) ──────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#1A1A1A', border: '1px solid #333',
  borderRadius: '8px', color: '#F5F5F5', fontSize: '13px', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888',
};

// ── Types ──────────────────────────────────────────────────────
interface AutoDiscoveryConfig {
  enabled: boolean;
  countries: string[];
  monthly_credits: number;
  studios_per_run: number;
  re_discover_after_days: number;
  current_country_index: number;
  current_page: number;
  last_run_at: string | null;
  last_run_country: string | null;
  last_run_stats: {
    studios_searched: number;
    contacts_added: number;
    skipped_studio: number;
    skipped_email: number;
  };
}

interface AutoBatchConfig {
  enabled: boolean;
  batch_size: number;
  daily_limit: number;
  min_delay_hours: number;
}

interface BatchProgress {
  current: number;
  total: number;
  success: number;
  failed: number;
  startedAt?: string;
}

// Full country list — same order as DiscoveryTab
const ALL_COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Australia',
  'Germany', 'France', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Netherlands',
  'Switzerland', 'Austria', 'Belgium',
  'Poland', 'Spain', 'Italy', 'Czech Republic', 'Portugal', 'Romania',
  'Japan', 'South Korea', 'New Zealand',
  'Brazil', 'Mexico', 'Argentina',
  'Singapore',
];

const DEFAULT_DISCOVERY_CONFIG: AutoDiscoveryConfig = {
  enabled: false,
  countries: ['United States', 'Canada', 'United Kingdom', 'Australia'],
  monthly_credits: 1000,
  studios_per_run: 5,
  re_discover_after_days: 90,
  current_country_index: 0,
  current_page: 1,
  last_run_at: null,
  last_run_country: null,
  last_run_stats: { studios_searched: 0, contacts_added: 0, skipped_studio: 0, skipped_email: 0 },
};

// ══════════════════════════════════════════════════════════════
// ── AutoTab ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export const AutoTab: React.FC = () => {
  // ── Discovery state ──
  const [discoveryCfg, setDiscoveryCfg] = useState<AutoDiscoveryConfig>(DEFAULT_DISCOVERY_CONFIG);
  const [discoveryLoaded, setDiscoveryLoaded] = useState(false);
  const [savingDiscovery, setSavingDiscovery] = useState(false);
  const [runningDiscovery, setRunningDiscovery] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<string | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // ── Batch state (lifted from DashboardTab) ──
  const [batchCfg, setBatchCfg] = useState<AutoBatchConfig | null>(null);
  const [batchLogs, setBatchLogs] = useState<any[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);
  const [runningBatch, setRunningBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const batchPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Batch poll ──
  const startBatchPoll = useCallback((total: number) => {
    if (batchPollRef.current) clearInterval(batchPollRef.current);
    batchPollRef.current = setInterval(async () => {
      try {
        const sr = await outreachRequest('/api/email/batch-status');
        if (!sr.ok) return;
        const st = await sr.json();
        setBatchProgress(prev => ({
          current: st.current || 0,
          total: st.total || prev?.total || total,
          success: st.success || 0,
          failed: st.failed || 0,
          startedAt: prev?.startedAt,
        }));
        if (!st.running) {
          clearInterval(batchPollRef.current!);
          batchPollRef.current = null;
          setRunningBatch(false);
          setBatchProgress(null);
          const { supabase } = await import('@/services/supabaseClient');
          const { data: logs } = await supabase.from('crm_outreach_batch_log')
            .select('*').order('created_at', { ascending: false }).limit(10);
          if (logs) setBatchLogs(logs);
        }
      } catch { /* retry next tick */ }
    }, 10_000);
  }, []);

  // ── Load configs ──
  useEffect(() => {
    import('@/services/supabaseClient').then(({ supabase }) => {
      supabase.from('crm_outreach_config').select('key, value')
        .in('key', ['auto_discovery', 'auto_batch'])
        .then(({ data }) => {
          data?.forEach(row => {
            if (row.key === 'auto_discovery') {
              setDiscoveryCfg({ ...DEFAULT_DISCOVERY_CONFIG, ...row.value });
              setDiscoveryLoaded(true);
            }
            if (row.key === 'auto_batch') setBatchCfg(row.value);
          });
        });
      supabase.from('crm_outreach_batch_log')
        .select('*').order('created_at', { ascending: false }).limit(10)
        .then(({ data }) => { if (data) setBatchLogs(data); });
    });
    // Detect if batch already running (e.g. after tab switch / page refresh)
    outreachRequest('/api/email/batch-status').then(async r => {
      if (!r.ok) return;
      const st = await r.json();
      if (st.running) {
        setRunningBatch(true);
        setBatchProgress({
          current: st.current || 0, total: st.total || 30,
          success: st.success || 0, failed: st.failed || 0,
          startedAt: st.started_at ? new Date(st.started_at).toLocaleTimeString('vi-VN') : undefined,
        });
        startBatchPoll(st.total || 30);
      }
    }).catch(() => {});
    return () => { if (batchPollRef.current) clearInterval(batchPollRef.current); };
  }, [startBatchPoll]);

  // ── Discovery handlers ──
  const handleToggleDiscovery = async () => {
    const { supabase } = await import('@/services/supabaseClient');
    const next = { ...discoveryCfg, enabled: !discoveryCfg.enabled };
    await supabase.from('crm_outreach_config')
      .update({ value: next, updated_at: new Date().toISOString() })
      .eq('key', 'auto_discovery');
    setDiscoveryCfg(next);
  };

  const handleSaveDiscovery = async () => {
    setSavingDiscovery(true);
    const { supabase } = await import('@/services/supabaseClient');
    await supabase.from('crm_outreach_config')
      .update({ value: discoveryCfg, updated_at: new Date().toISOString() })
      .eq('key', 'auto_discovery');
    setSavingDiscovery(false);
    alert('✅ Đã lưu cấu hình Auto Discovery!');
  };

  const handleRunDiscovery = async () => {
    if (runningDiscovery) return;
    if (!confirm('Chạy Auto Discovery ngay bây giờ?')) return;
    setRunningDiscovery(true);
    setDiscoveryResult(null);
    try {
      const currentCountry = discoveryCfg.countries[discoveryCfg.current_country_index] ?? discoveryCfg.countries[0];
      const res = await supabaseEdgeFunctionPost('outreach-auto-discovery', {
        country: currentCountry,
        page: discoveryCfg.current_page,
        studios_per_run: discoveryCfg.studios_per_run,
        re_discover_after_days: discoveryCfg.re_discover_after_days,
      });
      if (!res.ok) {
        const errText = await res.text();
        setDiscoveryResult(`❌ Lỗi (${res.status}): ${errText.slice(0, 200)}`);
        return;
      }
      const data = await res.json();
      setDiscoveryResult(
        `✅ Xong! Searched: ${data.studios_searched} studios · Added: ${data.contacts_added} contacts · Skipped: ${data.studios_skipped} studios`
      );
      // Reload config to get updated rotation state
      const { supabase } = await import('@/services/supabaseClient');
      const { data: cfgRow } = await supabase.from('crm_outreach_config')
        .select('value').eq('key', 'auto_discovery').single();
      if (cfgRow) setDiscoveryCfg({ ...DEFAULT_DISCOVERY_CONFIG, ...cfgRow.value });
    } catch (err: any) {
      setDiscoveryResult(`❌ Lỗi: ${err.message}`);
    } finally {
      setRunningDiscovery(false);
    }
  };

  const toggleCountry = (country: string) => {
    const next = discoveryCfg.countries.includes(country)
      ? discoveryCfg.countries.filter(c => c !== country)
      : [...discoveryCfg.countries, country];
    setDiscoveryCfg({ ...discoveryCfg, countries: next, current_country_index: 0, current_page: 1 });
  };

  // ── Batch handlers ──
  const handleToggleBatch = async () => {
    if (!batchCfg) return;
    const { supabase } = await import('@/services/supabaseClient');
    const next = { ...batchCfg, enabled: !batchCfg.enabled };
    await supabase.from('crm_outreach_config')
      .update({ value: next, updated_at: new Date().toISOString() })
      .eq('key', 'auto_batch');
    setBatchCfg(next);
  };

  const handleSaveBatch = async () => {
    if (!batchCfg) return;
    setSavingBatch(true);
    const { supabase } = await import('@/services/supabaseClient');
    await supabase.from('crm_outreach_config')
      .update({ value: batchCfg, updated_at: new Date().toISOString() })
      .eq('key', 'auto_batch');
    setSavingBatch(false);
    alert('✅ Đã lưu cấu hình!');
  };

  const handleRunBatch = async () => {
    if (runningBatch) { alert('Batch đang chạy, vui lòng chờ.'); return; }
    if (!confirm('Chạy auto batch ngay bây giờ?')) return;
    setRunningBatch(true);
    try {
      const res = await supabaseEdgeFunctionPost('outreach-auto-batch', {});
      if (!res.ok) {
        const errText = await res.text();
        alert(`Lỗi batch (${res.status}): ${errText.slice(0, 200)}`);
        setRunningBatch(false);
        return;
      }
      const data = await res.json();
      const total = data.count || 30;
      setBatchProgress({ current: 0, total, success: 0, failed: 0, startedAt: new Date().toLocaleTimeString('vi-VN') });
      startBatchPoll(total);
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
      setRunningBatch(false);
    }
  };

  // ── Computed ──
  const dailyBudget = Math.floor(discoveryCfg.monthly_credits / 30);
  const nextCountry = discoveryCfg.countries.length > 0
    ? discoveryCfg.countries[discoveryCfg.current_country_index % discoveryCfg.countries.length]
    : null;
  const lastRunDate = discoveryCfg.last_run_at
    ? new Date(discoveryCfg.last_run_at).toLocaleString('vi-VN')
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* ════════════════════════════════════════════════════
          🤖 AUTO DISCOVERY
      ════════════════════════════════════════════════════ */}
      <div style={{
        background: '#161616',
        border: `1px solid ${discoveryCfg.enabled ? '#FF950040' : '#2A2A2A'}`,
        borderRadius: '14px', padding: '24px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#F5F5F5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              🤖 Auto Discovery
            </h3>
            <p style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
              Tự động tìm studios theo quốc gia, xoay vòng, tiết kiệm credits
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={handleRunDiscovery} disabled={runningDiscovery || !discoveryLoaded} style={{
              padding: '8px 14px', border: 'none', borderRadius: '8px',
              background: runningDiscovery ? '#333' : '#FF950020',
              color: runningDiscovery ? '#888' : '#FF9500',
              fontSize: '11px', fontWeight: 700, cursor: runningDiscovery ? 'wait' : 'pointer',
            }}>
              {runningDiscovery ? '⏳ Đang chạy...' : '▶ Run Now'}
            </button>
            <button onClick={handleToggleDiscovery} style={{
              padding: '8px 20px', border: 'none', borderRadius: '20px',
              background: discoveryCfg.enabled ? '#FF9500' : '#333',
              color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
              transition: 'background 0.3s',
            }}>
              {discoveryCfg.enabled ? '✓ BẬT' : '✗ TẮT'}
            </button>
          </div>
        </div>

        {/* Run result banner */}
        {discoveryResult && (
          <div style={{
            marginBottom: '16px', padding: '10px 14px', borderRadius: '8px',
            background: discoveryResult.startsWith('✅') ? '#34C75915' : '#FF453A15',
            border: `1px solid ${discoveryResult.startsWith('✅') ? '#34C75940' : '#FF453A40'}`,
            fontSize: '12px', color: discoveryResult.startsWith('✅') ? '#34C759' : '#FF453A',
          }}>
            {discoveryResult}
          </div>
        )}

        {/* Country rotation */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ ...labelStyle, marginBottom: '10px' }}>🌍 Country Rotation</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {discoveryCfg.countries.map(c => (
              <button key={c} onClick={() => toggleCountry(c)} style={{
                padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                border: '1px solid #FF950060', background: '#FF950015', color: '#FF9500',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                {c} <span style={{ opacity: 0.6, fontSize: '10px' }}>×</span>
              </button>
            ))}
            <button onClick={() => setShowCountryPicker(p => !p)} style={{
              padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
              border: '1px dashed #444', background: 'transparent', color: '#888',
              cursor: 'pointer',
            }}>+ Thêm</button>
          </div>

          {showCountryPicker && (
            <div style={{
              background: '#0F0F0F', border: '1px solid #333', borderRadius: '10px',
              padding: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px',
              maxHeight: '160px', overflowY: 'auto',
            }}>
              {ALL_COUNTRIES.filter(c => !discoveryCfg.countries.includes(c)).map(c => (
                <button key={c} onClick={() => toggleCountry(c)} style={{
                  padding: '4px 10px', borderRadius: '16px', fontSize: '11px', fontWeight: 600,
                  border: '1px solid #333', background: '#1A1A1A', color: '#888',
                  cursor: 'pointer',
                }}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Rotation state */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px',
          padding: '14px', background: '#0F0F0F', borderRadius: '10px', border: '1px solid #222',
        }}>
          <div>
            <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Next Run</p>
            <p style={{ fontSize: '13px', fontWeight: 800, color: '#F5F5F5' }}>
              {nextCountry ? `🌐 ${nextCountry} — Page ${discoveryCfg.current_page}` : '—'}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Last Run</p>
            {lastRunDate ? (
              <p style={{ fontSize: '12px', color: '#888' }}>
                {lastRunDate}
                {discoveryCfg.last_run_country && (
                  <span style={{ color: '#FF9500', fontWeight: 700 }}> · {discoveryCfg.last_run_country}</span>
                )}
                <br />
                <span style={{ fontSize: '11px', color: '#666' }}>
                  +{discoveryCfg.last_run_stats.contacts_added} contacts · {discoveryCfg.last_run_stats.studios_searched} studios
                </span>
              </p>
            ) : (
              <p style={{ fontSize: '12px', color: '#555' }}>Chưa chạy lần nào</p>
            )}
          </div>
        </div>

        {/* Credit config */}
        <p style={{ ...labelStyle, marginBottom: '12px' }}>⚙️ Credit Config</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '8px' }}>
          <div>
            <label style={labelStyle}>Monthly Credits</label>
            <input type="number" style={inputStyle} value={discoveryCfg.monthly_credits}
              onChange={e => setDiscoveryCfg(c => ({ ...c, monthly_credits: +e.target.value }))} />
            <p style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>→ Daily budget: ~{dailyBudget} credits</p>
          </div>
          <div>
            <label style={labelStyle}>Studios / Run</label>
            <input type="number" style={inputStyle} value={discoveryCfg.studios_per_run}
              onChange={e => setDiscoveryCfg(c => ({ ...c, studios_per_run: +e.target.value }))} />
            <p style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>~{discoveryCfg.studios_per_run * 3} contacts/run</p>
          </div>
          <div>
            <label style={labelStyle}>Re-discover After (days)</label>
            <input type="number" style={inputStyle} value={discoveryCfg.re_discover_after_days}
              onChange={e => setDiscoveryCfg(c => ({ ...c, re_discover_after_days: +e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button onClick={handleSaveDiscovery} disabled={savingDiscovery} style={{
            padding: '8px 20px', border: 'none', borderRadius: '8px',
            background: '#0A84FF', color: '#fff', fontSize: '12px', fontWeight: 700,
            cursor: savingDiscovery ? 'wait' : 'pointer',
          }}>
            {savingDiscovery ? '⏳...' : '💾 Save Config'}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #222' }} />

      {/* ════════════════════════════════════════════════════
          📧 AUTO BATCH EMAIL (moved from DashboardTab)
      ════════════════════════════════════════════════════ */}
      <div style={{
        background: '#161616',
        border: `1px solid ${batchCfg?.enabled ? '#34C75930' : '#2A2A2A'}`,
        borderRadius: '14px', padding: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#F5F5F5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              📧 Auto Daily Batch
            </h3>
            <p style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>Tự động gửi email hàng ngày theo lịch</p>
          </div>
          {batchCfg && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={handleRunBatch} disabled={runningBatch} style={{
                padding: '8px 14px', border: 'none', borderRadius: '8px',
                background: runningBatch ? '#333' : '#FF950020',
                color: runningBatch ? '#888' : '#FF9500',
                fontSize: '11px', fontWeight: 700, cursor: runningBatch ? 'wait' : 'pointer',
              }}>
                {runningBatch ? '⏳ Đang gửi...' : '▶ Chạy ngay'}
              </button>
              <button onClick={handleToggleBatch} style={{
                padding: '8px 20px', border: 'none', borderRadius: '20px',
                background: batchCfg.enabled ? '#34C759' : '#555',
                color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                transition: 'background 0.3s',
              }}>
                {batchCfg.enabled ? '✓ BẬT' : '✗ TẮT'}
              </button>
            </div>
          )}
        </div>

        {/* Batch progress */}
        {runningBatch && batchProgress && (
          <div style={{ marginBottom: '16px', background: '#0F0F0F', border: '1px solid #FF950060', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#FF9500' }}>
                ⏳ Đang gửi {batchProgress.current}/{batchProgress.total} emails
                {batchProgress.startedAt && (
                  <span style={{ color: '#666', fontWeight: 400, fontSize: '11px' }}> · bắt đầu lúc {batchProgress.startedAt}</span>
                )}
              </span>
              <span style={{ fontSize: '11px', color: '#888' }}>
                ~{Math.round((batchProgress.total - batchProgress.current) * 3.5)} phút còn lại
              </span>
            </div>
            <div style={{ height: '6px', background: '#222', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
              <div style={{
                height: '100%', borderRadius: '3px', transition: 'width 1s ease',
                background: 'linear-gradient(90deg, #FF9500, #FFD60A)',
                width: `${batchProgress.total > 0 ? Math.round((batchProgress.current / batchProgress.total) * 100) : 0}%`,
              }} />
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
              <span style={{ color: '#34C759' }}>✅ Thành công: {batchProgress.success}</span>
              <span style={{ color: '#FF453A' }}>❌ Thất bại: {batchProgress.failed}</span>
              <span style={{ color: '#555', marginLeft: 'auto' }}>Cập nhật mỗi 10s</span>
            </div>
          </div>
        )}

        {/* Batch config fields */}
        {batchCfg ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Batch size (mỗi lần)</label>
                <input type="number" style={inputStyle} value={batchCfg.batch_size || 15}
                  onChange={e => setBatchCfg(c => c ? { ...c, batch_size: +e.target.value } : c)} />
              </div>
              <div>
                <label style={labelStyle}>Daily limit</label>
                <input type="number" style={inputStyle} value={batchCfg.daily_limit || 30}
                  onChange={e => setBatchCfg(c => c ? { ...c, daily_limit: +e.target.value } : c)} />
              </div>
              <div>
                <label style={labelStyle}>Min delay giữa follow-up (giờ)</label>
                <input type="number" style={inputStyle} value={batchCfg.min_delay_hours || 72}
                  onChange={e => setBatchCfg(c => c ? { ...c, min_delay_hours: +e.target.value } : c)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#888', fontWeight: 700 }}>⏰ Lịch gửi: 7:00 sáng & 14:00 chiều (VN)</span>
              <button onClick={handleSaveBatch} disabled={savingBatch} style={{
                padding: '6px 14px', border: 'none', borderRadius: '6px', marginLeft: 'auto',
                background: '#0A84FF', color: '#fff', fontSize: '11px', fontWeight: 700,
                cursor: savingBatch ? 'wait' : 'pointer',
              }}>
                {savingBatch ? '⏳...' : '💾 Lưu cấu hình'}
              </button>
            </div>
          </>
        ) : (
          <p style={{ color: '#555', fontSize: '13px' }}>Đang tải cấu hình...</p>
        )}

        {/* Batch log */}
        {batchLogs.length > 0 && (
          <div style={{ borderTop: '1px solid #222', paddingTop: '14px', marginTop: '16px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#666', marginBottom: '8px' }}>
              Lịch sử batch gần đây
            </p>
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {batchLogs.map(log => (
                <div key={log.id} style={{
                  display: 'flex', gap: '12px', alignItems: 'center',
                  padding: '6px 0', borderBottom: '1px solid #1A1A1A', fontSize: '12px',
                }}>
                  <span style={{ color: '#555', width: '130px', flexShrink: 0 }}>
                    {new Date(log.created_at).toLocaleString('vi-VN')}
                  </span>
                  <span style={{ color: log.batch_type === 'auto' ? '#BF5AF2' : '#0A84FF', fontWeight: 700, width: '50px' }}>
                    {log.batch_type === 'auto' ? '🤖 Auto' : '👤 Manual'}
                  </span>
                  <span style={{
                    color: log.status === 'completed' ? '#34C759' : log.status === 'running' ? '#FF9500' : '#FF453A',
                    fontWeight: 700,
                  }}>
                    {log.status === 'completed' ? '✅' : log.status === 'running' ? '⏳' : '❌'} {log.status}
                  </span>
                  <span style={{ color: '#888' }}>Sent: {log.total_sent || 0} | Failed: {log.total_failed || 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutoTab;
