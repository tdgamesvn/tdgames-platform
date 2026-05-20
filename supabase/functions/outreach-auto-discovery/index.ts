import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Auto Discovery edge function.
 *
 * Auth: chấp nhận x-cron-secret (pg_cron) HOẶC Bearer JWT (UI manual).
 * Khi chạy tự động qua cron:
 *  - Dùng SUPABASE_SERVICE_ROLE_KEY (bỏ qua RLS)
 *  - Tự đọc country hiện tại từ crm_outreach_config.auto_discovery
 *  - Check enabled flag (skip nếu disabled)
 *
 * Builds exclusion lists from Supabase, then forwards to FastAPI /api/discovery/auto-run.
 * After a successful run, inserts new studios + leads, updates rotation state.
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
  let isCron = false;

  if (cronSecret) {
    // pg_cron path: validate secret, use service role
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
    isCron = true;
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
  if (!backend) {
    return new Response(JSON.stringify({ detail: "OUTREACH_API_URL not set" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Read auto_discovery config
  const { data: cfgRow } = await supabase
    .from("crm_outreach_config")
    .select("value")
    .eq("key", "auto_discovery")
    .single();

  const cfg = (cfgRow?.value ?? {}) as any;

  // Cron: skip nếu auto_discovery.enabled = false
  if (isCron && !cfg.enabled) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "auto_discovery disabled" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Read body overrides (UI có thể override country/page)
  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { /* use config defaults */ }

  // Resolve country: body override > config rotation
  const countries: string[] = cfg.countries ?? ["United States"];
  const idx = cfg.current_country_index ?? 0;
  const resolvedCountry = body.country ?? countries[idx] ?? "United States";
  const resolvedPage = body.page ?? cfg.current_page ?? 1;
  const studiosPerRun = body.studios_per_run ?? cfg.studios_per_run ?? 5;
  const reDiscoverAfterDays = body.re_discover_after_days ?? cfg.re_discover_after_days ?? 90;

  // Build exclusion lists
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - reDiscoverAfterDays);

  const [studiosRes, leadsRes] = await Promise.all([
    supabase
      .from("crm_discovered_studios")
      .select("apollo_id")
      .gte("discovered_at", cutoffDate.toISOString()),
    supabase
      .from("crm_outreach_leads")
      .select("email"),
  ]);

  const existingApolloIds: string[] = (studiosRes.data ?? []).map((r: any) => r.apollo_id);
  const existingEmails: string[] = (leadsRes.data ?? []).map((r: any) => r.email).filter(Boolean);

  const payload = {
    country: resolvedCountry,
    page: resolvedPage,
    studios_per_run: studiosPerRun,
    existing_apollo_ids: existingApolloIds,
    existing_emails: existingEmails,
  };

  const forwardHeaders = new Headers({ "content-type": "application/json" });
  const internal = Deno.env.get("OUTREACH_INTERNAL_SECRET");
  if (internal) forwardHeaders.set("x-outreach-internal", internal);

  let backendRes: Response;
  try {
    backendRes = await fetch(`${backend}/api/discovery/auto-run`, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return new Response(JSON.stringify({ detail: String(e) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!backendRes.ok) {
    const errText = await backendRes.text();
    return new Response(JSON.stringify({ detail: errText }), {
      status: backendRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result: {
    studios_searched: number;
    studios_skipped: number;
    contacts_found: number;
    leads_to_add: Array<{ email: string; company: string; name?: string; title?: string; country?: string; tier?: number }>;
    new_apollo_ids: Array<{ apollo_id: string; studio_name: string; country: string; contacts_found: number }>;
    country_exhausted: boolean;
  } = await backendRes.json();

  // Insert new leads (ignore email conflicts)
  if (result.leads_to_add?.length) {
    await supabase.from("crm_outreach_leads").upsert(
      result.leads_to_add.map(l => ({
        email: l.email,
        company: l.company,
        name: l.name ?? null,
        title: l.title ?? null,
        country: l.country ?? resolvedCountry,
        tier: l.tier ?? 3,
        status: "pending",
        source: "apollo_auto",
      })),
      { onConflict: "email", ignoreDuplicates: true },
    );
  }

  // Insert new discovered studios
  if (result.new_apollo_ids?.length) {
    await supabase.from("crm_discovered_studios").upsert(
      result.new_apollo_ids.map(s => ({
        apollo_id: s.apollo_id,
        studio_name: s.studio_name,
        country: s.country,
        contacts_found: s.contacts_found,
        discovered_at: new Date().toISOString(),
      })),
      { onConflict: "apollo_id" },
    );
  }

  // Update rotation state
  let newIdx = idx;
  let newPage = resolvedPage;
  if (result.country_exhausted) {
    newIdx = (idx + 1) % Math.max(countries.length, 1);
    newPage = 1;
  } else {
    newPage += 1;
  }

  await supabase.from("crm_outreach_config").update({
    value: {
      ...cfg,
      current_country_index: newIdx,
      current_page: newPage,
      last_run_at: new Date().toISOString(),
      last_run_country: resolvedCountry,
      last_run_stats: {
        studios_searched: result.studios_searched,
        contacts_added: result.contacts_found,
        skipped_studio: result.studios_skipped,
        skipped_email: (result.leads_to_add?.length ?? 0) - (result.contacts_found ?? 0),
      },
    },
    updated_at: new Date().toISOString(),
  }).eq("key", "auto_discovery");

  return new Response(JSON.stringify({
    ok: true,
    country: resolvedCountry,
    page: resolvedPage,
    studios_searched: result.studios_searched,
    studios_skipped: result.studios_skipped,
    contacts_added: result.contacts_found,
    country_exhausted: result.country_exhausted,
    next_country_index: newIdx,
    next_page: newPage,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
