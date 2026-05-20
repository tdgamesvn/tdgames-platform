import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const TYPE_LABELS: Record<string, string> = {
  leave_approved:   '✅ Đơn nghỉ phép được duyệt',
  leave_rejected:   '❌ Đơn nghỉ phép bị từ chối',
  leave_new:        '📋 Đơn nghỉ phép mới',
  payslip_created:  '💰 Lương đã được chi trả',
  expense_approved: '✅ Chi phí được duyệt',
  expense_rejected: '❌ Chi phí bị từ chối',
  invoice_overdue:  '⚠️ Invoice quá hạn',
  broadcast:        '📢 Thông báo từ TD Games',
};

function buildEmailHtml(title: string, body: string | null, link: string | null, appUrl: string): string {
  const actionBtn = link
    ? `<a href="${appUrl}${link}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#FF9500;color:#000;font-weight:800;text-decoration:none;border-radius:10px;font-size:14px;letter-spacing:0.02em;">Xem chi tiết →</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#161616;border-radius:20px;border:1px solid #2a2a2a;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#FF9500 0%,#FF6B35 100%);padding:28px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#000;font-size:20px;font-weight:900;letter-spacing:-0.02em;text-transform:uppercase;">TD Games Platform</td>
              <td align="right" style="color:rgba(0,0,0,0.6);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Thông báo</td>
            </tr>
          </table>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px;">
          <p style="margin:0 0 8px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#FF9500;">Thông báo mới</p>
          <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:900;color:#F5F5F5;line-height:1.2;">${title}</h1>
          ${body ? `<p style="margin:0;font-size:15px;color:#aaa;line-height:1.6;">${body}</p>` : ''}
          ${actionBtn}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 36px;border-top:1px solid #222;">
          <p style="margin:0;font-size:11px;color:#555;line-height:1.5;">Email này được gửi tự động từ <strong style="color:#888;">TD Games Platform</strong>.<br>Vui lòng không reply email này.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Supabase DB Webhook payload: { type, table, record, old_record, schema }
    if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const record = payload.record as {
      id: string;
      recipient_user_id: string;
      type: string;
      title: string;
      body?: string;
      link?: string;
    };

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@tdgamestudio.com';
    const appUrl = (Deno.env.get('APP_URL') || 'https://app.tdgamestudio.com').replace(/\/$/, '');

    if (!resendKey) {
      console.error('RESEND_API_KEY not set');
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), { status: 503 });
    }

    // Lookup user email via service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(
      record.recipient_user_id,
    );

    if (userErr || !userData?.user?.email) {
      console.error('Cannot find user email:', userErr);
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    const toEmail = userData.user.email;
    const subject = TYPE_LABELS[record.type] || record.title;
    const html = buildEmailHtml(record.title, record.body || null, record.link || null, appUrl);

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `TD Games Platform <${fromEmail}>`,
        to: [toEmail],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: err }), { status: resendRes.status });
    }

    const result = await resendRes.json();
    console.log('Email sent:', result.id, '->', toEmail);

    return new Response(JSON.stringify({ ok: true, email_id: result.id, to: toEmail }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('notify-email error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
