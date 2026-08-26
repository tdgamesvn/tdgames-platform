import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ── Resend email sender for auth flows (invite / reset password) ──
// ponytail: template duplicated in create-employee-auth/index.ts (2 separate
// Deno edge functions, no shared runtime between them) — mirrors the visual
// style of notify-email/index.ts. Update both if the look changes.
async function sendAuthEmail(opts: {
  to: string;
  subject: string;
  title: string;
  bodyText: string;
  ctaUrl: string;
  ctaLabel: string;
}) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@tdgamestudio.com";
  if (!resendKey) throw new Error("RESEND_API_KEY not set");

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="vi"><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background-color:#f6f6f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f6f6;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;border:1px solid #e8e8e8;">
        <tr><td style="padding:22px 36px;background-color:#FF9500;border-radius:8px 8px 0 0;">
          <span style="font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:900;color:#000000;letter-spacing:0.05em;text-transform:uppercase;">TD Games</span>
          <span style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:rgba(0,0,0,0.55);">&nbsp;Platform</span>
        </td></tr>
        <tr><td style="padding:28px 36px 32px 36px;">
          <p style="margin:0 0 10px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;color:#999999;text-transform:uppercase;letter-spacing:0.06em;">Tài khoản</p>
          <h1 style="margin:0 0 14px 0;font-family:Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#111111;line-height:1.4;">${opts.title}</h1>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;"><tr><td style="height:1px;background-color:#f0f0f0;font-size:0;">&nbsp;</td></tr></table>
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#444444;line-height:1.7;">${opts.bodyText.replace(/\n/g, "<br>")}</p>
          <table cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td style="border-radius:6px;background-color:#FF9500;">
            <a href="${opts.ctaUrl}" target="_blank" style="display:inline-block;padding:11px 28px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#000000;text-decoration:none;border-radius:6px;white-space:nowrap;">${opts.ctaLabel} &rarr;</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:16px 36px 20px 36px;border-top:1px solid #f0f0f0;">
          <p style="margin:0 0 4px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#aaaaaa;">Email t&#x1ef1; &#x111;&#x1ed9;ng t&#x1eeb; <strong style="color:#888888;">TD Games Platform</strong>. Vui l&#xf2;ng kh&#xf4;ng reply.</p>
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#cccccc;">TD GAMES COMPANY LIMITED</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `TD GAMES PLATFORM | TAI KHOAN\n${"-".repeat(50)}\n\n${opts.title}\n\n${opts.bodyText}\n\n${opts.ctaLabel}: ${opts.ctaUrl}\n\n${"-".repeat(50)}\nEmail nay duoc gui tu dong tu he thong noi bo TD Games Platform.\nVui long khong tra loi email nay.\n\nTD GAMES COMPANY LIMITED\nXom Ngoai, Dong Anh Commune, Hanoi City, Vietnam\nMST: 0111386856 | tdgames.vn@gmail.com`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `TD Games <${fromEmail}>`,
      reply_to: fromEmail,
      to: [opts.to],
      subject: opts.subject,
      html,
      text,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
    'Connection': 'keep-alive',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, email, full_name, employee_id } = await req.json();

    if (!email || !action) {
      return new Response(
        JSON.stringify({ error: 'email and action are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── GUARD: chỉ admin/hr ────────────────────────────────────────────────
    // Trước 2026-08-26 function này KHÔNG kiểm quyền caller dù chạy bằng SERVICE_ROLE_KEY.
    // Ai cũng gọi được `reset_password` cho email bất kỳ ⇒ spam link đặt lại mật khẩu tới
    // nhân viên, và nó còn ghi đè `user_metadata: { password_set: false }` (xoá luôn role
    // trong user_metadata ⇒ hỏng guard UI của người đó). `resend_invite` thì xoá được
    // tài khoản chưa xác nhận: nhánh đó gọi deleteUser trước khi tạo lại.
    // Cả 2 lời gọi hợp lệ đều từ HR app và đã kèm Authorization (hrService.ts:414, :434).
    const callerToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!callerToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: thiếu Authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }
    const { data: { user: caller }, error: callerErr } =
      await supabaseAdmin.auth.getUser(callerToken);
    if (callerErr || !caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: token không hợp lệ' }),
        { status: 401, headers: corsHeaders }
      );
    }
    // app_metadata, KHÔNG phải user_metadata — user_metadata do chính người dùng ghi được.
    const callerMeta = (caller.app_metadata || {}) as Record<string, unknown>;
    const callerRoles = [
      callerMeta.role,
      ...(Array.isArray(callerMeta.secondary_roles) ? callerMeta.secondary_roles : []),
    ];
    if (!callerRoles.some((r) => r === 'admin' || r === 'hr')) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: cần quyền admin hoặc hr' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // ── RESEND INVITE ──
    if (action === 'resend_invite') {
      if (!employee_id) {
        return new Response(
          JSON.stringify({ error: 'employee_id is required for resend_invite' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // find_auth_user_by_email trả về 1 JSON object (hoặc null), KHÔNG phải mảng.
      const { data: existingUser, error: lookupError } = await supabaseAdmin
        .rpc('find_auth_user_by_email', { lookup_email: email });

      if (lookupError) {
        throw lookupError;
      }

      if (existingUser?.id) {
        const userId = existingUser.id;
        console.log(`Deleting existing auth user ${userId} for re-invite`);
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }

      // Create fresh invite + get link WITHOUT letting Supabase send its own email
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: {
          data: {
            username: full_name || email.split('@')[0],
            role: 'member',
            employee_id: employee_id,
          },
          redirectTo: 'https://app.tdgamestudio.com',
        },
      });

      if (error) {
        throw error;
      }
      if (!data?.user?.id) {
        throw new Error('generateLink không trả về user (kiểm tra Redirect URL trong Auth settings)');
      }

      await sendAuthEmail({
        to: email,
        subject: 'Bạn được mời tham gia lại TD Games Platform',
        title: 'Lời mời tham gia TD Games Platform',
        bodyText: `Xin chào ${full_name || email},\n\nBấm nút bên dưới để đặt mật khẩu và truy cập hệ thống.`,
        ctaUrl: data.properties.action_link,
        ctaLabel: 'Đặt mật khẩu & Đăng nhập',
      });

      return new Response(
        JSON.stringify({ success: true, user_id: data.user.id, message: `Đã gửi lại invite đến ${email}` }),
        { headers: corsHeaders }
      );
    }

    // ── RESET PASSWORD ──
    if (action === 'reset_password') {
      // find_auth_user_by_email trả về 1 JSON object (hoặc null), KHÔNG phải mảng.
      const { data: existingUser, error: lookupError } = await supabaseAdmin
        .rpc('find_auth_user_by_email', { lookup_email: email });

      if (lookupError) {
        throw lookupError;
      }

      if (!existingUser?.id) {
        return new Response(
          JSON.stringify({ error: `Không tìm thấy tài khoản với email ${email}. Hãy gửi invite trước.` }),
          { status: 404, headers: corsHeaders }
        );
      }

      const userId = existingUser.id;

      // Generate password reset link
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
          redirectTo: 'https://app.tdgamestudio.com',
        },
      });

      if (error) {
        throw error;
      }

      await sendAuthEmail({
        to: email,
        subject: 'Yêu cầu đặt lại mật khẩu TD Games Platform',
        title: 'Đặt lại mật khẩu',
        bodyText: 'Xin chào,\n\nBấm nút bên dưới để đặt mật khẩu mới cho tài khoản TD Games Platform của bạn. Nếu bạn không yêu cầu việc này, hãy bỏ qua email.',
        ctaUrl: data.properties.action_link,
        ctaLabel: 'Đặt lại mật khẩu',
      });

      // Also reset password_set flag so they'll be prompted again
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { password_set: false },
      });

      return new Response(
        JSON.stringify({ success: true, message: `Đã gửi email reset password đến ${email}` }),
        { headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('manage-employee-auth error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
