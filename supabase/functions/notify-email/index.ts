import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ─────────────────────────────────────────────────────────────────────────────
// TD GAMES PLATFORM — notify-email edge function
//
// Trigger:  INSERT on public.notifications  (via pg_net → trigger_notify_email)
// Purpose:  Send a formatted transactional email via Resend
// Template: See EMAIL_STANDARD.md in this directory for design rules
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// ── Per-type metadata ─────────────────────────────────────────────────────────
// subject  : email subject line — no emoji, use [TD Games] prefix
// category : short category badge shown inside email body
// Add a new entry here every time you add a new notification type
// ─────────────────────────────────────────────────────────────────────────────
// Subject rules: NO [brackets], NO marketing words, short & direct.
// Brackets signal bulk/newsletter → Gmail Promotions.
const TYPE_META: Record<string, { subject: string; category: string }> = {
  // Nghỉ phép
  leave_approved:         { subject: 'Đơn nghỉ phép của bạn đã được duyệt',   category: 'Nghỉ phép'   },
  leave_rejected:         { subject: 'Đơn nghỉ phép của bạn bị từ chối',       category: 'Nghỉ phép'   },
  leave_new:              { subject: 'Có đơn nghỉ phép mới cần xử lý',          category: 'Nghỉ phép'   },
  // Lương
  payslip_created:          { subject: 'Phiếu lương tháng vừa được cập nhật',   category: 'Bảng lương'  },
  payslip_pending_review:   { subject: 'Phiếu lương của bạn cần xác nhận',      category: 'Bảng lương'  },
  // Chi phí
  expense_approved:       { subject: 'Chi phí của bạn đã được duyệt',           category: 'Chi phí'     },
  expense_rejected:       { subject: 'Chi phí của bạn bị từ chối',              category: 'Chi phí'     },
  // Hóa đơn
  invoice_overdue:        { subject: 'Cảnh báo: Invoice sắp đến hạn thanh toán', category: 'Hóa đơn'    },
  // Broadcast
  broadcast:              { subject: 'Thông báo nội bộ từ TD Games',             category: 'Thông báo'  },
  // Đánh giá nhân viên
  eval_self_submitted:    { subject: 'Nhân viên đã nộp tự đánh giá',            category: 'Đánh giá'    },
  eval_leader_submitted:  { subject: 'Kết quả đánh giá của bạn đã có',          category: 'Đánh giá'    },
  eval_1on1_required:     { subject: 'Cần lên lịch buổi 1-on-1',                category: 'Đánh giá'    },
  eval_completed:         { subject: 'Kỳ đánh giá đã hoàn tất',                 category: 'Đánh giá'    },
  eval_assigned:          { subject: 'Bạn có form tự đánh giá mới cần hoàn thành', category: 'Đánh giá' },
  eval_deadline_reminder: { subject: 'Nhắc nhở: Form tự đánh giá sắp hết hạn', category: 'Đánh giá'    },
};

// ── Plain-text fallback ───────────────────────────────────────────────────────
// Always include plain-text — critical for spam scoring & accessibility
function buildEmailText(
  category: string,
  title: string,
  body: string | null,
  link: string | null,
  appUrl: string,
): string {
  const sep = '-'.repeat(50);
  const lines: string[] = [
    `TD GAMES PLATFORM  |  ${category.toUpperCase()}`,
    sep,
    '',
    title,
  ];
  if (body) lines.push('', body);
  if (link) lines.push('', `Xem chi tiet: ${appUrl}${link}`);
  lines.push(
    '',
    sep,
    'Email nay duoc gui tu dong tu he thong noi bo TD Games Platform.',
    'Vui long khong tra loi email nay.',
    '',
    'TD GAMES COMPANY LIMITED',
    'Xom Ngoai, Dong Anh Commune, Hanoi City, Vietnam',
    'MST: 0111386856  |  tdgames.vn@gmail.com',
  );
  return lines.join('\n');
}

// ── HTML template (minimal — Supabase-style) ──────────────────────────────────
// Minimal layout = Gmail classifies as transactional, not promotional.
// Rules: no colored header bars, no badges, no gradients, dark CTA button.
// See EMAIL_STANDARD.md for full design specification.
function buildEmailHtml(
  category: string,
  title: string,
  body: string | null,
  link: string | null,
  appUrl: string,
): string {
  const ctaUrl  = link ? `${appUrl}${link}` : null;
  const preview = (body ?? title).replace(/\s+/g, ' ').slice(0, 90);
  const padding = '&nbsp;&zwnj;'.repeat(20);

  // Dark neutral button — avoids "promotional orange" signal
  const ctaBlock = ctaUrl
    ? `
        <table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
          <tr>
            <td style="border-radius:6px;background-color:#111111;">
              <a href="${ctaUrl}" target="_blank"
                 style="display:inline-block;padding:11px 28px;font-family:Helvetica,Arial,sans-serif;
                        font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;
                        border-radius:6px;white-space:nowrap;">
                Xem chi ti&#7871;t &rarr;
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
  <!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge" /><!--<![endif]-->
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f6f6;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f6f6f6;">
    ${preview}${padding}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f6f6;">
    <tr>
      <td align="center" style="padding:40px 16px 32px 16px;">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;background-color:#ffffff;border-radius:8px;border:1px solid #e8e8e8;">

          <!-- Logo / brand — plain text, no colors -->
          <tr>
            <td style="padding:28px 36px 20px 36px;border-bottom:1px solid #f0f0f0;">
              <span style="font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#111111;letter-spacing:0.03em;text-transform:uppercase;">TD Games</span>
              <span style="font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;color:#999999;">&nbsp;Platform</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 36px 32px 36px;">

              <!-- Category label — plain small gray text, no badge -->
              <p style="margin:0 0 10px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;color:#999999;text-transform:uppercase;letter-spacing:0.06em;">${category}</p>

              <!-- Title -->
              <h1 style="margin:0 0 14px 0;font-family:Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#111111;line-height:1.4;">${title}</h1>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                <tr><td style="height:1px;background-color:#f0f0f0;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>

              ${body
                ? `<p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#444444;line-height:1.7;">${body}</p>`
                : ''}

              ${ctaBlock}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 36px 20px 36px;border-top:1px solid #f0f0f0;">
              <p style="margin:0 0 4px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#aaaaaa;line-height:1.6;">
                Email t&#x1ef1; &#x111;&#x1ed9;ng t&#x1eeb; <strong style="color:#888888;">TD Games Platform</strong>. Vui l&#xf2;ng kh&#xf4;ng reply.
              </p>
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#cccccc;line-height:1.6;">
                TD GAMES COMPANY LIMITED &bull; Dong Anh, Hanoi, Vietnam &bull; MST&nbsp;0111386856
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ── Edge function handler ─────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Only handle INSERT events on the notifications table
    if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const record = payload.record as {
      id:                string;
      recipient_user_id: string;
      type:              string;
      title:             string;
      body?:             string;
      link?:             string;
    };

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@tdgamestudio.com';
    const appUrl    = (Deno.env.get('APP_URL') || 'https://app.tdgamestudio.com').replace(/\/$/, '');

    if (!resendKey) {
      console.error('RESEND_API_KEY not set');
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), { status: 503 });
    }

    // Resolve per-type metadata (subject + category badge)
    const meta     = TYPE_META[record.type] ?? { subject: `[TD Games] ${record.title}`, category: 'Thông báo' };
    const bodyText = record.body || null;
    const linkText = record.link || null;

    // Look up recipient's email address via Supabase Admin
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(
      record.recipient_user_id,
    );
    if (userErr || !userData?.user?.email) {
      console.error('User not found:', userErr);
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    const toEmail = userData.user.email;
    const html    = buildEmailHtml(meta.category, record.title, bodyText, linkText, appUrl);
    const text    = buildEmailText(meta.category, record.title, bodyText, linkText, appUrl);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        // "TD Games" (no "Platform") — less system/bulk feel
        from:     `TD Games <${fromEmail}>`,
        reply_to: fromEmail,
        to:       [toEmail],
        subject:  meta.subject,
        html,
        text,
        // NO List-Unsubscribe / X-Mailer — those are newsletter/bulk signals
        // that cause Gmail to classify email as Promotions, not Primary.
        // This sender volume is <5000/day → not required by Google 2024 policy.
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: err }), { status: resendRes.status });
    }

    const result = await resendRes.json();
    console.log(`[notify-email] sent id=${result.id} to=${toEmail} type=${record.type}`);

    return new Response(
      JSON.stringify({ ok: true, email_id: result.id, to: toEmail }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

  } catch (e) {
    console.error('notify-email error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
