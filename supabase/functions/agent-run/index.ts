import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ─────────────────────────────────────────────────────────────
// TD GAMES AI Agent Runner
//
// Trigger: pg_cron (scheduled) or HTTP POST (manual/chat)
// Flow:    Load agent → Load memory → Build tools → Call LLM
//          → Parse tool calls → Store insights + episodes
// LLM:    Via 9Router (https://9router.tdgamestudio.com)
// ─────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Tool definitions (OpenAI function calling format) ────────
const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'query_employees',
      description: 'Query active employees. Returns: name, position, department, salary, probation status, tenure.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max rows (default 50)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_salary',
      description: 'Query current salary breakdown by component for employees.',
      parameters: {
        type: 'object',
        properties: {
          employee_name: { type: 'string', description: 'Filter by employee name (partial match)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_change_requests',
      description: 'Query HR change requests (salary changes, promotions, probation end, etc.)',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter: pending, approved, rejected' },
          limit: { type: 'number', description: 'Max rows (default 20)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_evaluations',
      description: 'Query employee evaluation cycles.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status' },
          limit: { type: 'number', description: 'Max rows (default 20)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_leave_requests',
      description: 'Query recent leave requests (last 90 days).',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter: pending, approved, rejected' },
          limit: { type: 'number', description: 'Max rows (default 20)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_invoices',
      description: 'Query invoices (for CFO). Returns: invoice number, client, amount, status, dates.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status (e.g. draft, sent, paid, overdue)' },
          limit: { type: 'number', description: 'Max rows (default 20)' },
          year: { type: 'number', description: 'Filter by year of issue_date' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_expenses',
      description: 'Query company expenses (for CFO). Returns: description, amount, category, payment method, status.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Filter by expense category' },
          limit: { type: 'number', description: 'Max rows (default 30)' },
          year: { type: 'number', description: 'Filter by year of expense_date' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_departments',
      description: 'Query departments overview (for CEO). Returns: name, head, employee count.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max rows (default 20)' },
        },
      },
    },
  },
  { type: 'function' as const, function: { name: 'query_outreach_leads', description: 'Query outreach leads pipeline (for BD). Returns: studio, contact, status, tier, open/click count.', parameters: { type: 'object', properties: { status: { type: 'string', description: 'Filter by outreach_status' }, tier: { type: 'string', description: 'Filter by tier (A/B/C)' }, limit: { type: 'number', description: 'Max rows (default 30)' } } } } },
  { type: 'function' as const, function: { name: 'query_outreach_stats', description: 'Query outreach statistics grouped by status. Returns: count, avg_score, opens, clicks, replied.', parameters: { type: 'object', properties: {} } } },
  { type: 'function' as const, function: { name: 'query_email_log', description: 'Query email sending log (for BD). Returns: recipient, template, status, sent_at.', parameters: { type: 'object', properties: { status: { type: 'string', description: 'Filter: delivered, bounced, failed' }, limit: { type: 'number', description: 'Max rows (default 30)' } } } } },
  { type: 'function' as const, function: { name: 'query_clients', description: 'Query CRM clients. Returns: name, type, country, status, lead_source.', parameters: { type: 'object', properties: { status: { type: 'string', description: 'Filter by status' }, country: { type: 'string', description: 'Filter by country (partial match)' }, limit: { type: 'number', description: 'Max rows (default 30)' } } } } },
  { type: 'function' as const, function: { name: 'query_projects', description: 'Query CRM projects. Returns: name, client, status, budget, dates.', parameters: { type: 'object', properties: { status: { type: 'string', description: 'Filter by status' }, limit: { type: 'number', description: 'Max rows (default 20)' } } } } },
  { type: 'function' as const, function: { name: 'query_ai_system_health', description: 'Kiểm tra sức khoẻ hệ thống AI: tỷ lệ thành công, lỗi, thời gian chạy của các agent. Dùng để giám sát AI pipeline.', parameters: { type: 'object', properties: { agent_id: { type: 'string', description: 'Filter theo agent cụ thể (chro/cfo/ceo/cto...). Bỏ trống = tất cả.' }, days: { type: 'number', description: 'Số ngày nhìn lại (mặc định 7)' } } } } },
  { type: 'function' as const, function: { name: 'query_data_integrity', description: 'Kiểm tra tính toàn vẹn dữ liệu: nhân viên thiếu lương, leave balance sai, payroll record bất thường, orphaned records.', parameters: { type: 'object', properties: {} } } },
  { type: 'function' as const, function: { name: 'query_notifications_health', description: 'Kiểm tra tình trạng notification: delivery rate, unread count, lỗi gửi. Dùng để monitor hệ thống thông báo.', parameters: { type: 'object', properties: { days: { type: 'number', description: 'Số ngày nhìn lại (mặc định 7)' } } } } },
  {
    type: 'function' as const,
    function: {
      name: 'query_system_health_history',
      description: 'Truy vấn lịch sử uptime từ bảng system_health_checks. Trả về uptime % theo từng service, latency trung bình, số lần incident, và dịch vụ hay bị lỗi lặp lại. Dùng để phân tích SLA và uptime trend.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Số ngày nhìn lại (mặc định 7)' },
          service_name: { type: 'string', description: 'Lọc theo tên service cụ thể (bỏ trống = tất cả)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_system_health',
      description: 'Kiểm tra uptime và latency của các dịch vụ TD Games (HTTP ping + Supabase health). Dùng khi cần giám sát hệ thống.',
      parameters: {
        type: 'object',
        properties: {
          services: {
            type: 'array',
            items: { type: 'string' },
            description: 'Danh sách URL cần kiểm tra. Mặc định: tất cả services TD Games.',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_insight',
      description: 'Create an insight/recommendation for admin review.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['info', 'warning', 'action_required'], description: 'Severity' },
          priority: { type: 'number', description: '1-10, 10 = most urgent' },
          title: { type: 'string', description: 'Short title in Vietnamese' },
          body: { type: 'string', description: 'Detailed explanation in Vietnamese' },
          suggested_action: { type: 'string', description: 'What admin should do' },
        },
        required: ['type', 'priority', 'title', 'body'],
      },
    },
  },
];

// ── Execute tool calls ───────────────────────────────────────
async function executeTool(
  supabase: any, toolName: string, args: Record<string, any>,
  runId: string, agentId: string,
): Promise<string> {
  try {
    switch (toolName) {
      case 'query_employees': {
        const { data, error } = await supabase
          .from('v_agent_employees').select('*').limit(args.limit || 50);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case 'query_salary': {
        let q = supabase.from('v_agent_salary').select('*');
        if (args.employee_name) q = q.ilike('full_name', `%${args.employee_name}%`);
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case 'query_change_requests': {
        let q = supabase.from('v_agent_change_requests').select('*');
        if (args.status) q = q.eq('status', args.status);
        const { data, error } = await q.limit(args.limit || 20);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case 'query_evaluations': {
        let q = supabase.from('v_agent_evaluations').select('*');
        if (args.status) q = q.eq('status', args.status);
        const { data, error } = await q.limit(args.limit || 20);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case 'query_leave_requests': {
        let q = supabase.from('v_agent_leave_requests').select('*');
        if (args.status) q = q.eq('status', args.status);
        const { data, error } = await q.limit(args.limit || 20);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case 'query_invoices': {
        let q = supabase.from('v_agent_invoices').select('*');
        if (args.status) q = q.eq('status', args.status);
        if (args.year) {
          q = q.gte('issue_date', `${args.year}-01-01`).lte('issue_date', `${args.year}-12-31`);
        }
        const { data, error } = await q.limit(args.limit || 20);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case 'query_expenses': {
        let q = supabase.from('v_agent_expenses').select('*');
        if (args.category) q = q.ilike('type', `%${args.category}%`);
        if (args.year) {
          q = q.eq('year', args.year);
        }
        const { data, error } = await q.limit(args.limit || 30);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case 'query_departments': {
        const { data, error } = await supabase
          .from('v_agent_departments').select('*')
          .limit(args.limit || 20);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case 'query_outreach_leads': {
        let q = supabase.from('v_agent_outreach_leads').select('*');
        if (args.status) q = q.eq('outreach_status', args.status);
        if (args.tier) q = q.eq('tier', args.tier);
        const { data, error } = await q.limit(args.limit || 30);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case 'query_outreach_stats': {
        const { data, error } = await supabase.from('v_agent_outreach_stats').select('*');
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case 'query_email_log': {
        let q = supabase.from('v_agent_email_log').select('*');
        if (args.status) q = q.eq('status', args.status);
        const { data, error } = await q.limit(args.limit || 30);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case 'query_clients': {
        let q = supabase.from('v_agent_clients').select('*');
        if (args.status) q = q.eq('status', args.status);
        if (args.country) q = q.ilike('country', `%${args.country}%`);
        const { data, error } = await q.limit(args.limit || 30);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case 'query_projects': {
        let q = supabase.from('v_agent_projects').select('*');
        if (args.status) q = q.eq('status', args.status);
        const { data, error } = await q.limit(args.limit || 20);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case 'create_insight': {
        // Dedup check — skip if same agent+title inserted in the last 24h
        const since24h = new Date(Date.now() - 86400000).toISOString();
        const { data: existing } = await supabase
          .from('ai_agent_insights')
          .select('id')
          .eq('agent_id', agentId)
          .eq('title', args.title)
          .gte('created_at', since24h)
          .limit(1)
          .maybeSingle();
        if (existing) {
          return JSON.stringify({ skipped: true, reason: 'duplicate in 24h', existing_id: existing.id });
        }
        const { data, error } = await supabase.from('ai_agent_insights').insert({
          agent_id: agentId, run_id: runId,
          type: args.type, priority: args.priority || 5,
          title: args.title, body: args.body,
          suggested_action: args.suggested_action || null,
        }).select('id').single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, insight_id: data.id });
      }
      case 'query_ai_system_health': {
        const days = args.days || 7;
        const since = new Date(Date.now() - days * 86400000).toISOString();
        let q = supabase.from('ai_agent_runs')
          .select('agent_id, status, duration_ms, error, created_at, completed_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(200);
        if (args.agent_id) q = q.eq('agent_id', args.agent_id);
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        // Aggregate stats per agent
        const stats: Record<string, { total: number; completed: number; failed: number; avg_ms: number; last_run: string | null; last_error: string | null }> = {};
        for (const r of (data || [])) {
          if (!stats[r.agent_id]) stats[r.agent_id] = { total: 0, completed: 0, failed: 0, avg_ms: 0, last_run: null, last_error: null };
          const s = stats[r.agent_id];
          s.total++;
          if (r.status === 'completed') { s.completed++; if (r.duration_ms) s.avg_ms = Math.round((s.avg_ms * (s.completed - 1) + r.duration_ms) / s.completed); }
          if (r.status === 'failed') { s.failed++; s.last_error = r.error?.slice(0, 100) || null; }
          if (!s.last_run) s.last_run = r.created_at;
        }
        return JSON.stringify({ period_days: days, agents: stats });
      }
      case 'query_data_integrity': {
        const results: Record<string, unknown> = {};
        // Employees without salary record
        let noSalary: unknown = null;
        try { const { data } = await supabase.rpc('query_data_integrity_no_salary'); noSalary = data; } catch (_) { /* ignore */ }
        // Fallback: manual check
        const { data: empCount } = await supabase.from('hr_employees').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('type', 'fulltime');
        const { data: salaryCount } = await supabase.from('hr_employee_salary').select('employee_id', { count: 'exact', head: true });
        const { data: noBalance } = await supabase
          .from('hr_employees')
          .select('id, full_name, employee_code')
          .eq('status', 'active').eq('type', 'fulltime')
          .not('id', 'in', `(SELECT employee_id FROM leave_balances WHERE year = ${new Date().getFullYear()} AND quarter = 0)`)
          .limit(20);
        const { data: noPayroll } = await supabase
          .from('hr_employees')
          .select('id, full_name, employee_code')
          .eq('status', 'active').eq('type', 'fulltime')
          .not('id', 'in', `(SELECT employee_id FROM hr_employee_salary)`)
          .limit(20);
        results.active_fulltime_count = (empCount as any)?.length ?? 'unknown';
        results.salary_records_count = (salaryCount as any)?.length ?? 'unknown';
        results.fulltime_missing_leave_balance_2026 = noBalance || [];
        results.fulltime_missing_salary_record = noPayroll || [];
        return JSON.stringify(results);
      }
      case 'query_notifications_health': {
        const days = args.days || 7;
        const since = new Date(Date.now() - days * 86400000).toISOString();
        const { data: notifStats, error: ne } = await supabase
          .from('notifications')
          .select('type, is_read, created_at')
          .gte('created_at', since)
          .limit(500);
        if (ne) return JSON.stringify({ error: ne.message });
        const total = (notifStats || []).length;
        const unread = (notifStats || []).filter(n => !n.is_read).length;
        const byType: Record<string, { total: number; unread: number }> = {};
        for (const n of (notifStats || [])) {
          if (!byType[n.type]) byType[n.type] = { total: 0, unread: 0 };
          byType[n.type].total++;
          if (!n.is_read) byType[n.type].unread++;
        }
        return JSON.stringify({ period_days: days, total_notifications: total, unread, read_rate_pct: total > 0 ? Math.round(((total - unread) / total) * 100) : 0, by_type: byType });
      }
      case 'query_system_health_history': {
        const days = args.days || 7;
        const since = new Date(Date.now() - days * 86400000).toISOString();
        let q = supabase
          .from('system_health_checks')
          .select('service_name, service_type, status, latency_ms, error_msg, checked_at')
          .gte('checked_at', since)
          .order('checked_at', { ascending: false })
          .limit(1000);
        if (args.service_name) q = q.eq('service_name', args.service_name);
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        // Aggregate per service
        const services: Record<string, { total: number; up: number; down: number; degraded: number; latencies: number[]; last_incident: string | null; errors: string[] }> = {};
        for (const r of (data || [])) {
          if (!services[r.service_name]) {
            services[r.service_name] = { total: 0, up: 0, down: 0, degraded: 0, latencies: [], last_incident: null, errors: [] };
          }
          const s = services[r.service_name];
          s.total++;
          if (r.status === 'up') s.up++;
          else if (r.status === 'down') {
            s.down++;
            if (!s.last_incident) s.last_incident = r.checked_at;
            if (r.error_msg && s.errors.length < 3) s.errors.push(r.error_msg);
          } else if (r.status === 'degraded') {
            s.degraded++;
            if (!s.last_incident) s.last_incident = r.checked_at;
          }
          if (r.latency_ms) s.latencies.push(r.latency_ms);
        }
        const result = Object.entries(services).map(([name, s]) => ({
          service: name,
          total_checks: s.total,
          uptime_pct: s.total > 0 ? Math.round((s.up / s.total) * 1000) / 10 : null,
          incident_count: s.down + s.degraded,
          down_count: s.down,
          degraded_count: s.degraded,
          avg_latency_ms: s.latencies.length > 0 ? Math.round(s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length) : null,
          max_latency_ms: s.latencies.length > 0 ? Math.max(...s.latencies) : null,
          last_incident_at: s.last_incident,
          sample_errors: s.errors,
        }));
        // Flag services with SLA miss (<99.5%) or recurring issues (>3 incidents)
        const sla_target = 99.5;
        const alerts = result.filter(s => (s.uptime_pct !== null && s.uptime_pct < sla_target) || s.incident_count > 3);
        return JSON.stringify({ period_days: days, sla_target_pct: sla_target, services: result, sla_alerts: alerts });
      }
      case 'check_system_health': {
        const DEFAULT_SERVICES = [
          { name: 'app.tdgamestudio.com',      url: 'https://app.tdgamestudio.com' },
          { name: '9router.tdgamestudio.com',  url: 'https://9router.tdgamestudio.com' },
          { name: 'cliproxy.tdgamestudio.com', url: 'https://cliproxy.tdgamestudio.com' },
          { name: 'gog.tdgamestudio.com',      url: 'https://gog.tdgamestudio.com' },
          { name: 'openclaw.tdgamestudio.com', url: 'https://openclaw.tdgamestudio.com' },
          { name: 'zalo.tdconsulting.vn',      url: 'https://zalo.tdconsulting.vn' },
        ];

        const targets = args.services?.length
          ? args.services.map((url: string) => ({ name: url.replace(/^https?:\/\//, ''), url }))
          : DEFAULT_SERVICES;

        const TIMEOUT = 8000;
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';

        // HTTP ping per service
        const checks = await Promise.all([
          // Supabase health
          (async () => {
            const start = Date.now();
            try {
              const ctrl = new AbortController();
              setTimeout(() => ctrl.abort(), TIMEOUT);
              const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
              const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
                signal: ctrl.signal,
                headers: { 'apikey': anonKey },
              });
              return { service_name: 'supabase', service_type: 'supabase',
                status: res.ok ? 'up' : 'degraded', latency_ms: Date.now() - start,
                status_code: res.status, error_msg: res.ok ? null : `HTTP ${res.status}`,
                metadata: null, checked_at: new Date().toISOString() };
            } catch(e) {
              return { service_name: 'supabase', service_type: 'supabase', status: 'down',
                latency_ms: Date.now() - start, status_code: null,
                error_msg: String(e).slice(0, 150), metadata: null,
                checked_at: new Date().toISOString() };
            }
          })(),
          // HTTP services
          ...targets.map(async (svc: { name: string; url: string }) => {
            const start = Date.now();
            try {
              const ctrl = new AbortController();
              setTimeout(() => ctrl.abort(), TIMEOUT);
              const res = await fetch(svc.url, { signal: ctrl.signal, method: 'GET', headers: { 'User-Agent': 'TDGames-CTO-Agent/1.0' } });
              return { service_name: svc.name, service_type: 'http',
                status: res.ok ? 'up' : res.status >= 500 ? 'down' : 'degraded',
                latency_ms: Date.now() - start, status_code: res.status,
                error_msg: res.ok ? null : `HTTP ${res.status}`,
                metadata: { url: svc.url }, checked_at: new Date().toISOString() };
            } catch(e) {
              return { service_name: svc.name, service_type: 'http', status: 'down',
                latency_ms: Date.now() - start, status_code: null,
                error_msg: String(e).slice(0, 150),
                metadata: { url: svc.url }, checked_at: new Date().toISOString() };
            }
          }),
        ]);

        // Persist to system_health_checks
        try {
          await supabase.from('system_health_checks').insert(checks);
        } catch (_) { /* ignore persist errors */ }

        const summary = checks.map(c => ({
          service: c.service_name,
          status: c.status,
          latency_ms: c.latency_ms,
          error: c.error_msg,
        }));
        const down = checks.filter(c => c.status === 'down');
        const degraded = checks.filter(c => c.status === 'degraded');
        return JSON.stringify({
          checked_at: new Date().toISOString(),
          total: checks.length,
          up: checks.filter(c => c.status === 'up').length,
          down: down.length,
          degraded: degraded.length,
          issues: [...down, ...degraded].map(c => ({ service: c.service_name, status: c.status, error: c.error_msg })),
          details: summary,
        });
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (e) {
    return JSON.stringify({ error: String(e) });
  }
}

// ── Send Telegram message ────────────────────────────────────
async function sendTelegram(text: string): Promise<void> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
  if (!token || !chatId) return;
  // Telegram limits 4096 chars — split into chunks instead of truncating
  const CHUNK = 4000;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK) {
    chunks.push(text.slice(i, i + CHUNK));
  }
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: 'HTML' }),
    }).catch(e => console.error('Telegram send error:', e));
  }
}

// ── Main agent loop ──────────────────────────────────────────
async function runAgent(
  supabase: any, agentId: string,
  triggerType: 'cron' | 'manual' | 'chat',
  userMessage?: string,
): Promise<{ summary: string; insightsCreated: number }> {
  const startTime = Date.now();

  // 1. Load agent profile
  const { data: agent, error: agentErr } = await supabase
    .from('ai_agents').select('*').eq('id', agentId).single();
  if (agentErr || !agent) throw new Error(`Agent not found: ${agentId}`);

  // 2. Create run record
  const { data: run } = await supabase
    .from('ai_agent_runs')
    .insert({ agent_id: agentId, trigger_type: triggerType })
    .select('id').single();
  const runId = run?.id;

  // 3. Load memory
  const { data: episodes } = await supabase
    .from('ai_agent_episodes')
    .select('summary, event_type, created_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false }).limit(15);

  const { data: knowledge } = await supabase
    .from('ai_agent_knowledge')
    .select('category, insight, confidence')
    .eq('agent_id', agentId)
    .gte('confidence', 0.5)
    .order('confidence', { ascending: false }).limit(10);

  // 4. Build system prompt
  const today = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const memorySection = episodes?.length
    ? `\n## Sự kiện gần đây:\n${episodes.map((e: any) =>
        `- [${new Date(e.created_at).toLocaleDateString('vi-VN')}] ${e.summary}`
      ).join('\n')}`
    : '';
  const knowledgeSection = knowledge?.length
    ? `\n## Kiến thức đã học:\n${knowledge.map((k: any) =>
        `- [${(k.confidence * 100).toFixed(0)}%] ${k.insight}`
      ).join('\n')}`
    : '';

  const isChatMode = triggerType === 'chat';
  const guidelines = isChatMode
    ? `- Trả lời bằng tiếng Việt, tự nhiên và thân thiện
- Dùng tools để lấy dữ liệu thực trước khi trả lời
- Trình bày rõ ràng, có số liệu cụ thể khi có dữ liệu
- Không cần tạo insight hay viết tóm tắt cuối
- Nếu câu hỏi không liên quan đến dữ liệu, trả lời thẳng`
    : `- Dùng tools để query data trước khi đưa ra nhận xét
- Tạo insight cho mỗi phát hiện quan trọng (dùng tool create_insight)
- Trả lời bằng tiếng Việt, súc tích, có số liệu
- Kết thúc bằng bản tóm tắt executive ngắn`;

  const systemPrompt = `${agent.personality}

## Thông tin hệ thống:
- Hôm nay: ${today}
- Agent ID: ${agentId}
- Mode: ${isChatMode ? 'chat trực tiếp' : 'phân tích tự động'}
${memorySection}
${knowledgeSection}

## Hướng dẫn:
${guidelines}`;

  // 5. Build messages — agent-specific default prompts
  const DEFAULT_PROMPTS: Record<string, string> = {
    chro: 'Chạy phân tích HR hàng ngày. Kiểm tra: (1) NV sắp hết thử việc, (2) đề xuất đang chờ duyệt, (3) đánh giá chưa hoàn thành, (4) nghỉ phép bất thường. Tạo insight cho mỗi phát hiện. Cuối cùng tóm tắt ngắn gọn.',
    cfo: 'Chạy phân tích tài chính hàng ngày. Kiểm tra: (1) hoá đơn quá hạn chưa thanh toán, (2) chi phí bất thường, (3) tổng chi lương vs doanh thu, (4) dòng tiền tháng này. Tạo insight cho mỗi phát hiện. Cuối cùng tóm tắt ngắn gọn.',
    ceo: 'Chạy phân tích tổng quan công ty hàng ngày. Kiểm tra: (1) tình hình nhân sự (probation, nghỉ phép, đánh giá), (2) đề xuất chưa xử lý, (3) sức khoẻ tài chính, (4) rủi ro cross-functional. Tạo insight cho mỗi phát hiện quan trọng. Cuối cùng tóm tắt executive summary.',
    cto: 'Chạy phân tích kỹ thuật toàn diện theo 5 bước. Bước 1: check_system_health() — ping tất cả domains + Supabase ngay bây giờ, tạo P1 insight (action_required, priority 9) nếu service down, P2 (warning, priority 6) nếu degraded hoặc latency >3s. Bước 2: query_system_health_history(days=7) — xem uptime trend tuần qua, tính uptime % từng service, tạo P2 insight nếu có service uptime <99.5% hoặc >3 incidents. Bước 3: query_ai_system_health(days=7) — kiểm tra tất cả AI agents, tạo insight nếu fail rate >20% hoặc agent không chạy >24h. Bước 4: query_data_integrity() — phát hiện nhân viên thiếu lương/leave balance, tạo insight nếu có. Bước 5: query_notifications_health() — kiểm tra delivery rate, cảnh báo nếu unread backlog >50 hoặc read rate <70%. Sau mỗi bước gọi create_insight() cho từng phát hiện quan trọng. Kết thúc viết executive summary: tổng kết sức khoẻ hệ thống theo màu 🟢/🟡/🔴 cho từng lĩnh vực.',
    sales: 'Chạy phân tích sales hàng ngày. Kiểm tra: (1) hoá đơn quá hạn chưa thu tiền, (2) doanh thu tháng này vs tháng trước, (3) client nào đang active/inactive, (4) pipeline health. Tạo insight cho mỗi phát hiện. Cuối cùng tóm tắt ngắn gọn.',
    pm: 'Chạy phân tích project hàng ngày. Kiểm tra: (1) nhân viên nào đang quá tải hoặc rảnh, (2) ai nghỉ phép tuần này ảnh hưởng delivery, (3) đánh giá chưa hoàn thành, (4) phân bổ nhân lực theo phòng ban. Tạo insight cho mỗi phát hiện. Cuối cùng tóm tắt ngắn gọn.',
    ops: 'Chạy phân tích vận hành tuần này. Kiểm tra: (1) hợp đồng/thử việc sắp hết hạn, (2) chi phí vận hành bất thường, (3) deadline thuế/BHXH/báo cáo sắp tới, (4) đề xuất nhân sự chưa xử lý. Tạo insight cho mỗi phát hiện. Cuối cùng tóm tắt ngắn gọn.',
    data: 'Chạy phân tích dữ liệu tuần này. Kiểm tra: (1) doanh thu theo client và billing entity, (2) chi phí lương vs doanh thu (profit margin), (3) trend doanh thu 3 tháng gần nhất, (4) burn rate hiện tại. Tạo insight cho mỗi phát hiện. Dùng số liệu cụ thể.',
    bd: 'Chạy phân tích BD hàng ngày. Kiểm tra: (1) outreach pipeline stats (sent/opened/replied), (2) leads nóng cần follow-up (opened nhiều lần), (3) email bounced/failed gần đây, (4) client hiện tại có dự án sắp kết thúc, (5) conversion rate tuần này. Tạo insight cho mỗi phát hiện.',
    support: 'Sẵn sàng hỗ trợ nhân viên về quy trình và chính sách công ty TD Games.',
  };

  const messages: any[] = [];
  if (triggerType === 'cron' || triggerType === 'manual') {
    messages.push({
      role: 'user',
      content: userMessage || DEFAULT_PROMPTS[agentId] || DEFAULT_PROMPTS.chro,
    });
  } else if (userMessage) {
    messages.push({ role: 'user', content: userMessage });
  }

  // 6. Agent loop (max 10 iterations)
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let insightsCreated = 0;

  const apiBase = Deno.env.get('LLM_API_BASE') || 'https://9router.tdgamestudio.com';
  const apiKey = Deno.env.get('LLM_API_KEY');
  if (!apiKey) {
    await supabase.from('ai_agent_runs').update({
      status: 'failed', error: 'LLM_API_KEY not set',
      completed_at: new Date().toISOString(),
    }).eq('id', runId);
    throw new Error('LLM_API_KEY not set');
  }

  const model = agent.model || 'gpt-5-4';

  try {
    for (let i = 0; i < 10; i++) {
      const response = await fetch(`${apiBase}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          tools: TOOL_DEFINITIONS,
          temperature: agent.temperature || 0.3,
          max_tokens: 16000,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`LLM API error: ${response.status} ${err}`);
      }

      const result = await response.json();
      totalInputTokens += result.usage?.prompt_tokens || 0;
      totalOutputTokens += result.usage?.completion_tokens || 0;

      const choice = result.choices?.[0];
      if (!choice) throw new Error('No choice in LLM response');

      const assistantMsg = choice.message;
      messages.push(assistantMsg);

      // Handle tool calls
      if (choice.finish_reason === 'tool_calls' || assistantMsg.tool_calls?.length) {
        for (const tc of assistantMsg.tool_calls || []) {
          const args = typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments) : tc.function.arguments;
          const toolResult = await executeTool(supabase, tc.function.name, args, runId, agentId);
          if (tc.function.name === 'create_insight') {
            const parsed = JSON.parse(toolResult);
            if (parsed.success) insightsCreated++;
          }
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: toolResult,
          });
        }
        continue; // Let LLM process tool results
      }

      // Agent finished — extract text summary
      const rawSummary = assistantMsg.content || 'No summary';
      // Warn if response was cut by token limit
      const summary = choice.finish_reason === 'length'
        ? rawSummary + '\n\n⚠️ Phản hồi bị giới hạn token — có thể thiếu nội dung cuối.'
        : rawSummary;

      // 7. Save episode
      await supabase.from('ai_agent_episodes').insert({
        agent_id: agentId,
        event_type: triggerType === 'cron' ? 'observation' : 'action',
        summary: summary.slice(0, 500),
        details: { insights_created: insightsCreated, trigger: triggerType },
        importance: insightsCreated > 0 ? 7 : 4,
      });

      // 8. Update run record
      await supabase.from('ai_agent_runs').update({
        status: 'completed',
        summary: summary.slice(0, 500),
        insights_created: insightsCreated,
        episodes_created: 1,
        tokens_input: totalInputTokens,
        tokens_output: totalOutputTokens,
        duration_ms: Date.now() - startTime,
        completed_at: new Date().toISOString(),
      }).eq('id', runId);

      return { summary, insightsCreated };
    }

    // Max iterations reached
    await supabase.from('ai_agent_runs').update({
      status: 'failed', error: 'Max iterations exceeded',
      completed_at: new Date().toISOString(),
    }).eq('id', runId);

    throw new Error('Agent exceeded max iterations');
  } catch (e) {
    // Always mark run as failed on any error
    try {
      await supabase.from('ai_agent_runs').update({
        status: 'failed',
        error: String(e).slice(0, 500),
        tokens_input: totalInputTokens,
        tokens_output: totalOutputTokens,
        duration_ms: Date.now() - startTime,
        completed_at: new Date().toISOString(),
      }).eq('id', runId);
    } catch (_) { /* don't let update failure mask original error */ }
    throw e;
  }
}

// ── HTTP Handler ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const agentId = body.agent_id || 'chro';
    const triggerType = body.trigger_type || 'manual';
    const userMessage = body.message;

    // Verify agent exists
    const { data: agent } = await supabase
      .from('ai_agents').select('id, name, is_active, avatar_emoji')
      .eq('id', agentId).single();
    if (!agent?.is_active) {
      return new Response(JSON.stringify({ error: 'Agent not found or inactive' }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Run agent
    const result = await runAgent(supabase, agentId, triggerType, userMessage);

    // Send Telegram morning report for cron runs
    if (triggerType === 'cron' && result.summary) {
      const emoji = agent.avatar_emoji || '🤖';
      const header = `${emoji} <b>${agent.name} — Báo cáo sáng</b>\n${'─'.repeat(30)}\n\n`;
      const footer = `\n\n📊 ${result.insightsCreated} insight mới\n🔗 <a href="https://app.tdgamestudio.com/#ai-agent">Xem trên app</a>`;
      await sendTelegram(header + result.summary.slice(0, 3500) + footer);
    }

    return new Response(
      JSON.stringify({
        ok: true, agent_id: agentId,
        summary: result.summary,           // full text — caller handles display truncation
        insights_created: result.insightsCreated,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  } catch (e) {
    console.error('agent-run error:', e);

    // Mark run as failed if possible
    const errMsg = String(e);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }
});
