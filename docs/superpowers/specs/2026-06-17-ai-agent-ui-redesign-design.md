# AI Agent App — UI/UX Redesign (3-Column Layout)

_Date: 2026-06-17 | Status: Approved_

---

## Overview

Redesign the AI Agent app (`apps/ai-agent/`) from a single-column tab layout to a 3-column dashboard inspired by the reference screenshot. No shared components (Navbar, AppBackground, supabaseClient) are modified. All changes are isolated inside `apps/ai-agent/`.

**Approach chosen:** Option A — Refactor layout + split inline sub-components into separate files.

---

## 1. Layout Architecture

The app shell changes from a stacked single column to a 3-zone fixed layout below the existing `<Navbar>`:

```
┌─────────────────────────────────────────────────────────────────┐
│  <Navbar> — unchanged, still carries tabs + search + user       │
├──────────┬──────────────────────────────────────┬───────────────┤
│ SIDEBAR  │  MAIN CONTENT (flex-1, overflow-y)   │  RIGHT PANEL  │
│  168px   │                                      │  240px        │
│ (60px    │  AgentHeader + KPI strip + tab panel │  (Insights    │
│  collapsed│                                     │   tab only)   │
└──────────┴──────────────────────────────────────┴───────────────┘
```

**Rules:**
- `overflow: hidden` on the body wrapper; each zone scrolls independently.
- Right panel renders **only** when `activeTab === 'insights'`. Other tabs (Chat, Config, etc.) expand to use full width.
- `<Navbar>` receives the same props as today — tabs stay in the top bar.
- `<AppBackground>` stays behind everything at z-0.

---

## 2. File Structure

```
apps/ai-agent/
├── components/
│   ├── AiAgentApp.tsx        ← simplified: data-fetching + layout shell only
│   ├── AgentSidebar.tsx      ← NEW: collapsible left sidebar
│   ├── AgentRightPanel.tsx   ← NEW: charts + quick actions + recent activity
│   ├── InsightsPanel.tsx     ← extracted from AiAgentApp (was inline)
│   ├── RunsPanel.tsx         ← extracted from AiAgentApp (was inline)
│   ├── MemoryPanel.tsx       ← extracted from AiAgentApp (was inline)
│   ├── ChatPanel.tsx         ← extracted from AiAgentApp (was inline)
│   └── ConfigPanel.tsx       ← extracted from AiAgentApp (was inline)
└── services/
    └── aiAgentService.ts     ← unchanged
```

`AiAgentApp.tsx` becomes a slim orchestrator: it owns all state and data fetching, then passes data down as props to the layout components.

---

## 3. AgentSidebar

**Visual structure (expanded, 168px):**
- Top: robot emoji avatar (48px box) + "TD GAMES / AI AGENT" label
- Middle: scrollable agent list — each row shows `avatar_emoji` + `name` (stripped of "Agent " prefix)
  - Active agent: `primary-tinted card` style from style guide (orange tint border + bg)
  - Inactive agents: default row card style
  - Inactive agent badge: small "OFF" label
  - New agents: "NEW" badge (orange)
- Bottom section:
  - Crown icon + "Enterprise Plan" label
  - Expiry date: "Hiệu lực đến 12/08/2026"
  - Progress bar (orange, hardcoded 78% — decorative, no live data source)
  - "Nâng cấp gói" button (SM primary style, no-op for now)
  - Divider + "◀ Thu gọn" collapse toggle

**Collapsed state (60px):**
- Shows only `avatar_emoji` per agent (centered), with tooltip on hover showing full name
- Logo area collapses to robot emoji only
- Toggle button shows "▶"

**State:** `collapsed: boolean` — persisted in `localStorage('ai-agent-sidebar-collapsed')`.

**Props:**
```ts
interface AgentSidebarProps {
  agents: AiAgent[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
}
```

---

## 4. Main Panel (center column)

### 4a. AgentHeader
Redesigned from the current flat row. New layout:

```
[emoji box 56px]  Agent CHRO          ● ACTIVE
                  Chief Human Resources Officer • Model: c4o/gpt-5.5
                  Quản lý và phân tích dữ liệu nhân sự toàn diện   ← personality truncated 1 line
                  cập nhật 2 phút trước
                                                [▶ Chạy phân tích ngay]
```

The description line (truncated `personality` field, max 1 line with ellipsis) is new vs. current UI.

### 4b. KPI Strip (5 cards)
Each card gains a **colored icon box** (24×24, tinted background matching the metric category) and a **delta row**:

| Card | Icon color | Delta example |
|------|-----------|---------------|
| Tổng lần chạy | blue `#2196F3` | ↑20% so với tuần trước |
| Insights tạo | orange `#FF9500` | ↑16% so với tuần trước |
| Chưa xem | red `#F44336` (if >0) / green | — Không thay đổi |
| Lần chạy cuối | green `#4CAF50` | timestamp |
| TB thời gian | purple `#AF52DE` | ↓8% nhanh hơn |

Delta values are computed from `stats` (already fetched). If no comparison data, show "—".

### 4c. InsightsPanel — enhancements
- Filter bar: `[TẤT CẢ] [CHƯA XEM] [CẦN XỬ LÝ]` (existing) + sort dropdown "Mới nhất ▼" (new, client-side) + filter icon button (new, reserved for future)
- Insight cards: replace the two text buttons (✓ Xem / ✕ Bỏ qua) with **3 icon buttons** aligned right: 👁 (mark reviewed) | 🔖 (bookmark, future feature, disabled for now) | ⋯ (menu, future)
- **Pagination:** client-side, 10 items/page, controls: `← [1] [2] [3] ... [n] →`. State: `currentPage: number`, resets to 1 on filter/agent change.

---

## 5. AgentRightPanel (240px, Insights tab only)

Four stacked cards, each using `default card` style from style guide.

### 5a. Tổng quan tuần này
- Header: "TỔNG QUAN TUẦN NÀY" label + week selector dropdown ("Tuần này")
- Big number: total runs in the selected week + delta vs. previous week (e.g., "+25%")
- **Sparkline:** SVG bar chart, 7 bars (T2→CN). Each bar height proportional to run count that day. Orange fill for current day, muted for others.
- Data source: filter `runs` by `created_at` within last 7 days, group by `dayOfWeek`.

### 5b. Phân loại insights
- Header: "PHÂN LOẠI INSIGHTS"
- **Donut chart:** Pure SVG, 4 arcs for types: `warning` (orange), `action_required` (red), `info` (blue), other (grey).
- Center text: total count + "Tổng" label.
- Legend: 4 rows, each with color dot + label + percentage + count.
- Data source: group `insights` by `type`.

### 5c. Truy cập nhanh
- Header: "TRUY CẬP NHANH"
- 2×2 grid of action cards (small, ~108px each):
  | Card | Icon | Subtitle | Action |
  |------|------|----------|--------|
  | Tạo báo cáo | 📋 | Báo cáo by Claude | `handleTrigger()` |
  | Chat với AI | 💬 | Đặt câu hỏi nhanh | `onTabChange('chat')` |
  | Bộ nhớ | 🧠 | Dữ liệu & Insights | `onTabChange('memory')` |
  | Cài đặt Agent | ⚙️ | Điều hành AI | `onTabChange('config')` |

### 5d. Hoạt động gần đây
- Header: "HOẠT ĐỘNG GẦN ĐÂY" + "Xem tất cả →" link (switches to Runs tab)
- List of 3 most recent completed runs with non-null `summary`:
  - File icon + summary title (truncated 1 line) + download icon (decorative, no-op)
  - Sub-row: "Đã tạo bởi agent • DD/MM HH:mm"

**Props:**
```ts
interface AgentRightPanelProps {
  runs: AiRun[];
  insights: AiInsight[];
  stats: AgentStats | null;
  onTabChange: (tab: string) => void;
  onTrigger: () => void;
}
```

No new API calls — all data reuses what `AiAgentApp` already fetches.

---

## 6. Data Flow

```
AiAgentApp (owns all state + fetching)
├── <Navbar> ← activeTab, onTabChange, currentUser
├── <AgentSidebar> ← agents, selectedAgentId, onSelectAgent
├── <main> (center)
│   ├── AgentHeader ← agent, stats, triggerLoading, onTrigger, lastUpdatedAt
│   ├── KPIStrip ← stats, runs (for delta computation)
│   └── {activeTab === 'insights'} → <InsightsPanel> ← insights, filter, pagination state
│       {activeTab === 'runs'}     → <RunsPanel>
│       {activeTab === 'memory'}   → <MemoryPanel>
│       {activeTab === 'chat'}     → <ChatPanel>
│       {activeTab === 'config'}   → <ConfigPanel>
└── {activeTab === 'insights'} → <AgentRightPanel> ← runs, insights, stats, onTabChange, onTrigger
```

---

## 7. Style Compliance

All patterns follow the existing STYLE_GUIDE.md:
- Colors: only approved tokens + rgba values from the guide
- Typography: Montserrat, sizes capped at `text-lg`
- Cards: `rounded-2xl border border-white/8 p-4-5` with `rgba(255,255,255,0.02)` bg
- Buttons: SM primary for CTA, XS for icon actions
- No `hover:scale-*`, no `max-w-*` inside tab components, no custom toast
- SVG charts: custom-built, zero dependencies added

---

## 8. Out of Scope

- No changes to `aiAgentService.ts` (no new API calls)
- No changes to shared components (Navbar, AppBackground, ToastNotification)
- Bookmark and filter-icon features in InsightsPanel: UI shell only, no backend wiring
- Mobile responsiveness: out of scope — this is a desktop-first internal dashboard. Sidebar and right panel are always visible on desktop (≥1280px).

---

## 9. Success Criteria

- `npm run build` passes with zero TypeScript errors
- All 5 tabs (Insights, Runs, Memory, Chat, Config) remain functional
- Agent switching still works (loads data for new agent)
- Auto-refresh polling (30s) still works in background
- Sidebar collapse state persists across page reloads (localStorage)
- Right panel only visible on Insights tab
- Desktop-only (≥1280px) — no mobile layout changes
