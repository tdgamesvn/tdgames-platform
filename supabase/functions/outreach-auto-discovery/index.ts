import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Auto Discovery edge function.
 * Builds exclusion lists from Supabase, then forwards to FastAPI /api/discovery/auto-run.
 * After a successful run, inserts new studios + leads, updates rotation state in crm_outreach_config.
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
    return new Response(JSON.stringify({ detail: "OUTREACH_API_URL not set" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Read body: { country, page, studios_per_run, re_discover_after_days }
  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { /* use defaults from config */ }

  // Build exclusion lists
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (body.re_discover_after_days ?? 90));

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
    country: body.country,
    page: body.page ?? 1,
    studios_per_run: body.studios_per_run ?? 5,
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
        country: l.country ?? body.country,
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

  // Update rotation state in crm_outreach_config
  const { data: cfgRow } = await supabase
    .from("crm_outreach_config")
    .select("value")
    .eq("key", "auto_discovery")
    .single();

  if (cfgRow) {
    const cfg = cfgRow.value as any;
    const countries: string[] = cfg.countries ?? [];
    let idx = cfg.current_country_index ?? 0;
    let page = cfg.current_page ?? 1;

    if (result.country_exhausted) {
      idx = (idx + 1) % Math.max(countries.length, 1);
      page = 1;
    } else {
      page += 1;
    }

    await supabase.from("crm_outreach_config").update({
      value: {
        ...cfg,
        current_country_index: idx,
        current_page: page,
        last_run_at: new Date().toISOString(),
        last_run_country: body.country,
        last_run_stats: {
          studios_searched: result.studios_searched,
          contacts_added: result.contacts_found,
          skipped_studio: result.studios_skipped,
          skipped_email: (result.leads_to_add?.length ?? 0) - (result.contacts_found ?? 0),
        },
      },
      updated_at: new Date().toISOString(),
    }).eq("key", "auto_discovery");
  }

  return new Response(JSON.stringify({
    ok: true,
    studios_searched: result.studios_searched,
    studios_skipped: result.studios_skipped,
    contacts_added: result.contacts_found,
    country_exhausted: result.country_exhausted,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
