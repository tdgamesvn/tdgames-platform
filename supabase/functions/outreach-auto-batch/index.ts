import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Auth: chấp nhận x-cron-secret (pg_cron) HOẶC Bearer JWT (UI manual).
 * Khi dùng cron secret → dùng service role key để bỏ qua RLS.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ detail: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const cronSecret = req.headers.get("x-cron-secret");
  const auth = req.headers.get("Authorization");

  let supabase;

  if (cronSecret) {
    // pg_cron path: validate secret against DB value, use service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: secretRow } = await adminClient
      .from("crm_outreach_config")
      .select("value")
      .eq("key", "cron_secret")
      .single();

    const expectedSecret = secretRow?.value as string;
    if (!expectedSecret || cronSecret !== expectedSecret) {
      return new Response(JSON.stringify({ detail: "Invalid cron secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    supabase = adminClient;
  } else if (auth?.startsWith("Bearer ")) {
    // UI manual path: validate user JWT
    supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ detail: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    return new Response(JSON.stringify({ detail: "Missing auth: provide x-cron-secret or Authorization Bearer" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const backend = (Deno.env.get("OUTREACH_API_URL") || "").trim().replace(/\/$/, "");
  const path = (Deno.env.get("OUTREACH_AUTO_BATCH_PATH") || "/api/automation/daily-send").trim();
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (!backend) {
    return new Response(JSON.stringify({ detail: "OUTREACH_API_URL not set on project secrets" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const target = `${backend}${suffix}`;
  const forwardHeaders = new Headers({ "content-type": "application/json" });
  const internal = Deno.env.get("OUTREACH_INTERNAL_SECRET");
  if (internal) forwardHeaders.set("x-outreach-internal", internal);

  // Forward X-Admin-Token for FastAPI auth (read from DB or env)
  const adminTokenEnv = Deno.env.get("OUTREACH_ADMIN_TOKEN");
  if (adminTokenEnv) {
    forwardHeaders.set("X-Admin-Token", adminTokenEnv);
  } else {
    // Fallback: read from DB (service role already set above)
    const { data: tokenRow } = await (supabase as any)
      .from("crm_outreach_config")
      .select("value")
      .eq("key", "admin_token")
      .single();
    const adminToken = tokenRow?.value as string | undefined;
    if (adminToken) forwardHeaders.set("X-Admin-Token", adminToken);
  }

  const bodyText = await req.text();

  let res: Response;
  try {
    res = await fetch(target, { method: "POST", headers: forwardHeaders, body: bodyText || "{}" });
  } catch (e) {
    return new Response(JSON.stringify({ detail: String(e) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const out = new Headers();
  for (const [k, v] of Object.entries(corsHeaders)) out.set(k, v);
  res.headers.forEach((v, k) => {
    const kl = k.toLowerCase();
    if (["content-encoding", "transfer-encoding", "connection"].includes(kl)) return;
    out.set(k, v);
  });
  return new Response(res.body, { status: res.status, headers: out });
});
