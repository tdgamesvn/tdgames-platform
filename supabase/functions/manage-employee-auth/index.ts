import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

      // Create fresh invite
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          username: full_name || email.split('@')[0],
          role: 'member',
          employee_id: employee_id,
        },
        redirectTo: 'https://app.tdgamestudio.com',
      });

      if (error) {
        throw error;
      }
      if (!data?.user?.id) {
        throw new Error('inviteUserByEmail không trả về user (kiểm tra Redirect URL trong Auth settings)');
      }

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
