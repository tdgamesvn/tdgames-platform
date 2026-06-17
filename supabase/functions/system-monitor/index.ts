// supabase/functions/system-monitor/index.ts
// Monitors all TD Games services — HTTP uptime + Supabase health
// Can be triggered manually or via cron (pg_cron / external scheduler)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TIMEOUT_MS = 8_000;

// ── Services to monitor ──────────────────────────────────────────
const HTTP_SERVICES = [
  { name: 'app.tdgamestudio.com',      url: 'https://app.tdgamestudio.com',      critical: true  },
  { name: '9router.tdgamestudio.com',  url: 'https://9router.tdgamestudio.com',  critical: true  },
  { name: 'cliproxy.tdgamestudio.com', url: 'https://cliproxy.tdgamestudio.com', critical: false },
  { name: 'gog.tdgamestudio.com',      url: 'https://gog.tdgamestudio.com',      critical: false },
  { name: 'openclaw.tdgamestudio.com', url: 'https://openclaw.tdgamestudio.com', critical: false },
  { name: 'zalo.tdconsulting.vn',      url: 'https://zalo.tdconsulting.vn',      critical: false },
];

interface CheckResult {
  service_name: string;
  service_type: string;
  status: 'up' | 'down' | 'degraded';
  latency_ms: number | null;
  status_code: number | null;
  error_msg: string | null;
  metadata: Record<string, unknown> | null;
  checked_at: string;
}

// ── HTTP ping check ───────────────────────────────────────────────
async function checkHttp(name: string, url: string): Promise<CheckResult> {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'TDGames-Monitor/1.0' },
    });
    clearTimeout(timer);
    const latency = Date.now() - start;
    const status = res.ok ? 'up' : res.status >= 500 ? 'down' : 'degraded';
    return {
      service_name: name,
      service_type: 'http',
      status,
      latency_ms: latency,
      status_code: res.status,
      error_msg: res.ok ? null : `HTTP ${res.status}`,
      metadata: { url },
      checked_at: new Date().toISOString(),
    };
  } catch (e) {
    return {
      service_name: name,
      service_type: 'http',
      status: 'down',
      latency_ms: Date.now() - start,
      status_code: null,
      error_msg: String(e).slice(0, 200),
      metadata: { url },
      checked_at: new Date().toISOString(),
    };
  }
}

// ── Supabase health check ─────────────────────────────────────────
async function checkSupabase(supabaseUrl: string): Promise<CheckResult> {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`${supabaseUrl}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    const latency = Date.now() - start;
    const body = await res.json().catch(() => ({}));
    return {
      service_name: 'supabase',
      service_type: 'supabase',
      status: res.ok ? 'up' : 'degraded',
      latency_ms: latency,
      status_code: res.status,
      error_msg: res.ok ? null : `Supabase health ${res.status}`,
      metadata: body,
      checked_at: new Date().toISOString(),
    };
  } catch (e) {
    return {
      service_name: 'supabase',
      service_type: 'supabase',
      status: 'down',
      latency_ms: Date.now() - start,
      status_code: null,
      error_msg: String(e).slice(0, 200),
      metadata: null,
      checked_at: new Date().toISOString(),
    };
  }
}

// ── Telegram alert ────────────────────────────────────────────────
async function sendAlert(results: CheckResult[]): Promise<void> {
  const token  = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
  if (!token || !chatId) return;

  const down = results.filter(r => r.status === 'down');
  const degraded = results.filter(r => r.status === 'degraded');
  if (down.length === 0 && degraded.length === 0) return;

  const lines: string[] = ['🚨 <b>System Monitor Alert</b> — TD Games'];
  if (down.length) {
    lines.push('\n❌ <b>DOWN:</b>');
    down.forEach(r => lines.push(`  • ${r.service_name}${r.error_msg ? ` — ${r.error_msg}` : ''}`));
  }
  if (degraded.length) {
    lines.push('\n⚠️ <b>DEGRADED:</b>');
    degraded.forEach(r => lines.push(`  • ${r.service_name} (${r.status_code})`));
  }
  lines.push(`\n🕐 ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: lines.join('\n'), parse_mode: 'HTML' }),
  }).catch(e => console.error('Telegram alert error:', e));
}

// ── Main handler ──────────────────────────────────────────────────
Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Run all checks in parallel
  const [supabaseResult, ...httpResults] = await Promise.all([
    checkSupabase(supabaseUrl),
    ...HTTP_SERVICES.map(s => checkHttp(s.name, s.url)),
  ]);

  const results: CheckResult[] = [supabaseResult, ...httpResults];

  // Store all results
  const { error: insertError } = await supabase
    .from('system_health_checks')
    .insert(results);

  if (insertError) console.error('Insert error:', insertError);

  // Alert on down/degraded (only critical services for alert)
  const criticalNames = new Set(HTTP_SERVICES.filter(s => s.critical).map(s => s.name));
  criticalNames.add('supabase');
  const alertTargets = results.filter(r => criticalNames.has(r.service_name));
  await sendAlert(alertTargets);

  // Summary response
  const summary = {
    checked_at: new Date().toISOString(),
    total: results.length,
    up: results.filter(r => r.status === 'up').length,
    down: results.filter(r => r.status === 'down').length,
    degraded: results.filter(r => r.status === 'degraded').length,
    results: results.map(r => ({
      name: r.service_name,
      status: r.status,
      latency_ms: r.latency_ms,
    })),
  };

  return new Response(JSON.stringify(summary), {
    headers: { 'Content-Type': 'application/json' },
  });
});
