import { supabase } from '@/services/supabaseClient';

const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clickup-sync`;

export interface ClickUpConfig {
  id?: string;
  api_token: string;
  team_id: string;
  team_name: string;
  spaces: ClickUpSpace[];
  last_synced: string | null;
  auto_sync_times?: string[];
  auto_sync_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ClickUpSpace {
  id: string;
  name: string;
  lists: ClickUpList[];
}

export interface ClickUpList {
  id: string;
  name: string;
  folder: string | null;
  selected: boolean;
}

export interface SyncedTask {
  clickup_task_id: string;
  title: string;
  clickup_status: string;
  clickup_list_id: string;
  list_name: string;
  folder_name: string | null;
  space_name: string;
  assignee_emails: string[];
  date_done: string | null;
  date_created: string | null;
  date_updated: string | null;
}

export interface ListContext {
  list_id: string;
  list_name: string;
  folder_name: string | null;
  space_name: string;
}

// ── Edge Function proxy calls ─────────────────────────────────
async function callEdgeFunction(body: any): Promise<any> {
  // clickup-sync trước đây không đọc header nào ⇒ ai cũng POST được. Giờ nó đòi session token
  // thật + role admin/ke_toan, nên phải gửi kèm — thiếu là 401.
  const { data: sess } = await supabase.auth.getSession();
  const accessToken = sess.session?.access_token;
  if (!accessToken) throw new Error('Phiên đăng nhập đã hết hạn — đăng nhập lại để đồng bộ ClickUp.');
  const resp = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function fetchTeams(token: string) {
  return callEdgeFunction({ action: 'get_teams', token });
}

export async function fetchSpaces(token: string, teamId: string) {
  return callEdgeFunction({ action: 'get_spaces', token, teamId });
}

export async function fetchLists(token: string, spaceId: string) {
  return callEdgeFunction({ action: 'get_lists', token, spaceId });
}

export async function syncTasks(token: string, teamId: string, listIds: string[], listContexts?: ListContext[]): Promise<{ tasks: SyncedTask[]; member_count: number }> {
  return callEdgeFunction({ action: 'sync_tasks', token, teamId, listIds, listContexts });
}

// ── Config CRUD ───────────────────────────────────────────────
export async function loadConfig(): Promise<ClickUpConfig | null> {
  const { data, error } = await supabase
    .from('wf_clickup_config')
    .select('*')
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data || null;
}

export async function saveConfig(config: Omit<ClickUpConfig, 'id' | 'created_at' | 'updated_at'>): Promise<ClickUpConfig> {
  // Upsert: delete existing + insert new
  await supabase.from('wf_clickup_config').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { data, error } = await supabase
    .from('wf_clickup_config')
    .insert({ ...config, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateConfigSyncTime(): Promise<void> {
  const { error } = await supabase
    .from('wf_clickup_config')
    .update({ last_synced: new Date().toISOString(), updated_at: new Date().toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}

// ── CRM Mapping (Space → client, Folder → project) ────────────
export interface CrmMapEntry {
  id?: string;
  clickup_type: 'space' | 'folder';
  clickup_name: string;
  client_id: string | null;
  project_id: string | null;
}

export async function loadCrmMap(): Promise<CrmMapEntry[]> {
  const { data, error } = await supabase.from('wf_clickup_crm_map').select('*');
  if (error) throw error;
  return data || [];
}

export async function saveCrmMapEntry(entry: CrmMapEntry): Promise<void> {
  const { error } = await supabase
    .from('wf_clickup_crm_map')
    .upsert(
      { ...entry, updated_at: new Date().toISOString() },
      { onConflict: 'clickup_type,clickup_name' }
    );
  if (error) throw error;
}

// Distinct Space/Folder names từ task đã sync — nguồn cho màn mapping
export async function fetchClickUpNames(): Promise<{ spaces: string[]; folders: string[] }> {
  const { data, error } = await supabase
    .from('wf_tasks')
    .select('clickup_space_name, clickup_folder_name');
  if (error) throw error;
  const spaces = [...new Set((data || []).map(t => t.clickup_space_name).filter(Boolean))] as string[];
  const folders = [...new Set((data || []).map(t => t.clickup_folder_name).filter(Boolean))] as string[];
  return { spaces: spaces.sort(), folders: folders.sort() };
}

// ── Loại trừ sync theo tên space/folder/list (bảng wf_sync_exclusions) ──
export type ExclusionKind = 'space' | 'folder' | 'list';
export async function loadExclusions(): Promise<Set<string>> {
  const { data } = await supabase.from('wf_sync_exclusions').select('kind, name');
  return new Set((data || []).map((r: any) => `${r.kind}:${r.name}`));
}
export async function setExclusion(kind: ExclusionKind, name: string, excluded: boolean): Promise<void> {
  const q = excluded
    ? supabase.from('wf_sync_exclusions').upsert({ kind, name })
    : supabase.from('wf_sync_exclusions').delete().eq('kind', kind).eq('name', name);
  const { error } = await q;
  if (error) throw error;
}
export function isExcluded(
  ex: Set<string>,
  t: { space?: string | null; folder?: string | null; list?: string | null },
): boolean {
  return ex.has(`space:${t.space}`) || ex.has(`folder:${t.folder}`) || ex.has(`list:${t.list}`);
}

export async function fetchCrmOptions(): Promise<{
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
}> {
  const [c, p] = await Promise.all([
    supabase.from('crm_clients').select('id, name').order('name'),
    supabase.from('crm_projects').select('id, name').order('name'),
  ]);
  if (c.error) throw c.error;
  if (p.error) throw p.error;
  return { clients: c.data || [], projects: p.data || [] };
}

// ── Webhook Management ────────────────────────────────────────

const CLICKUP_API = 'https://api.clickup.com/api/v2';

async function clickupApi(path: string, token: string, options?: RequestInit) {
  const resp = await fetch(`${CLICKUP_API}${path}`, {
    ...options,
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickUp API error ${resp.status}: ${text}`);
  }
  // DELETE returns 204 with no body
  if (resp.status === 204) return {};
  return resp.json();
}

export interface ClickUpWebhook {
  id: string;
  endpoint: string;
  events: string[];
  status: string;
}

export async function listWebhooks(token: string, teamId: string): Promise<ClickUpWebhook[]> {
  const data = await clickupApi(`/team/${teamId}/webhook`, token);
  return data.webhooks || [];
}

export async function registerWebhook(token: string, teamId: string): Promise<ClickUpWebhook> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const endpoint = `${SUPABASE_URL}/functions/v1/clickup-webhook`;

  // Check for existing webhooks first to avoid "already exists" error
  try {
    const existing = await listWebhooks(token, teamId);
    const match = existing.find(w => w.endpoint === endpoint);
    if (match) {
      return match; // Reuse existing webhook
    }
  } catch { /* ignore list error, try to create */ }

  try {
    const data = await clickupApi(`/team/${teamId}/webhook`, token, {
      method: 'POST',
      body: JSON.stringify({
        endpoint,
        events: [
          'taskCreated',
          'taskUpdated',
          'taskDeleted',
          'taskStatusUpdated',
          'taskAssigneeUpdated',
        ],
      }),
    });
    return data.webhook || data;
  } catch (err: any) {
    // If webhook already exists but we couldn't find it by endpoint match,
    // try to get the first webhook and return it
    if (err.message?.includes('already exists')) {
      const all = await listWebhooks(token, teamId);
      if (all.length > 0) return all[0];
    }
    throw err;
  }
}

export async function deleteWebhook(token: string, webhookId: string): Promise<void> {
  await clickupApi(`/webhook/${webhookId}`, token, { method: 'DELETE' });
}

// Store webhook ID in config
export async function saveWebhookId(webhookId: string | null): Promise<void> {
  const { error } = await supabase
    .from('wf_clickup_config')
    .update({ webhook_id: webhookId, updated_at: new Date().toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}

// Update auto-sync schedule via Postgres RPC
export async function updateAutoSyncSchedule(times: string[], enabled: boolean): Promise<any> {
  const { data, error } = await supabase.rpc('update_clickup_sync_schedule', {
    p_times: times,
    p_enabled: enabled,
  });
  if (error) throw error;
  return data;
}
