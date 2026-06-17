import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const chatId = message.chat.id;
    const text = message.text.trim();
    const fromName = message.from?.first_name || 'User';

    // Parse agent command: /cfo message, /ceo message, etc.
    let agentId = 'chro'; // default
    let userMessage = text;
    const agentMatch = text.match(/^\/(chro|cfo|ceo|cto)\s*(.*)/i);
    if (agentMatch) {
      agentId = agentMatch[1].toLowerCase();
      userMessage = agentMatch[2] || `Phan tich nhanh hom nay`;
    }

    // Also handle /start command
    if (text.startsWith('/start')) {
      await sendTelegram(BOT_TOKEN, chatId,
        '<b>TD Games AI Agent Bot</b>\n\n' +
        'Gui tin nhan de chat voi Agent CHRO (mac dinh).\n\n' +
        '<b>Chon agent:</b>\n' +
        '/chro - HR Agent\n' +
        '/cfo - Finance Agent\n' +
        '/ceo - Executive Agent\n' +
        '/cto - Tech Agent\n\n' +
        'Vi du: <code>/cfo Kiem tra hoa don qua han</code>'
      );
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Send "typing" indicator
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });

    // Save user message to conversations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    await supabase.from('ai_agent_conversations').insert({
      agent_id: agentId,
      channel: 'telegram',
      role: 'user',
      content: userMessage,
      tokens_used: 0,
    });

    // Load agent info for emoji
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('name, avatar_emoji')
      .eq('id', agentId)
      .single();

    // Call agent-run edge function
    const agentRunUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/agent-run`;
    const agentRes = await fetch(agentRunUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        agent_id: agentId,
        trigger_type: 'chat',
        message: userMessage,
      }),
    });

    let replyText: string;
    if (agentRes.ok) {
      const result = await agentRes.json();
      replyText = result.summary || 'Khong co phan hoi';

      // Save assistant response
      await supabase.from('ai_agent_conversations').insert({
        agent_id: agentId,
        channel: 'telegram',
        role: 'assistant',
        content: replyText,
        tokens_used: 0,
      });
    } else {
      const err = await agentRes.text().catch(() => 'Unknown error');
      replyText = `Loi: ${err.slice(0, 200)}`;
    }

    // Send reply with agent header
    const emoji = agent?.avatar_emoji || '';
    const name = agent?.name || 'Agent';
    const header = `${emoji} <b>${name}</b>\n${'─'.repeat(20)}\n\n`;

    // Telegram max 4096 chars
    const fullReply = header + replyText;
    const truncated = fullReply.length > 4000
      ? fullReply.slice(0, 4000) + '\n\n(truncated)'
      : fullReply;

    await sendTelegram(BOT_TOKEN, chatId, truncated);

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

async function sendTelegram(token: string, chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });
}
