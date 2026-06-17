# AI Agent System — Implementation Plan

_Created: 2026-06-17 | Updated: 2026-06-17_

---

## Goal

Build an autonomous AI agent system for TD Games Platform that proactively analyzes
company data (HR, finance, operations) and surfaces actionable insights to admins —
replacing manual report checking with automated daily intelligence.

---

## Architecture

```
pg_cron (08:30-09:00 VN, T2-T6)
  → net.http_post → Edge Function `agent-run`
    → Load agent profile + memory from DB
    → Build system prompt + tools
    → LLM loop via 9Router (cx/gpt-5.5)
      → Tool calls (query DB views) → LLM → ... → Final summary
    → Store insights + episodes + run record
    → Send Telegram report (cron only)

Frontend (apps/ai-agent/)
  → Agent selector (CHRO/CFO/CEO/CTO)
  → Insights tab (filter, review, dismiss)
  → Runs tab (history, status, tokens)
  → Memory tab (episode timeline)
  → Manual trigger button
```

---

## Agents

| ID | Name | Focus | Cron (VN) | Status |
|----|------|-------|-----------|--------|
| `chro` | Agent CHRO | HR: thử việc, đánh giá, nghỉ phép, đề xuất | 08:30 | Tested OK |
| `ceo` | Agent CEO | Cross-functional overview, strategic risks | 08:30 | Created, needs test |
| `cfo` | Agent CFO | Finance: lương, burn rate, cash flow | 09:00 | Created, needs test |
| `cto` | Agent CTO | Tech: resource allocation, bottleneck | 09:00 | Created, needs test |

---

## Database Schema

### Core tables (migration: `ai_agent_schema`)
| Table | Purpose |
|-------|---------|
| `ai_agents` | Agent profiles, personality, model config, cron schedule |
| `ai_agent_runs` | Execution history — status, duration, tokens, error |
| `ai_agent_insights` | Generated insights — type, priority, review status |
| `ai_agent_episodes` | Agent memory — event log with importance score |
| `ai_agent_knowledge` | Learned facts with confidence score |
| `ai_agent_conversations` | Chat history (future: interactive mode) |

### Views (read-only for agent tools)
| View | Source |
|------|--------|
| `v_agent_employees` | hr_employees + hr_departments |
| `v_agent_salary` | hr_employee_salary + hr_salary_components |
| `v_agent_change_requests` | hr_change_requests |
| `v_agent_evaluations` | hr_evaluation_cycles + submissions |
| `v_agent_leave_requests` | att_requests (last 90 days) |

---

## Implementation Steps

### Step 1: Backend ✅ DONE
- [x] DB schema — 6 tables + 5 views
- [x] Edge function `agent-run` v7 — LLM loop with tool calling
- [x] Error handling — runs always marked failed on error
- [x] pg_cron scheduling — 4 jobs for 4 agents
- [x] 9Router — DNS, nginx, Docker container, SSL
- [x] LLM_API_KEY — Supabase secret configured
- [x] CHRO first run — 4 insights generated successfully
- [x] 4 agent profiles created (CHRO, CFO, CEO, CTO)

### Step 2: Frontend ✅ DONE
- [x] App module `apps/ai-agent/` — service + component
- [x] Registered in `config/apps.ts` + `App.tsx`
- [x] Multi-agent selector bar
- [x] 3 tabs: Insights, Runs, Memory
- [x] Manual trigger button per agent
- [x] Insight review/dismiss actions
- [x] Style guide compliant
- [x] Build passing

### Step 3: Production Deploy 🔲 TODO
- [ ] Commit all changes
- [ ] Push to main → GitHub Actions deploy
- [ ] Verify on https://app.tdgamestudio.com/#ai-agent
- [ ] Test manual trigger from production UI

### Step 4: Security & RLS 🔲 TODO
- [ ] RLS policies for ai_agent_* tables (admin/hr only)
- [ ] Edge function auth: validate caller role
- [ ] Rate limit manual triggers

### Step 5: Extended Tools 🔲 TODO
- [ ] CFO tools: query invoice/expense data
- [ ] CEO tools: cross-module queries
- [ ] CTO tools: workforce/task data
- [ ] Views for finance + workforce data

### Step 6: Telegram Integration 🔲 TODO
- [ ] Morning report via Telegram on cron runs
- [ ] Telegram bot for interactive queries
- [ ] Deep-link from Telegram to app insights

### Step 7: Polish 🔲 TODO
- [ ] Auto-refresh insights (Supabase realtime or polling)
- [ ] Insight detail modal with full body
- [ ] Agent config editor in UI
- [ ] Token usage analytics/cost tracking
- [ ] Notification badge on Home Screen

---

## Infrastructure Dependencies

| Component | Location | Notes |
|-----------|----------|-------|
| 9Router | Docker on vps6core:20128 | `docker start 9router` if down |
| nginx | /etc/nginx/sites-enabled/9router.tdgamestudio.com | SSL via Certbot |
| DNS | Cloudflare: 9router.tdgamestudio.com → VPS | A record |
| Edge Function | Supabase: `agent-run` v7 | verify_jwt: false (pg_cron needs it) |
| Secrets | Supabase: LLM_API_KEY | For 9Router auth |
| pg_cron | Jobs #9 (CHRO), #10 (CFO), #11 (CEO), #12 (CTO) | UTC times |

---

## Key Decisions

1. **LLM via 9Router** — not direct OpenAI/Anthropic, to use existing credit pool
2. **Model: cx/gpt-5.5** — best available on 9Router with valid credentials
3. **Edge Function** — not server-side, to stay within Supabase ecosystem
4. **Separate app module** — not a tab in HR, because agents span multiple domains
5. **pg_cron + net.http_post** — trigger pattern, not direct function invocation
6. **verify_jwt: false** — required for pg_cron triggers (no JWT available)

---

## Files Created/Modified

### New files
- `supabase/functions/agent-run/index.ts` — Edge function
- `apps/ai-agent/components/AiAgentApp.tsx` — Frontend app
- `apps/ai-agent/services/aiAgentService.ts` — Data service
- `docs/AI_AGENT_PLAN.md` — This plan

### Modified files
- `config/apps.ts` — Added ai-agent app config
- `App.tsx` — Added import + route for AiAgentApp
