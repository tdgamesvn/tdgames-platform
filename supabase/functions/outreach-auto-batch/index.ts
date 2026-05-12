import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** POST body forwarded; path overridable via OUTREACH_AUTO_BATCH_PATH (default /api/email/auto-batch). */
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

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ detail: "Missing Authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ detail: "Invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const backend = (Deno.env.get("OUTREACH_API_URL") || "").trim().replace(/\/$/, "");
  const path = (Deno.env.get("OUTREACH_AUTO_BATCH_PATH") || "/api/email/auto-batch").trim();
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
