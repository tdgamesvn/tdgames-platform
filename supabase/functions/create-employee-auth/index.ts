import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_DISCORD_WEBHOOK = Deno.env.get("DISCORD_WEBHOOK_ADMIN") ?? "";

async function discordAdminEvent(
  action: string,
  email: string,
  extra: Record<string, string> = {},
) {
  const CONFIG: Record<string, { icon: string; color: number; title: string }> = {
    invite:      { icon: "🆕", color: 0x4CAF50, title: "Tài khoản mới được tạo" },
    delete_user: { icon: "🗑️", color: 0xF44336, title: "Tài khoản bị xoá vĩnh viễn" },
    disable:     { icon: "🚫", color: 0xFF9500, title: "Tài khoản bị vô hiệu hoá" },
    enable:      { icon: "✅", color: 0x4CAF50, title: "Tài khoản được kích hoạt lại" },
    update_role: { icon: "🔄", color: 0x2196F3, title: "Quyền tài khoản đã thay đổi" },
  };

  const cfg = CONFIG[action] ?? { icon: "ℹ️", color: 0x9D9C9D, title: action };
  const vnTime = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  const fields = [
    { name: "📧 Email", value: email, inline: true },
    ...Object.entries(extra).map(([k, v]) => ({ name: k, value: v, inline: true })),
  ];

  await fetch(ADMIN_DISCORD_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: `${cfg.icon} ${cfg.title}`,
        color: cfg.color,
        fields,
        footer: { text: `TD Games Admin • ${vnTime}` },
      }],
    }),
  }).catch(() => { /* never block main flow */ });
}

// ── Resend email sender for auth flows (invite / reset password) ──
// ponytail: template duplicated in manage-employee-auth/index.ts (2 separate
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

// Helper: find auth user by email using RPC (reliable, no pagination issues)
async function findAuthUserByEmail(supabaseAdmin: any, email: string) {
  const { data, error } = await supabaseAdmin.rpc('find_auth_user_by_email', {
    lookup_email: email,
  });

  if (error || !data) return null;
  return {
    id: data.id,
    email: data.email,
    user_metadata: data.user_metadata || {},
    banned_until: data.banned_until,
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── DELETE_USER ACTION: Permanently delete auth user ──
    if (action === "delete_user") {
      const { email } = body;
      if (!email) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing email for delete_user action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const user = await findAuthUserByEmail(supabaseAdmin, email);
      if (!user) {
        return new Response(
          JSON.stringify({ success: true, deleted: false, message: "No auth user found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (delErr) throw delErr;

      await discordAdminEvent("delete_user", email);
      return new Response(
        JSON.stringify({ success: true, deleted: true, message: `Auth user ${email} permanently deleted` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── DISABLE ACTION: Ban auth user (soft delete) ──
    if (action === "disable") {
      const { email } = body;
      if (!email) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing email for disable action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const user = await findAuthUserByEmail(supabaseAdmin, email);
      if (!user) {
        return new Response(
          JSON.stringify({ success: true, disabled: false, message: "No auth user found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { ban_duration: "876600h", user_metadata: { ...user.user_metadata, status: "terminated" } }
      );
      if (banErr) throw banErr;

      await discordAdminEvent("disable", email);
      return new Response(
        JSON.stringify({ success: true, disabled: true, message: `Auth user ${email} disabled` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ENABLE ACTION: Unban auth user (reactivate) ──
    if (action === "enable") {
      const { email } = body;
      if (!email) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing email for enable action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const user = await findAuthUserByEmail(supabaseAdmin, email);
      if (!user) {
        return new Response(
          JSON.stringify({ success: true, enabled: false, message: "No auth user found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: unbanErr } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { ban_duration: "none", user_metadata: { ...user.user_metadata, status: "active" } }
      );
      if (unbanErr) throw unbanErr;

      await discordAdminEvent("enable", email);
      return new Response(
        JSON.stringify({ success: true, enabled: true, message: `Auth user ${email} re-enabled` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CHECK ACTION: Check if email exists in auth ──
    if (action === "check_email") {
      const { email } = body;
      if (!email) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing email" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const user = await findAuthUserByEmail(supabaseAdmin, email);

      return new Response(
        JSON.stringify({ success: true, exists: !!user, user_id: user?.id || null, role: user?.user_metadata?.role || null, secondary_roles: user?.user_metadata?.secondary_roles || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── UPDATE_ROLE ACTION: Change user's role ──
    if (action === "update_role") {
      const { email, role } = body;
      if (!email || !role) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing email or role for update_role action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const user = await findAuthUserByEmail(supabaseAdmin, email);
      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: `No auth user found for ${email}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        {
          user_metadata: { ...user.user_metadata, role },
          app_metadata: { role }, // app_metadata is admin-only, used in RLS policies
        }
      );
      if (updateErr) throw updateErr;

      await discordAdminEvent("update_role", email, {
        "🔙 Trước": user.user_metadata?.role || "member",
        "🔜 Sau": role,
      });
      return new Response(
        JSON.stringify({ success: true, updated: true, message: `Role updated to '${role}' for ${email}`, previous_role: user.user_metadata?.role || "member" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── UPDATE_SECONDARY_ROLES ACTION: Set additional roles ──
    if (action === "update_secondary_roles") {
      const { email, secondary_roles } = body;
      if (!email || !Array.isArray(secondary_roles)) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing email or secondary_roles (array) for update_secondary_roles action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const user = await findAuthUserByEmail(supabaseAdmin, email);
      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: `No auth user found for ${email}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { user_metadata: { ...user.user_metadata, secondary_roles } }
      );
      if (updateErr) throw updateErr;

      await discordAdminEvent("update_secondary_roles", email, {
        "🔙 Trước": JSON.stringify(user.user_metadata?.secondary_roles || []),
        "🔜 Sau": JSON.stringify(secondary_roles),
      });
      return new Response(
        JSON.stringify({ success: true, updated: true, message: `Secondary roles updated for ${email}`, secondary_roles }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── INVITE ACTION (default): Create/invite user ──
    const { email, full_name, employee_id, role, worker_id } = body;

    if (!email || !full_name || !employee_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: email, full_name, employee_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists using direct DB query
    const existingUser = await findAuthUserByEmail(supabaseAdmin, email);

    if (existingUser) {
      // Update metadata for existing user — preserve existing role unless explicitly overridden
      const mergedMetadata: Record<string, any> = {
        ...existingUser.user_metadata,
        username: full_name,
        full_name,
        employee_id,
        // Only overwrite role if caller explicitly provided one
        ...(role ? { role } : {}),
      };
      if (worker_id) mergedMetadata.worker_id = worker_id;

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          user_metadata: mergedMetadata,
          app_metadata: { role: mergedMetadata.role }, // keep app_metadata in sync
        }
      );
      if (updateErr) throw updateErr;

      return new Response(
        JSON.stringify({ success: true, invited: false, message: "User already exists, metadata updated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine user metadata for new invite
    const userMetadata: Record<string, any> = {
      username: full_name,
      full_name,
      employee_id,
      role: role || "member",
    };

    if (worker_id) {
      userMetadata.worker_id = worker_id;
    }

    // Create user + get invite link WITHOUT letting Supabase send its own email
    // (built-in mailer is unreliable — see notify-email which already moved to Resend)
    const redirectTo = `${Deno.env.get("SITE_URL") || "https://app.tdgamestudio.com"}`;
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: userMetadata, redirectTo },
    });

    if (error) throw error;
    if (!data.user?.id) throw new Error("generateLink không trả về user (kiểm tra Redirect URL trong Auth settings)");

    // Set app_metadata (admin-only, used in RLS) — generateLink only sets user_metadata
    await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
      app_metadata: { role: role || "member" },
    });

    await sendAuthEmail({
      to: email,
      subject: "Tài khoản TD Games Platform của bạn đã sẵn sàng",
      title: "Chào mừng đến với TD Games Platform",
      bodyText: `Xin chào ${full_name},\n\nTài khoản của bạn đã được tạo. Bấm nút bên dưới để đặt mật khẩu và bắt đầu sử dụng hệ thống.`,
      ctaUrl: data.properties.action_link,
      ctaLabel: "Đặt mật khẩu & Đăng nhập",
    });

    await discordAdminEvent("invite", email, {
      "👤 Tên": full_name,
      "🏷️ Role": role || "member",
    });
    return new Response(
      JSON.stringify({ success: true, invited: true, user_id: data.user?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
