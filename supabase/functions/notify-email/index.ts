import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// ── Subject line labels (no emoji — emoji in subjects can trigger filters) ──
const TYPE_LABELS: Record<string, string> = {
  leave_approved:          '[TD Games] Đơn nghỉ phép của bạn đã được duyệt',
  leave_rejected:          '[TD Games] Đơn nghỉ phép của bạn bị từ chối',
  leave_new:               '[TD Games] Có đơn nghỉ phép mới cần xử lý',
  payslip_created:         '[TD Games] Phiếu lương tháng vừa được cập nhật',
  expense_approved:        '[TD Games] Chi phí của bạn đã được duyệt',
  expense_rejected:        '[TD Games] Chi phí của bạn bị từ chối',
  invoice_overdue:         '[TD Games] Cảnh báo: Invoice sắp quá hạn',
  broadcast:               '[TD Games] Thông báo từ Ban Giám Đốc',
  eval_self_submitted:     '[TD Games] Nhân viên đã nộp tự đánh giá',
  eval_leader_submitted:   '[TD Games] Kết quả đánh giá đã có',
  eval_1on1_required:      '[TD Games] Cần lên lịch buổi 1-on-1',
  eval_completed:          '[TD Games] Kỳ đánh giá đã hoàn tất',
  eval_assigned:           '[TD Games] Bạn có form tự đánh giá mới',
  eval_deadline_reminder:  '[TD Games] Nhắc nhở: Form đánh giá sắp hết hạn',
};

// ── Plain-text fallback ──────────────────────────────────────────────────────
function buildEmailText(
  title: string,
  body: string | null,
  link: string | null,
  appUrl: string,
): string {
  const sep = '='.repeat(50);
  const lines = [
    'TD GAMES PLATFORM — Thông báo nội bộ',
    sep,
    '',
    title,
  ];
  if (body) lines.push('', body);
  if (link) lines.push('', `Xem chi tiết: ${appUrl}${link}`);
  lines.push(
    '',
    sep,
    'Email này được gửi tự động từ hệ thống nội bộ TD Games Platform.',
    'Vui lòng không trả lời trực tiếp email này.',
    '',
    'TD GAMES COMPANY LIMITED',
    'Xom Ngoai, Dong Anh Commune, Hanoi City, Vietnam',
    'MST: 0111386856 | tdgames.vn@gmail.com',
  );
  return lines.join('\n');
}

// ── HTML template ────────────────────────────────────────────────────────────
// Design principles applied:
//   • Light background — dark-bg emails score poorly in Gmail spam filters
//   • Preheader hidden text — improves inbox preview & trust signal
//   • Company address in footer — CAN-SPAM / Gmail trust
//   • Minimal image use — high text-to-HTML ratio
//   • Max 600px width — email client safe
//   • Inline styles only — stripped <style> blocks are common in clients
//   • No URL shorteners — full transparent URLs only
//   • Single CTA — not multiple conflicting links
function buildEmailHtml(
  title: string,
  body: string | null,
  link: string | null,
  appUrl: string,
  preheader?: string,
): string {
  const ctaUrl    = link ? `${appUrl}${link}` : null;
  const preview   = preheader || body?.slice(0, 120) || title;

  const ctaButton = ctaUrl
    ? `
    <table cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr>
        <td style="border-radius:8px;background:#FF9500;">
          <a href="${ctaUrl}"
             target="_blank"
             style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#000000;text-decoration:none;border-radius:8px;letter-spacing:0.01em;">
            Xem chi tiết &rarr;
          </a>
        </td>
      </tr>
    </table>`
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="vi" xml:lang="vi">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f0f2;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Preheader: shown in inbox preview, hidden in email body -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f0f0f2;">
    ${preview}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f0f0f2;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Email card: max 600px -->
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;border:1px solid #e2e2e6;overflow:hidden;">

          <!-- ── HEADER ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#FF9500 0%,#e67e00 100%);padding:22px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-family:Helvetica,Arial,sans-serif;font-size:17px;font-weight:900;color:#000000;letter-spacing:0.04em;text-transform:uppercase;">
                      TD Games Platform
                    </span>
                  </td>
                  <td align="right">
                    <span style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;color:rgba(0,0,0,0.55);letter-spacing:0.06em;text-transform:uppercase;">
                      Thông báo nội bộ
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td style="padding:36px 36px 28px 36px;">

              <!-- Eyebrow label -->
              <p style="margin:0 0 10px 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#FF9500;text-transform:uppercase;letter-spacing:0.08em;">
                Thông báo mới
              </p>

              <!-- Title -->
              <h1 style="margin:0 0 16px 0;font-family:Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;color:#111111;line-height:1.35;letter-spacing:-0.01em;">
                ${title}
              </h1>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
                <tr><td style="height:1px;background-color:#e9e9ec;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>

              ${body
                ? `<!-- Body text -->
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#444444;line-height:1.75;">
                ${body}
              </p>`
                : ''}

              ${ctaButton}

            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="padding:20px 36px 24px 36px;background-color:#f8f8fa;border-top:1px solid #e2e2e6;">
              <p style="margin:0 0 6px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#888888;line-height:1.6;">
                Email này được gửi tự động từ hệ thống nội bộ <strong style="color:#555555;">TD Games Platform</strong>.
                Vui lòng không trả lời email này.
              </p>
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#aaaaaa;line-height:1.6;">
                TD GAMES COMPANY LIMITED &bull; Xom Ngoai, Dong Anh Commune, Hanoi City, Vietnam
                &bull; MST: 0111386856
              </p>
            </td>
          </tr>

        </table>
        <!-- /Email card -->

        <!-- Bottom padding -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="height:24px;"></td></tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ── Edge function ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const record = payload.record as {
      id:                 string;
      recipient_user_id:  string;
      type:               string;
      title:              string;
      body?:              string;
      link?:              string;
    };

    const resendKey  = Deno.env.get('RESEND_API_KEY');
    const fromEmail  = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@tdgamestudio.com';
    const appUrl     = (Deno.env.get('APP_URL') || 'https://app.tdgamestudio.com').replace(/\/$/, '');

    if (!resendKey) {
      console.error('RESEND_API_KEY not set');
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), { status: 503 });
    }

    // Look up recipient email via Supabase Admin
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

    const toEmail   = userData.user.email;
    const subject   = TYPE_LABELS[record.type] || `[TD Games] ${record.title}`;
    const bodyText  = record.body  || null;
    const linkText  = record.link  || null;

    const html = buildEmailHtml(record.title, bodyText, linkText, appUrl, bodyText ?? undefined);
    const text = buildEmailText(record.title, bodyText, linkText, appUrl);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:      `TD Games Platform <${fromEmail}>`,
        reply_to:  fromEmail,
        to:        [toEmail],
        subject,
        html,
        text,
        // List-Unsubscribe: required by Google/Yahoo 2024 bulk sender policy
        // Tells Gmail this is a legitimate automated email, not spam
        headers: {
          'List-Unsubscribe':      `<mailto:${fromEmail}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Mailer':              'TD Games Platform Notification System',
        },
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: err }), { status: resendRes.status });
    }

    const result = await resendRes.json();
    console.log('Email sent:', result.id, '->', toEmail, '| type:', record.type);

    return new Response(JSON.stringify({ ok: true, email_id: result.id, to: toEmail }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('notify-email error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
