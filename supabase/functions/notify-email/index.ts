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
const TYPE_META: Record<string, { subject: string; category: string }> = {
  // Nghỉ phép
  leave_approved:         { subject: '[TD Games] Đơn nghỉ phép của bạn đã được duyệt',   category: 'Nghỉ phép'   },
  leave_rejected:         { subject: '[TD Games] Đơn nghỉ phép của bạn bị từ chối',       category: 'Nghỉ phép'   },
  leave_new:              { subject: '[TD Games] Có đơn nghỉ phép mới cần xử lý',          category: 'Nghỉ phép'   },
  // Lương
  payslip_created:          { subject: '[TD Games] Phiếu lương tháng vừa được cập nhật',        category: 'Bảng lương'  },
  payslip_pending_review:   { subject: '[TD Games] Phiếu lương cần xác nhận',                   category: 'Bảng lương'  },
  // Chi phí
  expense_approved:       { subject: '[TD Games] Chi phí của bạn đã được duyệt',          category: 'Chi phí'     },
  expense_rejected:       { subject: '[TD Games] Chi phí của bạn bị từ chối',             category: 'Chi phí'     },
  // Hóa đơn
  invoice_overdue:        { subject: '[TD Games] Cảnh báo: Invoice sắp quá hạn',          category: 'Hóa đơn'     },
  // Broadcast
  broadcast:              { subject: '[TD Games] Thông báo từ Ban Giám Đốc',              category: 'Thông báo'   },
  // Đánh giá nhân viên
  eval_self_submitted:    { subject: '[TD Games] Nhân viên đã nộp tự đánh giá',           category: 'Đánh giá'    },
  eval_leader_submitted:  { subject: '[TD Games] Kết quả đánh giá đã có',                 category: 'Đánh giá'    },
  eval_1on1_required:     { subject: '[TD Games] Cần lên lịch buổi 1-on-1',               category: 'Đánh giá'    },
  eval_completed:         { subject: '[TD Games] Kỳ đánh giá đã hoàn tất',               category: 'Đánh giá'    },
  eval_assigned:          { subject: '[TD Games] Bạn có form tự đánh giá mới',            category: 'Đánh giá'    },
  eval_deadline_reminder: { subject: '[TD Games] Nhắc nhở: Form đánh giá sắp hết hạn',   category: 'Đánh giá'    },
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

// ── HTML template ─────────────────────────────────────────────────────────────
// See EMAIL_STANDARD.md for full design specification and rules
function buildEmailHtml(
  category: string,
  title: string,
  body: string | null,
  link: string | null,
  appUrl: string,
): string {
  const ctaUrl  = link ? `${appUrl}${link}` : null;
  // Preheader = first 90 chars of body, shown in inbox as preview text
  const preview = (body ?? title).replace(/\s+/g, ' ').slice(0, 90);
  // Zero-width non-joiners pad the preheader so Gmail doesn't show junk after it
  const padding = '&nbsp;&zwnj;'.repeat(20);

  const ctaBlock = ctaUrl
    ? `
        <!-- CTA button: table-wrapped for Outlook compatibility -->
        <table cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
          <tr>
            <td align="center" style="border-radius:6px;background-color:#FF9500;">
              <a href="${ctaUrl}" target="_blank"
                 style="display:inline-block;padding:12px 32px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#000000;text-decoration:none;border-radius:6px;white-space:nowrap;">
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
  <!--[if !mso]><!-->
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--<![endif]-->
  <title>${title}</title>
</head>

<body style="margin:0;padding:0;background-color:#f2f2f4;word-spacing:normal;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!--
    PREHEADER — hidden text shown in Gmail/Apple Mail inbox preview.
    Keep under 90 chars before the padding.
  -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;
              font-size:1px;line-height:1px;color:#f2f2f4;">
    ${preview}${padding}
  </div>

  <!-- PAGE WRAPPER -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f2f2f4;">
    <tr>
      <td align="center" style="padding:48px 16px 32px 16px;">

        <!-- ═══════════════════════════════════════════
             EMAIL CARD  (max 600px)
             ═══════════════════════════════════════════ -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background-color:#ffffff;border-radius:10px;
                      border:1px solid #e0e0e4;overflow:hidden;">

          <!-- ┌─────────────────────────────────────┐
               │  HEADER: orange accent bar + brand  │
               └─────────────────────────────────────┘ -->
          <tr>
            <!-- Top accent stripe -->
            <td style="height:4px;background-color:#FF9500;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:20px 36px 18px 36px;border-bottom:1px solid #ebebee;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <!-- Brand name -->
                    <span style="font-family:Helvetica,Arial,sans-serif;font-size:15px;
                                 font-weight:900;color:#111111;letter-spacing:0.06em;
                                 text-transform:uppercase;">
                      TD Games
                    </span>
                    <span style="font-family:Helvetica,Arial,sans-serif;font-size:15px;
                                 font-weight:400;color:#888888;letter-spacing:0.02em;">
                      &nbsp;Platform
                    </span>
                  </td>
                  <td align="right" valign="middle">
                    <!-- Dynamic category badge -->
                    <span style="display:inline-block;padding:3px 10px;
                                 background-color:#fff3e0;border-radius:20px;
                                 font-family:Helvetica,Arial,sans-serif;font-size:11px;
                                 font-weight:700;color:#e65c00;letter-spacing:0.04em;
                                 text-transform:uppercase;white-space:nowrap;">
                      ${category}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ┌─────────────────────────────────────┐
               │  BODY                               │
               └─────────────────────────────────────┘ -->
          <tr>
            <td style="padding:32px 36px 28px 36px;">

              <!-- Title -->
              <h1 style="margin:0 0 14px 0;
                         font-family:Helvetica,Arial,sans-serif;
                         font-size:21px;font-weight:800;
                         color:#111111;line-height:1.4;letter-spacing:-0.01em;">
                ${title}
              </h1>

              ${body
                ? `<!-- Body paragraph -->
              <p style="margin:0;
                        font-family:Helvetica,Arial,sans-serif;
                        font-size:15px;color:#555555;line-height:1.75;">
                ${body}
              </p>`
                : ''}

              ${ctaBlock}

            </td>
          </tr>

          <!-- ┌─────────────────────────────────────┐
               │  FOOTER                             │
               └─────────────────────────────────────┘ -->
          <tr>
            <td style="padding:18px 36px 22px 36px;
                       background-color:#f9f9fb;
                       border-top:1px solid #ebebee;">
              <p style="margin:0 0 5px 0;
                        font-family:Helvetica,Arial,sans-serif;
                        font-size:12px;color:#999999;line-height:1.6;">
                Email n&#xe0;y &#x111;&#x01b0;&#x1ee3;c g&#x1edf;i t&#x1ef1; &#x111;&#x1ed9;ng t&#x1eeb; h&#x1ec7; th&#x1ed1;ng n&#x1ed9;i b&#x1ed9;
                <strong style="color:#666666;">TD Games Platform</strong>.
                Vui l&#xf2;ng kh&#xf4;ng tr&#x1ea3; l&#x1eddi; email n&#xe0;y.
              </p>
              <p style="margin:0;
                        font-family:Helvetica,Arial,sans-serif;
                        font-size:11px;color:#bbbbbb;line-height:1.6;">
                TD GAMES COMPANY LIMITED
                &bull; Xom Ngoai, Dong Anh Commune, Hanoi, Vietnam
                &bull; MST&nbsp;0111386856
              </p>
            </td>
          </tr>

        </table>
        <!-- /EMAIL CARD -->

      </td>
    </tr>
  </table>
  <!-- /PAGE WRAPPER -->

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
        from:     `TD Games Platform <${fromEmail}>`,
        reply_to: fromEmail,
        to:       [toEmail],
        subject:  meta.subject,
        html,
        text,
        // Required by Google / Yahoo 2024 bulk sender guidelines
        headers: {
          'List-Unsubscribe':      `<mailto:${fromEmail}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Mailer':              'TD Games Platform v1',
        },
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
