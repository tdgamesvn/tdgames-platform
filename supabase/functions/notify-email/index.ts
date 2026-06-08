import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const TYPE_LABELS: Record<string, string> = {
  leave_approved:           '✅ Đơn nghỉ phép được duyệt',
  leave_rejected:           '❌ Đơn nghỉ phép bị từ chối',
  leave_new:                '📋 Đơn nghỉ phép mới',
  payslip_created:          '💰 Lương đã được chi trả',
  expense_approved:         '✅ Chi phí được duyệt',
  expense_rejected:         '❌ Chi phí bị từ chối',
  invoice_overdue:          '⚠️ Invoice quá hạn',
  broadcast:                '📢 Thông báo từ TD Games',
  // Evaluation
  eval_self_submitted:      '📝 Nhân viên đã nộp tự đánh giá',
  eval_leader_submitted:    '⭐ Kết quả đánh giá đã có',
  eval_1on1_required:       '🤝 Cần lên lịch 1-on-1',
  eval_completed:           '✅ Chu kỳ đánh giá hoàn tất',
  eval_assigned:            '📋 Bạn có form tự đánh giá mới',
  eval_deadline_reminder:   '⏰ Nhắc nhở: Form đánh giá sắp hết hạn',
};

function buildEmailText(title: string, body: string | null, link: string | null, appUrl: string): string {
  const lines: string[] = ['TD Games Platform', '─'.repeat(40), '', title];
  if (body) lines.push('', body);
  if (link) lines.push('', `Xem chi tiết: ${appUrl}${link}`);
  lines.push('', '─'.repeat(40), 'Email tự động từ TD Games Platform. Vui lòng không reply.');
  return lines.join('\n');
}

function buildEmailHtml(title: string, body: string | null, link: string | null, appUrl: string): string {
  const actionBtn = link
    ? `<a href="${appUrl}${link}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#FF9500;color:#000;font-weight:800;text-decoration:none;border-radius:8px;font-size:14px;letter-spacing:0.02em;">Xem chi tiết →</a>`
    : '';

  // Light theme — dark backgrounds score poorly with Gmail spam filters
  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#FF9500 0%,#FF6B35 100%);padding:24px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#000000;font-size:18px;font-weight:900;letter-spacing:-0.01em;text-transform:uppercase;">TD Games Platform</td>
              <td align="right" style="color:rgba(0,0,0,0.5);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Thông báo</td>
            </tr>
          </table>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px;">
          <p style="margin:0 0 8px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#FF9500;">Thông báo mới</p>
          <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:#18181b;line-height:1.3;">${title}</h1>
          ${body ? `<p style="margin:0;font-size:15px;color:#52525b;line-height:1.7;">${body}</p>` : ''}
          ${actionBtn}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 36px;border-top:1px solid #e4e4e7;background:#fafafa;">
          <p style="margin:0;font-size:11px;color:#a1a1aa;line-height:1.6;">Email này được gửi tự động từ <strong style="color:#71717a;">TD Games Platform</strong>.<br>Vui lòng không reply email này.</p>
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
    const bodyText = record.body || null;
    const linkText = record.link || null;
    const html = buildEmailHtml(record.title, bodyText, linkText, appUrl);
    const text = buildEmailText(record.title, bodyText, linkText, appUrl);

    // Send via Resend — include plain-text to improve deliverability / avoid spam
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `TD Games Platform <${fromEmail}>`,
        reply_to: fromEmail,
        to: [toEmail],
        subject,
        html,
        text, // plain-text fallback — critical for spam filter scoring
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
