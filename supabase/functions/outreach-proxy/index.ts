import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, PATCH, DELETE",
};

function stripProxyPath(pathname: string): string {
  const prefixes = ["/functions/v1/outreach-proxy", "/outreach-proxy"];
  for (const p of prefixes) {
    if (pathname.startsWith(p)) {
      const rest = pathname.slice(p.length) || "/";
      return rest.startsWith("/") ? rest : `/${rest}`;
    }
  }
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
  if (!backend) {
    return new Response(JSON.stringify({ detail: "OUTREACH_API_URL not set on project secrets" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const rest = stripProxyPath(url.pathname);
  const target = `${backend}${rest === "/" ? "" : rest}${url.search}`;

  const forwardHeaders = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) forwardHeaders.set("content-type", ct);
  const internal = Deno.env.get("OUTREACH_INTERNAL_SECRET");
  if (internal) forwardHeaders.set("x-outreach-internal", internal);

  const init: RequestInit = {
    method: req.method,
    headers: forwardHeaders,
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
  }

  let res: Response;
  try {
    res = await fetch(target, init);
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
