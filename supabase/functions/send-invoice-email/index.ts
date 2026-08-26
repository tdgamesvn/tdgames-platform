import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const JSON_HEADERS = { 'Content-Type': 'application/json', ...CORS };

interface EmailRequest {
  to: string;
  subject: string;
  html_body: string;
  invoice_id?: string;
  invoice_number?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    // ── GUARD: chỉ admin/ke_toan ───────────────────────────────────────────
    // Trước 2026-08-26 function này KHÔNG kiểm quyền: nhận `to` + `html_body` tuỳ ý rồi
    // gửi qua Resend từ 'TD Games Billing <billing@tdgames.vn>'. Với công ty phát hành hoá
    // đơn thì đó là rủi ro tiền mặt trực tiếp — kẻ xấu gửi "hoá đơn" kèm QR chuyển khoản
    // giả, từ đúng địa chỉ billing thật, SPF/DKIM hợp lệ nên vào thẳng inbox khách hàng.
    // Chứng minh trước khi vá: POST body rỗng, không auth ⇒ 400 "Missing required fields".
    //
    // EmailModal.tsx trước đây gửi `Bearer <ANON_KEY>` — anon key nằm trong bundle JS công
    // khai nên vô giá trị làm bằng chứng danh tính; đã đổi sang session.access_token cùng
    // đợt vá này. Deploy function TRƯỚC khi client kịp lên là gãy nút gửi mail hoá đơn.
    const callerToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!callerToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized: thiếu Authorization header' }),
        { status: 401, headers: JSON_HEADERS });
    }
    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(callerToken);
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized: token không hợp lệ' }),
        { status: 401, headers: JSON_HEADERS });
    }
    // app_metadata, KHÔNG phải user_metadata — user_metadata do chính người dùng ghi được.
    const meta = (caller.app_metadata || {}) as Record<string, unknown>;
    const roles = [meta.role, ...(Array.isArray(meta.secondary_roles) ? meta.secondary_roles : [])];
    if (!roles.some((r) => r === 'admin' || r === 'ke_toan')) {
      return new Response(JSON.stringify({ error: 'Forbidden: cần quyền admin hoặc ke_toan' }),
        { status: 403, headers: JSON_HEADERS });
    }

    const body: EmailRequest = await req.json();
    const { to, subject, html_body, invoice_id, invoice_number } = body;

    if (!to || !subject || !html_body) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, html_body' }),
        { status: 400, headers: JSON_HEADERS });
    }

    if (!RESEND_API_KEY) {
      // Fallback: log email instead of sending (for development/testing)
      console.log(`[EMAIL MOCK] To: ${to}, Subject: ${subject}`);

      if (invoice_id) {
        await admin.from('invoice_invoices').update({
          email_sent_at: new Date().toISOString(),
          email_sent_to: to,
        }).eq('id', invoice_id);

        await admin.from('invoice_activity_logs').insert({
          invoice_id,
          action: 'email_sent',
          actor: caller.email || 'system',
          details: { to, subject, invoice_number, mode: 'mock' },
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Email logged (no RESEND_API_KEY configured)', mode: 'mock' }),
        { headers: JSON_HEADERS });
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'TD Games Billing <billing@tdgames.vn>',
        to: [to],
        subject,
        html: html_body,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      return new Response(JSON.stringify({ error: 'Resend API error', details: resendData }),
        { status: 500, headers: JSON_HEADERS });
    }

    if (invoice_id) {
      await admin.from('invoice_invoices').update({
        email_sent_at: new Date().toISOString(),
        email_sent_to: to,
      }).eq('id', invoice_id);

      // actor: ghi email người bấm gửi thay vì 'system' — trước đây log không truy được ai gửi.
      await admin.from('invoice_activity_logs').insert({
        invoice_id,
        action: 'email_sent',
        actor: caller.email || 'system',
        details: { to, subject, invoice_number, resend_id: resendData.id },
      });
    }

    return new Response(JSON.stringify({ success: true, resend_id: resendData.id }),
      { headers: JSON_HEADERS });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: JSON_HEADERS });
  }
});
