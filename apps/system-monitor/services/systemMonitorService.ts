import { supabase } from '@/services/supabaseClient';

export interface HealthCheck {
  id: string;
  service_name: string;
  service_type: string;
  status: 'up' | 'down' | 'degraded';
  latency_ms: number | null;
  status_code: number | null;
  error_msg: string | null;
  metadata: Record<string, unknown> | null;
  checked_at: string;
}

/** Latest status per service (most recent check per name) */
export async function fetchLatestHealthChecks(): Promise<HealthCheck[]> {
  const { data, error } = await supabase
    .from('system_health_checks')
    .select('*')
    .order('checked_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  if (!data) return [];

  // Deduplicate — keep only latest per service_name
  const seen = new Set<string>();
  const latest: HealthCheck[] = [];
  for (const row of data) {
    if (!seen.has(row.service_name)) {
      seen.add(row.service_name);
      latest.push(row as HealthCheck);
    }
  }
  return latest;
}

/** History for sparkline — last 24 checks per service */
export async function fetchHealthHistory(serviceName: string): Promise<HealthCheck[]> {
  const { data, error } = await supabase
    .from('system_health_checks')
    .select('*')
    .eq('service_name', serviceName)
    .order('checked_at', { ascending: false })
    .limit(24);
  if (error) throw error;
  return (data || []) as HealthCheck[];
}

/** Trigger a new check via Edge Function */
export async function triggerHealthCheck(): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };
  try {
    const res = await supabase.functions.invoke('system-monitor', { body: {} });
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
