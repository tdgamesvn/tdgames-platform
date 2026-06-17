import { supabase } from '@/services/supabaseClient';

// ── Types ───────────────────────────────────────────────────────
export interface AiAgent {
  id: string;
  name: string;
  avatar_emoji: string;
  role_title: string;
  personality: string;
  model: string;
  temperature: number;
  is_active: boolean;
  created_at: string;
}

export interface AiInsight {
  id: string;
  agent_id: string;
  run_id: string | null;
  type: 'info' | 'warning' | 'action_required';
  priority: number;
  title: string;
  body: string;
  suggested_action: string | null;
  status: 'new' | 'reviewed' | 'dismissed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AiRun {
  id: string;
  agent_id: string;
  status: 'running' | 'completed' | 'failed';
  trigger_type: 'cron' | 'manual' | 'chat';
  summary: string | null;
  insights_created: number;
  episodes_created: number;
  tokens_input: number;
  tokens_output: number;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AiEpisode {
  id: string;
  agent_id: string;
  event_type: string;
  summary: string;
  importance: number;
  created_at: string;
}

// ── Fetch all agents ────────────────────────────────────────────
export async function fetchAllAgents(): Promise<AiAgent[]> {
  const { data, error } = await supabase
    .from('ai_agents')
    .select('*')
    .order('created_at');
  if (error) { console.error('fetchAllAgents:', error); return []; }
  return data || [];
}

// ── Fetch agent profile ─────────────────────────────────────────
export async function fetchAgent(agentId: string = 'chro'): Promise<AiAgent | null> {
  const { data, error } = await supabase
    .from('ai_agents')
    .select('*')
    .eq('id', agentId)
    .single();
  if (error) { console.error('fetchAgent:', error); return null; }
  return data;
}

// ── Fetch insights ──────────────────────────────────────────────
export async function fetchInsights(
  agentId: string = 'chro',
  opts?: { status?: string; limit?: number },
): Promise<AiInsight[]> {
  let q = supabase
    .from('ai_agent_insights')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });
  if (opts?.status) q = q.eq('status', opts.status);
  const { data, error } = await q.limit(opts?.limit || 50);
  if (error) { console.error('fetchInsights:', error); return []; }
  return data || [];
}

// ── Fetch runs ──────────────────────────────────────────────────
export async function fetchRuns(
  agentId: string = 'chro',
  limit: number = 20,
): Promise<AiRun[]> {
  const { data, error } = await supabase
    .from('ai_agent_runs')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('fetchRuns:', error); return []; }
  return data || [];
}

// ── Fetch episodes (memory) ─────────────────────────────────────
export async function fetchEpisodes(
  agentId: string = 'chro',
  limit: number = 15,
): Promise<AiEpisode[]> {
  const { data, error } = await supabase
    .from('ai_agent_episodes')
    .select('id, agent_id, event_type, summary, importance, created_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('fetchEpisodes:', error); return []; }
  return data || [];
}

// ── Update insight status ───────────────────────────────────────
export async function updateInsightStatus(
  insightId: string,
  status: 'reviewed' | 'dismissed',
  userId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('ai_agent_insights')
    .update({ status, reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq('id', insightId);
  if (error) { console.error('updateInsightStatus:', error); return false; }
  return true;
}

// ── Trigger manual run ──────────────────────────────────────────
export async function triggerManualRun(
  agentId: string = 'chro',
  message?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL || 'https://fifuhkupaqcfjwyouwpa.supabase.co'}/functions/v1/agent-run`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({
        agent_id: agentId,
        trigger_type: 'manual',
        ...(message ? { message } : {}),
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    return { ok: false, error: err };
  }
  return { ok: true };
}

// ── Conversation types ─────────────────────────────────────────
export interface AiConversation {
  id: string;
  agent_id: string;
  channel: 'app' | 'telegram';
  role: 'user' | 'assistant';
  content: string;
  tokens_used: number;
  created_at: string;
}

// ── Fetch conversation history ─────────────────────────────────
export async function fetchConversations(
  agentId: string = 'chro',
  limit: number = 50,
): Promise<AiConversation[]> {
  const { data, error } = await supabase
    .from('ai_agent_conversations')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) { console.error('fetchConversations:', error); return []; }
  return data || [];
}

// ── Send a chat message to an agent ────────────────────────────
export async function sendChatMessage(
  agentId: string,
  message: string,
): Promise<{ ok: boolean; reply?: string; error?: string }> {
  // Save user message to conversations
  await supabase.from('ai_agent_conversations').insert({
    agent_id: agentId,
    channel: 'app',
    role: 'user',
    content: message,
    tokens_used: 0,
  });

  // Call agent-run with chat trigger
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL || 'https://fifuhkupaqcfjwyouwpa.supabase.co'}/functions/v1/agent-run`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({
        agent_id: agentId,
        trigger_type: 'chat',
        message,
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    return { ok: false, error: err };
  }

  const result = await res.json();

  // Save assistant response
  if (result.summary) {
    await supabase.from('ai_agent_conversations').insert({
      agent_id: agentId,
      channel: 'app',
      role: 'assistant',
      content: result.summary,
      tokens_used: 0,
    });
  }

  return { ok: true, reply: result.summary };
}

// ── Stats helper ────────────────────────────────────────────────
export interface AgentStats {
  totalRuns: number;
  completedRuns: number;
  totalInsights: number;
  newInsights: number;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  avgDurationMs: number | null;
}

export async function fetchAgentStats(agentId: string = 'chro'): Promise<AgentStats> {
  const [runs, insights] = await Promise.all([
    fetchRuns(agentId, 100),
    fetchInsights(agentId, { limit: 200 }),
  ]);

  const completed = runs.filter(r => r.status === 'completed');
  const avgDur = completed.length > 0
    ? completed.reduce((s, r) => s + (r.duration_ms || 0), 0) / completed.length
    : null;

  return {
    totalRuns: runs.length,
    completedRuns: completed.length,
    totalInsights: insights.length,
    newInsights: insights.filter(i => i.status === 'new').length,
    lastRunAt: runs[0]?.created_at || null,
    lastRunStatus: runs[0]?.status || null,
    avgDurationMs: avgDur,
  };
}
