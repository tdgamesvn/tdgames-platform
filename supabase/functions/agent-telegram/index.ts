import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Agent display info (fallback nếu DB chưa có)
const AGENT_INFO: Record<string, { name: string; emoji: string }> = {
  chro:    { name: 'CHRO Agent',    emoji: '👥' },
  cfo:     { name: 'CFO Agent',     emoji: '💰' },
  ceo:     { name: 'CEO Agent',     emoji: '👔' },
  cto:     { name: 'CTO Agent',     emoji: '⚙️' },
  sales:   { name: 'Sales Agent',   emoji: '📈' },
  pm:      { name: 'PM Agent',      emoji: '🎯' },
  ops:     { name: 'Ops Agent',     emoji: '⚡' },
  data:    { name: 'Data Agent',    emoji: '📊' },
  bd:      { name: 'BD Agent',      emoji: '🚀' },
  support: { name: 'Support Agent', emoji: '💬' },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!BOT_TOKEN) {
    return new Response('TELEGRAM_BOT_TOKEN not set', { status: 500 });
  }

  try {
    const update = await req.json();
    const message = update.message;
    if (!message?.text) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const chatId    = message.chat.id;
    const text      = message.text.trim();
    const fromName  = message.from?.first_name || 'Bạn';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── /start ───────────────────────────────────────────────
    if (text.startsWith('/start')) {
      await sendTelegram(BOT_TOKEN, chatId,
        '🤖 <b>TD Games AI Agent Bot</b>\n\n' +
        `Xin chào <b>${fromName}</b>! Tôi là trợ lý AI nội bộ của TD Games.\n\n` +
        '<b>Cách dùng:</b>\n' +
        '① Chọn agent từ menu <b>/</b> → gõ câu hỏi vào tin tiếp theo\n' +
        '② Hoặc dùng <code>@agent câu hỏi</code> trực tiếp trong 1 tin\n\n' +
        '<b>C-Suite:</b>\n' +
        '/chro — 👥 HR (nhân sự, thử việc, nghỉ phép)\n' +
        '/cfo — 💰 Finance (lương, hoá đơn, cash flow)\n' +
        '/ceo — 👔 Executive (tổng quan công ty)\n' +
        '/cto — ⚙️ Tech (nhân lực, bottleneck)\n\n' +
        '<b>Specialist:</b>\n' +
        '/sales — 📈 Sales & BD\n' +
        '/pm — 🎯 Product Manager\n' +
        '/ops — ⚡ Operations\n' +
        '/data — 📊 Data Analyst\n' +
        '/bd — 🚀 BD & Marketing\n' +
        '/support — 💬 Internal Support\n\n' +
        '<b>Ví dụ:</b>\n' +
        '<code>@cfo Hoá đơn nào chưa thanh toán tháng này?</code>\n' +
        '<code>@chro Ai sắp hết thử việc tuần này?</code>'
      );
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // ── Parse agent ──────────────────────────────────────────
    // Regex chung cho tất cả agent IDs
    const AGENTS = 'chro|cfo|ceo|cto|sales|pm|ops|data|support|bd';
    let agentId: string | null = null;
    let userMessage: string | null = null;

    // Pattern 1: /agent [nội dung tuỳ chọn]
    const cmdMatch = text.match(new RegExp(`^\\/(${AGENTS})(?:\\s+([\\s\\S]*))?$`, 'i'));
    if (cmdMatch) {
      agentId     = cmdMatch[1].toLowerCase();
      userMessage = cmdMatch[2]?.trim() || null;
    }

    // Pattern 2: @agent nội dung  (giống tag user)
    if (!agentId) {
      const atMatch = text.match(new RegExp(`^@(${AGENTS})\\s+([\\s\\S]+)$`, 'i'));
      if (atMatch) {
        agentId     = atMatch[1].toLowerCase();
        userMessage = atMatch[2].trim();
      }
    }

    // ── /command không có nội dung → set session, hỏi lại ───
    if (agentId && !userMessage) {
      await supabase.from('telegram_sessions').upsert(
        { chat_id: chatId, active_agent: agentId, updated_at: new Date().toISOString() },
        { onConflict: 'chat_id' },
      );
      const info = AGENT_INFO[agentId] || { emoji: '🤖', name: agentId };
      await sendTelegram(BOT_TOKEN, chatId,
        `${info.emoji} <b>${info.name}</b> đang lắng nghe.\n\nBạn muốn hỏi gì, ${fromName}?`
      );
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // ── Tin nhắn thường → lấy agent từ session ───────────────
    if (!agentId) {
      const { data: session } = await supabase
        .from('telegram_sessions')
        .select('active_agent, updated_at')
        .eq('chat_id', chatId)
        .maybeSingle();

      // Session hết hạn sau 8 tiếng — tránh nhầm agent qua ngày/buổi
      const SESSION_TTL = 8 * 60 * 60 * 1000;
      const sessionAge  = session?.updated_at
        ? Date.now() - new Date(session.updated_at).getTime()
        : Infinity;

      if (!session || sessionAge > SESSION_TTL) {
        await sendTelegram(BOT_TOKEN, chatId,
          `🤖 Chọn agent trước nhé, <b>${fromName}</b>:\n\n` +
          '/chro — 👥 HR\n' +
          '/cfo — 💰 Finance\n' +
          '/ceo — 👔 Executive\n' +
          '/cto — ⚙️ Tech\n\n' +
          'Hoặc dùng <code>@agent câu hỏi</code> trực tiếp.'
        );
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      agentId     = session.active_agent;
      userMessage = text;
    }

    // ── Typing indicator ─────────────────────────────────────
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });

    // ── Lưu tin nhắn user ────────────────────────────────────
    await supabase.from('ai_agent_conversations').insert({
      agent_id: agentId,
      channel:  'telegram',
      role:     'user',
      content:  userMessage,
      tokens_used: 0,
    });

    // ── Gọi agent-run ─────────────────────────────────────────
    const agentRunUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/agent-run`;
    const agentRes = await fetch(agentRunUrl, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        agent_id:     agentId,
        trigger_type: 'chat',
        message:      userMessage,
      }),
    });

    let replyText: string;
    if (agentRes.ok) {
      const result = await agentRes.json();
      replyText = result.summary || 'Không có phản hồi.';

      await supabase.from('ai_agent_conversations').insert({
        agent_id: agentId,
        channel:  'telegram',
        role:     'assistant',
        content:  replyText,
        tokens_used: 0,
      });
    } else {
      const err = await agentRes.text().catch(() => 'Unknown error');
      replyText = `⚠️ Lỗi: ${err.slice(0, 200)}`;
    }

    // ── Gửi reply (có split nếu quá dài) ────────────────────
    const info   = AGENT_INFO[agentId] || { emoji: '🤖', name: agentId };
    const header = `${info.emoji} <b>${info.name}</b>\n${'─'.repeat(24)}\n\n`;
    const full   = header + replyText;
    const MAX    = 4000;

    if (full.length <= MAX) {
      await sendTelegram(BOT_TOKEN, chatId, full);
    } else {
      // Gửi header ở chunk đầu, split theo newline
      for (const chunk of splitText(full, MAX)) {
        await sendTelegram(BOT_TOKEN, chatId, chunk);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('agent-telegram error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Tách văn bản thành chunks ≤ maxLen, ưu tiên cắt ở dòng mới
function splitText(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf('\n', maxLen);
    if (cut < maxLen * 0.6) cut = maxLen;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function sendTelegram(token: string, chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}
