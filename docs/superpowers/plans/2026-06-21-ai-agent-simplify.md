# AI Agent Simplify & Unified Feed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deactivate 6 non-core AI agents, prevent duplicate insights in the Edge Function, and add a unified Feed view as the default landing screen.

**Architecture:** DB migration deactivates 6 agents (keeping CHRO/CFO/CTO/BD). The Edge Function gains a 24h dedup check before inserting insights. The frontend adds `fetchAllInsights()`, a new `FeedPanel` component, and wires `isFeedView` state into `AiAgentApp` so Feed is the default landing.

**Tech Stack:** React 19 + TypeScript (Vite SPA), Supabase (Postgres + Edge Functions/Deno), Tailwind CSS utility classes, Supabase MCP for DB + deploy.

## Global Constraints

- Dark theme: background `#0F0F0F`, brand orange `#FF9500`
- All text in Vietnamese
- No new npm dependencies
- `npm run build` must pass with zero TypeScript errors after each frontend task
- All file paths relative to `/Users/tdgames_mac01/Work/apps/tdgames-platforms`

---

### Task 1: DB Migration — Deactivate 6 agents

**Files:**
- No local file — applied via Supabase MCP `apply_migration`

**Interfaces:**
- Produces: `ai_agents` table has `is_active = false` for `ceo, pm, sales, ops, data, support`

- [ ] **Step 1: Apply migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with:
```sql
-- Deactivate non-core agents; keep chro, cfo, cto, bd
UPDATE ai_agents
SET is_active = false
WHERE id IN ('ceo', 'pm', 'sales', 'ops', 'data', 'support');
```
Migration name: `deactivate_non_core_agents`

- [ ] **Step 2: Verify via SQL**

Use `mcp__supabase__execute_sql`:
```sql
SELECT id, name, is_active FROM ai_agents ORDER BY created_at;
```
Expected: 4 rows with `is_active = true` (chro, cfo, cto, bd), 6 rows with `is_active = false`.

- [ ] **Step 3: Commit note**

No local file to commit — migration is live. Note in git:
```bash
git commit --allow-empty -m "chore: deactivate ceo/pm/sales/ops/data/support agents via DB migration"
```

---

### Task 2: Edge Function — Insight Dedup Fix

**Files:**
- Modify: `supabase/functions/agent-run/index.ts` (lines 292–300, `case 'create_insight':`)

**Interfaces:**
- Consumes: existing `executeTool(supabase, toolName, args, runId, agentId)` signature — unchanged
- Produces: `create_insight` now returns `{ skipped: true, reason: string, existing_id: string }` when duplicate found within 24h, otherwise unchanged `{ success: true, insight_id: string }`

- [ ] **Step 1: Edit `case 'create_insight':` in `executeTool()`**

Find this block (around line 292):
```typescript
      case 'create_insight': {
        const { data, error } = await supabase.from('ai_agent_insights').insert({
          agent_id: agentId, run_id: runId,
          type: args.type, priority: args.priority || 5,
          title: args.title, body: args.body,
          suggested_action: args.suggested_action || null,
        }).select('id').single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, insight_id: data.id });
      }
```

Replace with:
```typescript
      case 'create_insight': {
        // Dedup: skip if same agent + same title already exists in last 24h
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: existing } = await supabase
          .from('ai_agent_insights')
          .select('id')
          .eq('agent_id', agentId)
          .eq('title', args.title)
          .gte('created_at', since24h)
          .limit(1);
        if (existing && existing.length > 0) {
          return JSON.stringify({ skipped: true, reason: 'duplicate in 24h', existing_id: existing[0].id });
        }
        const { data, error } = await supabase.from('ai_agent_insights').insert({
          agent_id: agentId, run_id: runId,
          type: args.type, priority: args.priority || 5,
          title: args.title, body: args.body,
          suggested_action: args.suggested_action || null,
        }).select('id').single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, insight_id: data.id });
      }
```

- [ ] **Step 2: Deploy Edge Function via Supabase MCP**

Use `mcp__supabase__deploy_edge_function` with:
- function_name: `agent-run`
- Read the full updated file content from `supabase/functions/agent-run/index.ts` and pass as `entrypoint_path`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/agent-run/index.ts
git commit -m "fix(agent-run): skip duplicate insight if same title+agent within 24h"
```

---

### Task 3: Service Layer — fetchAllInsights + active-only filter

**Files:**
- Modify: `apps/ai-agent/services/aiAgentService.ts`

**Interfaces:**
- Produces:
  - `fetchAllAgents(): Promise<AiAgent[]>` — same signature, now filters `is_active = true`
  - `fetchAllInsights(opts?: { status?: string; limit?: number }): Promise<AiInsight[]>` — new export

- [ ] **Step 1: Add `is_active` filter to `fetchAllAgents()`**

Find:
```typescript
export async function fetchAllAgents(): Promise<AiAgent[]> {
  const { data, error } = await supabase
    .from('ai_agents')
    .select('*')
    .order('created_at');
  if (error) { console.error('fetchAllAgents:', error); return []; }
  return data || [];
}
```

Replace with:
```typescript
export async function fetchAllAgents(): Promise<AiAgent[]> {
  const { data, error } = await supabase
    .from('ai_agents')
    .select('*')
    .eq('is_active', true)
    .order('created_at');
  if (error) { console.error('fetchAllAgents:', error); return []; }
  return data || [];
}
```

- [ ] **Step 2: Add `fetchAllInsights()` after `fetchInsights()`**

Insert after the `fetchInsights` function (around line 91):
```typescript
// ── Fetch insights across all active agents ─────────────────────
export async function fetchAllInsights(
  opts?: { status?: string; limit?: number },
): Promise<AiInsight[]> {
  let q = supabase
    .from('ai_agent_insights')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
  if (opts?.status) q = q.eq('status', opts.status);
  const { data, error } = await q.limit(opts?.limit || 100);
  if (error) { console.error('fetchAllInsights:', error); return []; }
  return data || [];
}
```

- [ ] **Step 3: Build check**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
```
Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/ai-agent/services/aiAgentService.ts
git commit -m "feat(ai-agent): add fetchAllInsights, filter fetchAllAgents to active only"
```

---

### Task 4: FeedPanel — New Component

**Files:**
- Create: `apps/ai-agent/components/FeedPanel.tsx`

**Interfaces:**
- Consumes:
  - `AiInsight` from `'../services/aiAgentService'`
  - `AiAgent` from `'../services/aiAgentService'`
  - `TYPE_CONFIG`, `STATUS_CONFIG`, `fmtDate` from `'../utils'`
- Produces: `export default FeedPanel` with props:
  ```typescript
  interface FeedPanelProps {
    insights: AiInsight[];
    allAgents: AiAgent[];
    onAction: (id: string, action: 'reviewed' | 'dismissed') => void;
  }
  ```

- [ ] **Step 1: Create `FeedPanel.tsx`**

Create `/Users/tdgames_mac01/Work/apps/tdgames-platforms/apps/ai-agent/components/FeedPanel.tsx`:

```typescript
// apps/ai-agent/components/FeedPanel.tsx
import React, { useState, useEffect } from 'react';
import { AiInsight, AiAgent } from '../services/aiAgentService';
import { TYPE_CONFIG, STATUS_CONFIG, fmtDate } from '../utils';

const BODY_TRUNCATE = 150;
const ITEMS_PER_PAGE = 10;

interface FeedPanelProps {
  insights: AiInsight[];
  allAgents: AiAgent[];
  onAction: (id: string, action: 'reviewed' | 'dismissed') => void;
}

// Per-agent badge colors — distinct from type colors
const AGENT_BADGE: Record<string, { emoji: string; label: string; color: string }> = {
  chro: { emoji: '👥', label: 'CHRO', color: '#4CAF50' },
  cfo:  { emoji: '💰', label: 'CFO',  color: '#2196F3' },
  cto:  { emoji: '⚙️', label: 'CTO',  color: '#9C27B0' },
  bd:   { emoji: '🚀', label: 'BD',   color: '#FF9500' },
};

const FeedPanel: React.FC<FeedPanelProps> = ({ insights, allAgents, onAction }) => {
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'action_required'>('all');
  const [agentFilter, setAgentFilter]   = useState<string>('all');
  const [currentPage, setCurrentPage]   = useState(1);

  // Reset page whenever a filter changes
  useEffect(() => { setCurrentPage(1); }, [statusFilter, agentFilter]);

  const filtered = insights.filter(i => {
    if (statusFilter === 'new' && i.status !== 'new') return false;
    if (statusFilter === 'action_required' && i.type !== 'action_required') return false;
    if (agentFilter !== 'all' && i.agent_id !== agentFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (insights.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-2xl mb-3">📋</p>
        <p className="text-neutral-500 text-sm font-semibold mb-1">Chưa có insights nào</p>
        <p className="text-xs text-neutral-700">Chọn một agent và chạy phân tích để bắt đầu</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: 'all' as const,             label: 'Tất cả' },
          { key: 'new' as const,             label: 'Chưa xem' },
          { key: 'action_required' as const, label: 'Cần xử lý' },
        ]).map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              statusFilter === f.key
                ? 'text-white bg-primary/20 border border-primary/30'
                : 'text-neutral-400 border border-white/10 hover:text-white hover:border-white/20'
            }`}>
            {f.label}
          </button>
        ))}
        <div className="ml-auto">
          <select
            value={agentFilter}
            onChange={e => { setAgentFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 outline-none transition-colors"
            style={{ background: '#1a1a1a' }}
          >
            <option value="all">Tất cả agent</option>
            {allAgents.map(a => (
              <option key={a.id} value={a.id}>
                {a.avatar_emoji} {a.name.replace('Agent ', '')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Count line */}
      <p className="text-[10px] font-semibold text-neutral-600">
        {filtered.length} insight{filtered.length !== 1 ? 's' : ''} · sắp xếp theo độ ưu tiên
      </p>

      {/* ── List ── */}
      {paginated.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-600 text-sm">Không có insights phù hợp với bộ lọc</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginated.map(insight => {
            const typeConf   = TYPE_CONFIG[insight.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.info;
            const statusConf = STATUS_CONFIG[insight.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.new;
            const agentBadge = AGENT_BADGE[insight.agent_id];
            const isExpanded     = expandedId === insight.id;
            const bodyIsLong     = insight.body.length > BODY_TRUNCATE;
            const hasSuggestedAction = !!insight.suggested_action;
            const canExpand      = bodyIsLong || hasSuggestedAction;

            return (
              <div key={insight.id}
                className="rounded-2xl border overflow-hidden transition-all hover:border-white/15"
                style={{
                  background:  insight.status === 'new' ? 'rgba(255,149,0,0.025)' : 'rgba(255,255,255,0.02)',
                  borderColor: insight.status === 'new' ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.08)',
                }}>
                <div className="flex">
                  {/* Left color stripe */}
                  <div className="w-[3px] shrink-0 rounded-l-2xl"
                    style={{ background: `linear-gradient(180deg, ${typeConf.color}, ${typeConf.color}44)` }} />

                  <div className="flex-1 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">

                        {/* Badges row */}
                        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                          {/* Agent source badge */}
                          {agentBadge && (
                            <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg tracking-wider"
                              style={{ background: `${agentBadge.color}15`, color: agentBadge.color, border: `1px solid ${agentBadge.color}30` }}>
                              {agentBadge.emoji} {agentBadge.label}
                            </span>
                          )}
                          {/* Type badge */}
                          <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg tracking-wider"
                            style={{ background: `${typeConf.color}18`, color: typeConf.color, border: `1px solid ${typeConf.color}30` }}>
                            {typeConf.icon} {typeConf.label}
                          </span>
                          {/* Status badge */}
                          <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg tracking-wider"
                            style={{ background: `${statusConf.color}15`, color: statusConf.color }}>
                            {statusConf.label}
                          </span>
                          <span className="text-[9px] font-bold text-neutral-700 ml-auto">P{insight.priority}</span>
                        </div>

                        {/* Title + body */}
                        <div className={canExpand ? 'cursor-pointer' : ''}
                          onClick={() => { if (canExpand) setExpandedId(prev => prev === insight.id ? null : insight.id); }}>
                          <h3 className="text-sm font-black text-white mb-1.5 leading-snug">{insight.title}</h3>
                          <p className="text-xs text-neutral-medium leading-relaxed">
                            {!isExpanded && bodyIsLong ? insight.body.slice(0, BODY_TRUNCATE) + '...' : insight.body}
                          </p>
                          {canExpand && !isExpanded && (
                            <span className="text-[10px] text-primary/70 mt-1.5 inline-block font-semibold">Xem thêm →</span>
                          )}
                        </div>

                        {/* Suggested action (expanded only) */}
                        {isExpanded && insight.suggested_action && (
                          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs border"
                            style={{ background: 'rgba(255,149,0,0.06)', borderColor: 'rgba(255,149,0,0.15)' }}>
                            <span className="text-primary shrink-0 mt-0.5">→</span>
                            <span className="text-primary/80 leading-relaxed">
                              <span className="font-black text-primary">Gợi ý: </span>
                              {insight.suggested_action}
                            </span>
                          </div>
                        )}

                        <p className="text-[10px] text-neutral-700 mt-2.5 font-medium">{fmtDate(insight.created_at)}</p>
                      </div>

                      {/* Mark-reviewed button */}
                      {insight.status === 'new' && (
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            onClick={() => onAction(insight.id, 'reviewed')}
                            title="Đánh dấu đã xem"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-green-400 border border-green-500/25 hover:bg-green-500/12 transition-all"
                          >
                            ✓
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}
            className="px-2 py-1 rounded-lg text-xs text-neutral-400 border border-white/10 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            ←
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button key={page} onClick={() => setCurrentPage(page)}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                currentPage === page
                  ? 'text-white bg-primary/20 border border-primary/30'
                  : 'text-neutral-400 border border-white/10 hover:text-white hover:border-white/20'
              }`}>
              {page}
            </button>
          ))}
          <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}
            className="px-2 py-1 rounded-lg text-xs text-neutral-400 border border-white/10 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            →
          </button>
        </div>
      )}
    </div>
  );
};

export default FeedPanel;
```

- [ ] **Step 2: Build check**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
```
Expected: exits 0. TypeScript will catch any import mismatches.

- [ ] **Step 3: Commit**

```bash
git add apps/ai-agent/components/FeedPanel.tsx
git commit -m "feat(ai-agent): add FeedPanel component with agent badges + filters"
```

---

### Task 5: AgentSidebar — Feed Entry

**Files:**
- Modify: `apps/ai-agent/components/AgentSidebar.tsx`

**Interfaces:**
- Consumes: new props from Task 6's AiAgentApp
- Produces updated `AgentSidebarProps`:
  ```typescript
  interface AgentSidebarProps {
    agents: AiAgent[];
    selectedAgentId: string;
    onSelectAgent: (id: string) => void;
    isFeedView: boolean;       // NEW
    onSelectFeed: () => void;  // NEW
  }
  ```

- [ ] **Step 1: Update props interface**

Find:
```typescript
interface AgentSidebarProps {
  agents: AiAgent[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
}
```

Replace with:
```typescript
interface AgentSidebarProps {
  agents: AiAgent[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  isFeedView: boolean;
  onSelectFeed: () => void;
}
```

- [ ] **Step 2: Destructure new props in component**

Find:
```typescript
const AgentSidebar: React.FC<AgentSidebarProps> = ({ agents, selectedAgentId, onSelectAgent }) => {
```

Replace with:
```typescript
const AgentSidebar: React.FC<AgentSidebarProps> = ({ agents, selectedAgentId, onSelectAgent, isFeedView, onSelectFeed }) => {
```

- [ ] **Step 3: Add Feed entry + separator inside the agent list div**

Find:
```typescript
      {/* Agent list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {agents.map(a => {
```

Replace with:
```typescript
      {/* Agent list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {/* Feed — always first */}
        <button
          onClick={onSelectFeed}
          title={collapsed ? 'Feed' : undefined}
          className={`w-full flex items-center transition-all rounded-xl overflow-hidden ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-2'}`}
          style={isFeedView
            ? { background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.25)', boxShadow: '0 2px 12px rgba(255,149,0,0.1)' }
            : { background: 'transparent', border: '1px solid transparent' }
          }
        >
          <span className={`shrink-0 transition-all ${collapsed ? 'text-xl' : 'text-base'} ${isFeedView ? 'drop-shadow-[0_0_6px_rgba(255,149,0,0.5)]' : ''}`}>
            📋
          </span>
          {!collapsed && (
            <span className={`text-xs truncate flex-1 text-left ${isFeedView ? 'text-white font-black' : 'text-neutral-500 font-semibold hover:text-neutral-300'}`}>
              Feed
            </span>
          )}
        </button>

        {/* Separator between Feed and agents */}
        <div className="border-t border-white/5 my-1" />

        {agents.map(a => {
```

- [ ] **Step 4: Build check**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
```
Expected: TypeScript error about missing `isFeedView`/`onSelectFeed` props at the call-site in `AiAgentApp.tsx`. This is expected — Task 6 fixes it.

Actually — to keep the build green, you can temporarily pass `isFeedView={false}` and `onSelectFeed={() => {}}` in `AiAgentApp.tsx` as a stub. OR skip the build check here and verify after Task 6. **Recommended: skip build check here, do it after Task 6.**

- [ ] **Step 5: Commit**

```bash
git add apps/ai-agent/components/AgentSidebar.tsx
git commit -m "feat(ai-agent): add Feed entry to AgentSidebar with isFeedView prop"
```

---

### Task 6: AiAgentApp — Wire FeedPanel & isFeedView

**Files:**
- Modify: `apps/ai-agent/components/AiAgentApp.tsx`

**Interfaces:**
- Consumes:
  - `fetchAllInsights` from `'../services/aiAgentService'` (Task 3)
  - `FeedPanel` from `'./FeedPanel'` (Task 4)
  - Updated `AgentSidebar` with `isFeedView` + `onSelectFeed` props (Task 5)

- [ ] **Step 1: Update imports at top of AiAgentApp.tsx**

Find:
```typescript
import {
  fetchAgent, fetchAllAgents, fetchInsights, fetchRuns, fetchEpisodes,
  fetchAgentStats, fetchConversations, updateInsightStatus, triggerManualRun,
  AiAgent, AiInsight, AiRun, AiEpisode, AiConversation, AgentStats,
} from '../services/aiAgentService';
```

Replace with:
```typescript
import {
  fetchAgent, fetchAllAgents, fetchInsights, fetchRuns, fetchEpisodes,
  fetchAgentStats, fetchConversations, updateInsightStatus, triggerManualRun,
  fetchAllInsights,
  AiAgent, AiInsight, AiRun, AiEpisode, AiConversation, AgentStats,
} from '../services/aiAgentService';
```

Also add after the existing component imports:
```typescript
import FeedPanel from './FeedPanel';
```

- [ ] **Step 2: Add isFeedView and feedInsights state**

Find (the state declarations block, after `const [loading, ...`):
```typescript
  const [loading, setLoading]               = useState(true);
  const [agentSwitching, setAgentSwitching] = useState(false);
```

Insert after `const [, setTick] ...` line:
```typescript
  const [isFeedView, setIsFeedView]         = useState(true);
  const [feedInsights, setFeedInsights]     = useState<AiInsight[]>([]);
```

- [ ] **Step 3: Replace the `load` callback**

Find and replace the entire `load` function:
```typescript
  const load = useCallback(async (silent = false) => {
    if (!silent) {
      if (isFirstLoad.current) setLoading(true); else setAgentSwitching(true);
    }
    const [agents, ag, st, ins, rns, eps, convs] = await Promise.all([
      fetchAllAgents(), fetchAgent(selectedAgentId), fetchAgentStats(selectedAgentId),
      fetchInsights(selectedAgentId), fetchRuns(selectedAgentId),
      fetchEpisodes(selectedAgentId), fetchConversations(selectedAgentId),
    ]);
    setAllAgents(agents); setAgent(ag); setStats(st);
    setInsights(ins); setRuns(rns); setEpisodes(eps); setConversations(convs);
    setLastUpdatedAt(Date.now());
    isFirstLoad.current = false;
    setLoading(false); setAgentSwitching(false);
  }, [selectedAgentId]);
```

Replace with:
```typescript
  const load = useCallback(async (silent = false) => {
    if (!silent) {
      if (isFirstLoad.current) setLoading(true); else setAgentSwitching(true);
    }
    const agents = await fetchAllAgents();
    setAllAgents(agents);

    if (isFeedView) {
      const allIns = await fetchAllInsights();
      setFeedInsights(allIns);
    } else {
      const [ag, st, ins, rns, eps, convs] = await Promise.all([
        fetchAgent(selectedAgentId), fetchAgentStats(selectedAgentId),
        fetchInsights(selectedAgentId), fetchRuns(selectedAgentId),
        fetchEpisodes(selectedAgentId), fetchConversations(selectedAgentId),
      ]);
      setAgent(ag); setStats(st);
      setInsights(ins); setRuns(rns); setEpisodes(eps); setConversations(convs);
    }

    setLastUpdatedAt(Date.now());
    isFirstLoad.current = false;
    setLoading(false); setAgentSwitching(false);
  }, [selectedAgentId, isFeedView]);
```

- [ ] **Step 4: Add switchToFeed and update switchAgent**

Find:
```typescript
  const switchAgent = (id: string) => {
    setSelectedAgentId(id);
    setInsightFilter('all');
  };
```

Replace with:
```typescript
  const switchToFeed = () => {
    setIsFeedView(true);
    setInsightFilter('all');
  };

  const switchAgent = (id: string) => {
    setIsFeedView(false);
    setSelectedAgentId(id);
    setInsightFilter('all');
  };
```

- [ ] **Step 5: Update handleInsightAction to also update feedInsights**

Find:
```typescript
  const handleInsightAction = async (id: string, action: 'reviewed' | 'dismissed') => {
    const ok = await updateInsightStatus(id, action, currentUser.id);
    if (ok) {
      setInsights(prev => prev.map(i => i.id === id ? { ...i, status: action } : i));
      setToast({ msg: action === 'reviewed' ? 'Đã đánh dấu xem xét' : 'Đã bỏ qua', type: 'success' });
    }
  };
```

Replace with:
```typescript
  const handleInsightAction = async (id: string, action: 'reviewed' | 'dismissed') => {
    const ok = await updateInsightStatus(id, action, currentUser.id);
    if (ok) {
      setInsights(prev => prev.map(i => i.id === id ? { ...i, status: action } : i));
      setFeedInsights(prev => prev.map(i => i.id === id ? { ...i, status: action } : i));
      setToast({ msg: action === 'reviewed' ? 'Đã đánh dấu xem xét' : 'Đã bỏ qua', type: 'success' });
    }
  };
```

- [ ] **Step 6: Update AgentSidebar usage in JSX**

Find:
```typescript
        <AgentSidebar
          agents={allAgents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={switchAgent}
        />
```

Replace with:
```typescript
        <AgentSidebar
          agents={allAgents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={switchAgent}
          isFeedView={isFeedView}
          onSelectFeed={switchToFeed}
        />
```

- [ ] **Step 7: Add Feed pill to mobile horizontal bar**

Find:
```typescript
          {allAgents.map(a => {
            const isActive = a.id === selectedAgentId;
            return (
              <button
                key={a.id}
                onClick={() => switchAgent(a.id)}
```

Insert this Feed pill just before the `{allAgents.map(...)}` block:
```typescript
          {/* Feed pill — first in mobile bar */}
          <button
            onClick={switchToFeed}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0 transition-all"
            style={isFeedView
              ? { background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.3)' }
              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }
            }
          >
            <span className="text-base">📋</span>
            <span className={`text-[11px] font-semibold whitespace-nowrap ${isFeedView ? 'text-white' : 'text-neutral-400'}`}>
              Feed
            </span>
          </button>
          {allAgents.map(a => {
            const isActive = a.id === selectedAgentId;
            return (
              <button
                key={a.id}
                onClick={() => switchAgent(a.id)}
```

- [ ] **Step 8: Replace main content area with conditional FeedPanel / per-agent view**

Find the main scrollable content section (the `<main>` element) and locate the area after the loading spinner ends and `<>` begins:

Find this block (it starts after the loading spinner):
```typescript
            <>
              {/* ═══ AgentHeader — Hero Card ═══ */}
              <div className="rounded-2xl overflow-hidden"
```

Replace everything from `<>` through the closing `</>` of that block with:
```typescript
            <>
              {isFeedView ? (
                /* ═══ Unified Feed ═══ */
                <FeedPanel
                  insights={feedInsights}
                  allAgents={allAgents}
                  onAction={handleInsightAction}
                />
              ) : (
                <>
                  {/* ═══ AgentHeader — Hero Card ═══ */}
                  <div className="rounded-2xl overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, rgba(255,149,0,0.07) 0%, rgba(255,255,255,0.02) 55%)', border: '1px solid rgba(255,149,0,0.18)' }}>
                    {/* Orange top accent line */}
                    <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #FF9500 0%, rgba(255,149,0,0.2) 60%, transparent 100%)' }} />
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {/* Avatar with glow */}
                        <div className="relative shrink-0">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                            style={{ background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.3)', boxShadow: '0 0 24px rgba(255,149,0,0.18)' }}>
                            {agent?.avatar_emoji || '🤖'}
                          </div>
                          {agent?.is_active && (
                            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 border-2 animate-pulse"
                              style={{ borderColor: '#0F0F0F', boxShadow: '0 0 8px rgba(76,175,80,0.7)' }} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-lg font-black text-white tracking-tight">{agent?.name || 'AI Agent'}</h1>
                            {agent?.is_active && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg tracking-wider"
                                style={{ background: 'rgba(76,175,80,0.15)', color: '#4CAF50', border: '1px solid rgba(76,175,80,0.2)' }}>
                                ● Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-medium">
                            {agent?.role_title || 'AI Assistant'}
                            <span className="mx-1.5 text-white/20">•</span>
                            <span className="font-mono text-[11px] text-white/40">{agent?.model}</span>
                          </p>
                          {agent?.personality && (
                            <p className="text-[11px] text-neutral-600 mt-1 line-clamp-1 max-w-md leading-relaxed">{agent.personality}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] font-semibold text-neutral-700 hidden sm:block">
                          sync {timeAgoShort(lastUpdatedAt)}
                        </span>
                        <button
                          onClick={handleTrigger}
                          disabled={triggerLoading}
                          className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #FF9500, #FF6B00)', boxShadow: triggerLoading ? 'none' : '0 4px 16px rgba(255,149,0,0.35)' }}
                        >
                          {triggerLoading ? '⟳ Đang chạy...' : '▶ Chạy phân tích'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Agent switching spinner */}
                  {agentSwitching ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <span className="ml-3 text-xs text-neutral-medium">Đang tải dữ liệu agent...</span>
                    </div>
                  ) : (
                    <>
                      {/* ═══ KPI Strip ═══ */}
                      {stats && !hasNoData && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          {[
                            {
                              label: 'Tổng lần chạy', icon: '▶', iconColor: '#2196F3',
                              value: stats.totalRuns, sub: `${stats.completedRuns} thành công`,
                              delta: runsDelta !== null ? `${runsDelta >= 0 ? '↑' : '↓'}${Math.abs(runsDelta)}% so với tuần trước` : '—',
                              deltaPos: runsDelta !== null ? runsDelta >= 0 : null,
                            },
                            {
                              label: 'Insights tạo', icon: '💡', iconColor: '#FF9500',
                              value: stats.totalInsights, sub: undefined,
                              delta: '—', deltaPos: null,
                            },
                            {
                              label: 'Chưa xem', icon: '👁', iconColor: stats.newInsights > 0 ? '#F44336' : '#4CAF50',
                              value: stats.newInsights, sub: undefined,
                              delta: stats.newInsights > 0 ? 'Cần xem xét' : 'Không có mới',
                              deltaPos: stats.newInsights === 0,
                            },
                            {
                              label: 'Lần chạy cuối', icon: '🕐', iconColor: '#4CAF50',
                              value: stats.lastRunAt ? timeAgo(stats.lastRunAt) : '—',
                              sub: undefined, isText: true, delta: undefined, deltaPos: null,
                            },
                            {
                              label: 'TB thời gian', icon: '⚡', iconColor: '#AF52DE',
                              value: fmtDuration(stats.avgDurationMs),
                              sub: undefined, isText: true, delta: undefined, deltaPos: null,
                            },
                          ].map((kpi, i) => (
                            <div key={i} className="rounded-2xl border border-white/8 overflow-hidden"
                              style={{ background: 'rgba(255,255,255,0.025)' }}>
                              <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${kpi.iconColor}, transparent)` }} />
                              <div className="p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{kpi.label}</p>
                                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0"
                                    style={{ background: `${kpi.iconColor}18` }}>
                                    <span>{kpi.icon}</span>
                                  </div>
                                </div>
                                <p className={`${kpi.isText ? 'text-base' : 'text-[26px] leading-none'} font-black text-white`}>{kpi.value}</p>
                                {kpi.sub && <p className="text-[10px] text-neutral-600">{kpi.sub}</p>}
                                {kpi.delta !== undefined && (
                                  <p className={`text-[10px] font-semibold ${kpi.deltaPos === true ? 'text-green-400' : kpi.deltaPos === false ? 'text-red-400' : 'text-neutral-600'}`}>
                                    {kpi.delta}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ═══ Tab content ═══ */}
                      {activeTab === 'insights' && (
                        <InsightsPanel
                          key={selectedAgentId}
                          insights={filteredInsights}
                          filter={insightFilter}
                          onFilterChange={setInsightFilter}
                          onAction={handleInsightAction}
                          agentEmoji={agent?.avatar_emoji || AGENT_EMPTY_STATE[selectedAgentId]?.emoji || '🤖'}
                          agentName={agent?.name || 'Agent'}
                          onTrigger={handleTrigger}
                          triggerLoading={triggerLoading}
                          hasNoData={hasNoData}
                        />
                      )}
                      {activeTab === 'runs' && (
                        <RunsPanel
                          runs={runs}
                          agentEmoji={agent?.avatar_emoji || AGENT_EMPTY_STATE[selectedAgentId]?.emoji || '🤖'}
                          agentName={agent?.name || 'Agent'}
                          onTrigger={handleTrigger}
                          triggerLoading={triggerLoading}
                        />
                      )}
                      {activeTab === 'memory' && <MemoryPanel episodes={episodes} />}
                      {activeTab === 'chat' && (
                        <ChatPanel
                          conversations={conversations}
                          setConversations={setConversations}
                          agentId={selectedAgentId}
                          agentEmoji={agent?.avatar_emoji || AGENT_EMPTY_STATE[selectedAgentId]?.emoji || '🤖'}
                          agentName={agent?.name || 'Agent'}
                        />
                      )}
                      {activeTab === 'config' && agent && (
                        <ConfigPanel
                          agent={agent}
                          onSaved={(updated) => {
                            setAgent(updated);
                            setToast({ msg: 'Đã lưu cấu hình agent', type: 'success' });
                          }}
                          onError={() => setToast({ msg: 'Lưu thất bại, thử lại', type: 'error' })}
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </>
```

- [ ] **Step 9: Build check**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
```
Expected: exits 0, zero TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add apps/ai-agent/components/AiAgentApp.tsx
git commit -m "feat(ai-agent): add unified Feed as default view, wire FeedPanel + isFeedView state"
```

---

### Task 7: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Full build passes**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
```
Expected: `✓ built in X.XXs`, zero errors.

- [ ] **Step 2: Manual smoke test checklist**

Start dev server:
```bash
npm run dev
```
Open `http://localhost:3000`, navigate to AI Agent app. Verify:

1. **Sidebar shows 4 agents + Feed entry** — CHRO, CFO, CTO, BD only; no CEO/PM/Sales/Ops/Data/Support
2. **Default landing is Feed** — Feed entry is highlighted orange, FeedPanel renders in main area
3. **Agent badge on Feed cards** — each insight card shows colored agent badge (👥 CHRO / 💰 CFO / ⚙️ CTO / 🚀 BD)
4. **Agent filter dropdown works** — selecting "CHRO" shows only CHRO insights
5. **Status filter works** — "Cần xử lý" shows only `action_required` type
6. **Click agent in sidebar** — loads per-agent view (AgentHeader + KPI + tabs), Feed entry no longer highlighted
7. **Mark reviewed from Feed** — clicking ✓ on a Feed card updates status optimistically
8. **Mobile bar** — on narrow viewport, Feed pill appears first before CHRO/CFO/CTO/BD pills

- [ ] **Step 3: Update TASKS.md and LOG.md**

Update `.agent/meta/TASKS.md` to mark this task as done.

Append to `.agent/meta/LOG.md`:
```markdown
## 2026-06-21
### Task
AI Agent simplify: deactivate 6 agents, fix insight dedup, add unified Feed view

### Work Done
- DB migration: set is_active=false for ceo/pm/sales/ops/data/support
- Edge Function: added 24h dedup check in create_insight (title+agent_id)
- Service: added fetchAllInsights(), added is_active filter to fetchAllAgents()
- New FeedPanel component with agent badges, status + agent filters, pagination
- AgentSidebar: Feed entry added at top with separator
- AiAgentApp: isFeedView state, switchToFeed(), load() branches for feed/per-agent, mobile Feed pill

### Validation
- npm run build passed
- Manual smoke test: sidebar shows 4 agents, Feed is default, agent badges visible

### Result
- Dashboard lands on unified Feed showing all insights from 4 active agents
- Duplicate insights in same 24h window are skipped at Edge Function level
```

- [ ] **Step 4: Final commit (memory files)**

```bash
git add .agent/meta/TASKS.md .agent/meta/LOG.md
git commit -m "chore: update memory after ai-agent simplify + unified feed"
```

---

## Self-Review

**Spec coverage:**
- ✅ Deactivate 6 agents → Task 1
- ✅ `fetchAllAgents` active-only → Task 3
- ✅ 24h dedup in Edge Function → Task 2
- ✅ `fetchAllInsights()` → Task 3
- ✅ FeedPanel with agent badge + filters → Task 4
- ✅ AgentSidebar Feed entry → Task 5
- ✅ AiAgentApp isFeedView default=true, switchToFeed, load() branching → Task 6
- ✅ Mobile Feed pill → Task 6 Step 7
- ✅ handleInsightAction updates feedInsights → Task 6 Step 5
- ✅ Build verification → Task 7
- ✅ Success criteria all covered

**Placeholder scan:** No TBD, all code blocks complete.

**Type consistency:**
- `FeedPanel` props: `insights: AiInsight[], allAgents: AiAgent[], onAction: (id: string, action: 'reviewed' | 'dismissed') => void` — matches usage in Task 6 Step 8
- `fetchAllInsights()` returns `Promise<AiInsight[]>` — matches `setFeedInsights` type `AiInsight[]`
- `AgentSidebarProps` updated in Task 5, consumed in Task 6 Step 6 — all 5 props present
- `isFeedView` boolean — consistent across Tasks 5 and 6
