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
        const { data, error } = await supabase.from('ai_agent_insights').insert({
          agent_id: agentId, run_id: runId,
          type: args.type, priority: args.priority || 5,
          title: args.title, body: args.body,
          suggested_action: args.suggested_action || null,
        }).select('id').single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, insight_id: data.id });
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
  // Telegram limits 4096 chars
  const truncated = text.length > 4000 ? text.slice(0, 4000) + '\n\n⚠️ (truncated)' : text;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: truncated, parse_mode: 'HTML' }),
  }).catch(e => console.error('Telegram send error:', e));
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

  const systemPrompt = `${agent.personality}

## Thông tin hệ thống:
- Hôm nay: ${today}
- Agent ID: ${agentId}
- Trigger: ${triggerType}
${memorySection}
${knowledgeSection}

## Hướng dẫn:
- Dùng tools để query data trước khi đưa ra nhận xét
- Tạo insight cho mỗi phát hiện quan trọng (dùng tool create_insight)
- Trả lời bằng tiếng Việt, ngắn gọn, có số liệu
- Kết thúc bằng bản tóm tắt ngắn`;

  // 5. Build messages — agent-specific default prompts
  const DEFAULT_PROMPTS: Record<string, string> = {
    chro: 'Chạy phân tích HR hàng ngày. Kiểm tra: (1) NV sắp hết thử việc, (2) đề xuất đang chờ duyệt, (3) đánh giá chưa hoàn thành, (4) nghỉ phép bất thường. Tạo insight cho mỗi phát hiện. Cuối cùng tóm tắt ngắn gọn.',
    cfo: 'Chạy phân tích tài chính hàng ngày. Kiểm tra: (1) hoá đơn quá hạn chưa thanh toán, (2) chi phí bất thường, (3) tổng chi lương vs doanh thu, (4) dòng tiền tháng này. Tạo insight cho mỗi phát hiện. Cuối cùng tóm tắt ngắn gọn.',
    ceo: 'Chạy phân tích tổng quan công ty hàng ngày. Kiểm tra: (1) tình hình nhân sự (probation, nghỉ phép, đánh giá), (2) đề xuất chưa xử lý, (3) sức khoẻ tài chính, (4) rủi ro cross-functional. Tạo insight cho mỗi phát hiện quan trọng. Cuối cùng tóm tắt executive summary.',
    cto: 'Chạy phân tích kỹ thuật hàng ngày. Kiểm tra: (1) phân bổ nhân lực theo phòng ban, (2) NV kỹ thuật key sắp hết thử việc hoặc nghỉ phép, (3) tỷ lệ fulltime vs freelancer, (4) rủi ro bottleneck. Tạo insight cho mỗi phát hiện. Cuối cùng tóm tắt ngắn gọn.',
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
          max_tokens: 4096,
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
      const summary = assistantMsg.content || 'No summary';

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
        summary: result.summary.slice(0, 500),
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
