// LƯU TRỮ — KHÔNG DEPLOY FILE NÀY.
//
// Đây là bản gốc của edge function `create-admin-user`, kéo từ server ngày 2026-08-26 bằng
// `mcp__supabase__get_edge_function` (version 18, verify_jwt=false). Nó là lỗ hổng CRITICAL:
// tạo tài khoản với role tuỳ ý cho bất kỳ ai trên Internet, không kiểm quyền.
//
// Giữ lại chỉ để hoàn tác được nếu hoá ra có hệ thống nào đó thật sự phụ thuộc, và để đối
// chiếu khi điều tra log. Muốn dùng lại thì BẮT BUỘC thêm: bật verify_jwt, kiểm caller có
// role admin, và bỏ việc lấy `role` từ body.
//
// Bản đang chạy trên production đã được thay bằng 410 Gone (xem ../create-admin-user/index.ts).

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
    const { email, password, role, username } = await req.json();

    if (!email || !password || !role) {
      return new Response(
        JSON.stringify({ error: 'email, password, and role are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: username || email.split('@')[0],
        role: role,
      },
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, user_id: data.user.id }),
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
