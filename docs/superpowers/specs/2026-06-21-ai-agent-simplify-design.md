# AI Agent — Simplify & Unified Feed

_Date: 2026-06-21_
_Status: Approved_

---

## Problem

The AI Agent module currently has 10 agents (CHRO, CFO, CEO, CTO, Sales, PM, Ops, Data, BD, Support). In practice:

- Most agents (CEO, PM, Sales, Ops, Data, Support) have overlapping scopes or no real data to report on yet.
- Each agent run creates new insights without checking for duplicates, so the same finding appears multiple times.
- Insights are siloed per agent — to see everything important you must click through each one.

**Goal:** Keep only the 4 core agents, eliminate duplicate insights, and add a unified feed as the default view.

---

## Scope

Full stack: Database migration + Supabase Edge Function + React frontend.

---

## Design

### Part 1 — Agent Roster (Database)

**Deactivate 6 agents** with a single migration:

```sql
UPDATE ai_agents
SET is_active = false
WHERE id IN ('ceo', 'pm', 'sales', 'ops', 'data', 'support');
```

**4 agents remain active:**

| ID | Name | Domain |
|----|------|--------|
| `chro` | 👥 CHRO | HR, probation, leave, evaluations |
| `cfo` | 💰 CFO | Finance, invoices, expenses, payroll |
| `cto` | ⚙️ CTO | Infrastructure, uptime, AI system health |
| `bd` | 🚀 BD | Business development, outreach, clients |

**`fetchAllAgents()`** in `aiAgentService.ts` adds `.eq('is_active', true)` filter — sidebar and mobile bar show only 4 agents.

The Edge Function already checks `is_active` before running an agent (line 771–775 of `index.ts`), so deactivated agents cannot be triggered via API or cron.

---

### Part 2 — Dedup Fix (Edge Function)

**File:** `supabase/functions/agent-run/index.ts`

**Change:** Inside `executeTool()`, in the `case 'create_insight':` block, add a dedup check before inserting:

```
1. Query ai_agent_insights
   WHERE agent_id = <agentId>
     AND title = <args.title>
     AND created_at > (now - 24h)
   LIMIT 1

2. If a row is found → return { skipped: true, reason: 'duplicate in 24h', existing_id }
   (do NOT insert, do NOT increment insightsCreated)

3. If no row found → proceed with existing insert logic unchanged
```

**Window:** 24 hours — tight enough to catch same-day re-runs, loose enough to allow the same insight to reappear the next day if the issue persists.

**Dedup key:** `agent_id + title`. Title is assumed to be distinct enough per finding. If two different findings have the same title, only the first is kept for 24h — acceptable trade-off.

No other changes to the Edge Function.

---

### Part 3 — Unified Feed UI (Frontend)

#### 3a. New service function

**File:** `apps/ai-agent/services/aiAgentService.ts`

Add `fetchAllInsights()`:

```typescript
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

#### 3b. New component — FeedPanel

**File:** `apps/ai-agent/components/FeedPanel.tsx` (new file)

Renders the unified insights list. Reuses the same card layout as `InsightsPanel` with one addition: an **agent badge** on each card showing which agent created it.

Agent badge mapping (built from `allAgents` prop):
- `chro` → `👥 CHRO`
- `cfo` → `💰 CFO`
- `cto` → `⚙️ CTO`
- `bd` → `🚀 BD`

**Props:**
```typescript
interface FeedPanelProps {
  insights: AiInsight[];
  allAgents: AiAgent[];
  onAction: (id: string, action: 'reviewed' | 'dismissed') => void;
}
```

**Filter bar:**
- Status filter: `Tất cả | Cần xử lý | Chưa xem`
- Agent filter dropdown: `Tất cả agent | CHRO | CFO | CTO | BD`

**Sort:** Priority DESC by default (already from query). No sort toggle needed in Feed — priority ordering is the point.

**Pagination:** 10 items per page, same as InsightsPanel.

**Empty state:** "Chưa có insights nào — chạy các agent để bắt đầu".

#### 3c. AgentSidebar — add Feed entry

**File:** `apps/ai-agent/components/AgentSidebar.tsx`

Props change:
```typescript
interface AgentSidebarProps {
  agents: AiAgent[];
  selectedAgentId: string;        // existing
  onSelectAgent: (id: string) => void;  // existing
  isFeedView: boolean;            // new
  onSelectFeed: () => void;       // new
}
```

Add a "Feed" entry **above** the agent list:

```
┌─────────────────────────┐
│  📋  Feed               │  ← active when isFeedView=true (orange highlight)
├─────────────────────────┤
│  👥  CHRO               │
│  💰  CFO                │
│  ⚙️   CTO               │
│  🚀  BD                 │
└─────────────────────────┘
```

Visually identical to an agent entry but always first, with a separator line below it.

#### 3d. AiAgentApp — wire everything together

**File:** `apps/ai-agent/components/AiAgentApp.tsx`

State additions:
```typescript
const [isFeedView, setIsFeedView] = useState(true);   // default = Feed
const [feedInsights, setFeedInsights] = useState<AiInsight[]>([]);
```

`load()` changes:
- When `isFeedView`: call `fetchAllAgents()` + `fetchAllInsights()` only. Skip per-agent calls.
- When per-agent: existing behavior unchanged.

Navigation:
- Click "Feed" in sidebar → `setIsFeedView(true)`, clear selectedAgentId
- Click any agent → `setIsFeedView(false)`, `setSelectedAgentId(id)`

Render:
- When `isFeedView`: skip AgentHeader and KPI strip, render `<FeedPanel>` directly
- When per-agent: existing render unchanged

Mobile bar: add "📋 Feed" as the first pill before the agent list.

---

## Files Changed

| File | Change |
|------|--------|
| DB migration (Supabase) | `UPDATE ai_agents SET is_active = false WHERE id IN (...)` |
| `supabase/functions/agent-run/index.ts` | Add dedup check in `create_insight` case |
| `apps/ai-agent/services/aiAgentService.ts` | Add `fetchAllInsights()`, add `.eq('is_active', true)` to `fetchAllAgents()` |
| `apps/ai-agent/components/AgentSidebar.tsx` | Add `isFeedView` + `onSelectFeed` props, render Feed entry |
| `apps/ai-agent/components/AiAgentApp.tsx` | Add `isFeedView` state, wire FeedPanel, update load(), update mobile bar |
| `apps/ai-agent/components/FeedPanel.tsx` | New component |

---

## What Does NOT Change

- Per-agent tabs (Insights, Lịch sử chạy, Bộ nhớ, Chat, Cài đặt) — untouched
- Navbar tab labels — untouched
- Chat with individual agents — untouched
- Telegram morning report — untouched
- Cron schedule — untouched (inactive agents simply don't respond to cron calls)

---

## Success Criteria

1. Sidebar shows exactly 4 agents (CHRO, CFO, CTO, BD) + Feed entry
2. Default landing is Feed view showing insights from all 4 agents
3. Each insight card in Feed shows the agent badge
4. Running the same agent twice in 24h does not duplicate insights with the same title
5. Clicking any agent still loads the full per-agent detail view
6. `npm run build` passes with no TypeScript errors
