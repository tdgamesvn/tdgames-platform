# AI Agent UI Redesign — 3-Column Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `apps/ai-agent/` from a single-column tab layout to a 3-column dashboard (sidebar + main + right panel) with enhanced InsightsPanel, SVG charts, and extracted sub-components.

**Architecture:** All state/fetching stays in `AiAgentApp.tsx`; 5 inline panels are extracted to separate files; 2 new components (AgentSidebar, AgentRightPanel) are added; layout becomes a flex row of 3 zones each scrolling independently.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS, pure SVG (no chart lib), localStorage for sidebar collapse state.

## Global Constraints

- Zero new npm dependencies
- No changes to `aiAgentService.ts`, `Navbar`, `AppBackground`, or any shared component
- All colors must use approved tokens from `.agent/meta/STYLE_GUIDE.md`
- No `hover:scale-*`, no `max-w-*` inside tab components, no `text-3xl+`
- `npm run build` must pass with zero TypeScript errors after every task
- Desktop-only (≥1280px) — no mobile layout needed
- Working directory: `/Users/tdgames_mac01/Work/apps/tdgames-platforms`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/ai-agent/utils.ts` | **CREATE** | Shared helpers: timeAgo, fmtDate, fmtDuration, TYPE_CONFIG, STATUS_CONFIG, RUN_STATUS, AGENT_EMPTY_STATE |
| `apps/ai-agent/components/RunsPanel.tsx` | **CREATE** | Extracted RunsPanel (no functional changes) |
| `apps/ai-agent/components/MemoryPanel.tsx` | **CREATE** | Extracted MemoryPanel (no functional changes) |
| `apps/ai-agent/components/ChatPanel.tsx` | **CREATE** | Extracted ChatPanel (no functional changes) |
| `apps/ai-agent/components/ConfigPanel.tsx` | **CREATE** | Extracted ConfigPanel (no functional changes) |
| `apps/ai-agent/components/InsightsPanel.tsx` | **CREATE** | Extracted + enhanced: sort dropdown, icon buttons, pagination |
| `apps/ai-agent/components/AgentSidebar.tsx` | **CREATE** | Collapsible left sidebar with agent list + plan info |
| `apps/ai-agent/components/AgentRightPanel.tsx` | **CREATE** | Sparkline SVG + donut SVG + quick actions + recent activity |
| `apps/ai-agent/components/AiAgentApp.tsx` | **MODIFY** | Slim orchestrator: 3-col layout, enhanced AgentHeader, enhanced KPI strip, wires all components |

---

## Task 1: Create `utils.ts` — shared helpers

**Files:**
- Create: `apps/ai-agent/utils.ts`

**Interfaces:**
- Produces: `timeAgo(iso: string): string`, `timeAgoShort(ts: number): string`, `fmtDate(iso: string): string`, `fmtDuration(ms: number | null): string`, `TYPE_CONFIG`, `STATUS_CONFIG`, `RUN_STATUS`, `AGENT_EMPTY_STATE`

- [ ] **Step 1: Create the file**

```typescript
// apps/ai-agent/utils.ts

export const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
};

export const timeAgoShort = (ts: number): string => {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return 'vừa xong';
  if (secs < 60) return `${secs}s trước`;
  return `${Math.floor(secs / 60)}m trước`;
};

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export const fmtDuration = (ms: number | null): string => {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

export const TYPE_CONFIG = {
  info:            { label: 'Info',       color: '#2196F3', icon: 'ℹ️' },
  warning:         { label: 'Cảnh báo',  color: '#FFA726', icon: '⚠️' },
  action_required: { label: 'Cần xử lý', color: '#F44336', icon: '🔴' },
} as const;

export const STATUS_CONFIG = {
  new:       { label: 'Mới',     color: '#FF9500' },
  reviewed:  { label: 'Đã xem', color: '#4CAF50' },
  dismissed: { label: 'Bỏ qua', color: '#9D9C9D' },
} as const;

export const RUN_STATUS = {
  running:   { label: 'Đang chạy',  color: '#2196F3' },
  completed: { label: 'Hoàn thành', color: '#4CAF50' },
  failed:    { label: 'Lỗi',        color: '#F44336' },
} as const;

export const AGENT_EMPTY_STATE: Record<string, { emoji: string; prompt: string }> = {
  cfo:  { emoji: '💰', prompt: 'Chạy phân tích để nhận insights về tài chính doanh nghiệp' },
  ceo:  { emoji: '👔', prompt: 'Chạy phân tích để nhận insights tổng quan điều hành' },
  cto:  { emoji: '⚙️', prompt: 'Chạy phân tích để nhận insights về hạ tầng kỹ thuật' },
  chro: { emoji: '👥', prompt: 'Chạy phân tích để nhận insights về nhân sự' },
};
```

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors (nothing imports utils yet, so this just checks syntax).

- [ ] **Step 3: Commit**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms
git add apps/ai-agent/utils.ts
git commit -m "feat(ai-agent): extract shared utils (timeAgo, fmtDate, configs)"
```

---

## Task 2: Extract RunsPanel, MemoryPanel, ChatPanel, ConfigPanel

**Files:**
- Create: `apps/ai-agent/components/RunsPanel.tsx`
- Create: `apps/ai-agent/components/MemoryPanel.tsx`
- Create: `apps/ai-agent/components/ChatPanel.tsx`
- Create: `apps/ai-agent/components/ConfigPanel.tsx`

**Interfaces:**
- Consumes: `timeAgo`, `fmtDate`, `fmtDuration`, `RUN_STATUS` from `../utils`
- Consumes: `AiRun`, `AiEpisode`, `AiConversation`, `AiAgent` from `../services/aiAgentService`
- Produces: default exports `RunsPanel`, `MemoryPanel`, `ChatPanel`, `ConfigPanel`

- [ ] **Step 1: Create `RunsPanel.tsx`**

```tsx
// apps/ai-agent/components/RunsPanel.tsx
import React, { useState } from 'react';
import { AiRun } from '../services/aiAgentService';
import { timeAgo, fmtDate, fmtDuration, RUN_STATUS } from '../utils';

const RUN_TRUNCATE = 120;

interface RunsPanelProps {
  runs: AiRun[];
  agentEmoji: string;
  agentName: string;
  onTrigger: () => void;
  triggerLoading: boolean;
}

const RunsPanel: React.FC<RunsPanelProps> = ({ runs, agentEmoji, agentName, onTrigger, triggerLoading }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {runs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">{agentEmoji}</p>
          <p className="text-neutral-600 text-sm">{agentName} chưa có lần chạy nào</p>
          <p className="text-xs mt-1 text-neutral-700 mb-5">Nhấn nút bên dưới để chạy lần đầu</p>
          <button
            onClick={onTrigger}
            disabled={triggerLoading}
            className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
            style={{ background: '#FF9500' }}
          >
            {triggerLoading ? 'Đang chạy...' : '▶ Chạy phân tích ngay'}
          </button>
        </div>
      ) : (
        runs.map(run => {
          const sc = RUN_STATUS[run.status as keyof typeof RUN_STATUS] || RUN_STATUS.failed;
          const isExpanded = expandedId === run.id;
          const summaryIsLong = !!run.summary && run.summary.length > RUN_TRUNCATE;
          const errorIsLong = !!run.error && run.error.length > RUN_TRUNCATE;
          const canExpand = summaryIsLong || errorIsLong;

          return (
            <div
              key={run.id}
              className={`rounded-2xl border border-white/8 p-4 transition-all ${canExpand ? 'cursor-pointer hover:border-white/15' : ''}`}
              style={{ background: 'rgba(255,255,255,0.02)' }}
              onClick={() => { if (canExpand) setExpandedId(prev => prev === run.id ? null : run.id); }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: sc.color, boxShadow: run.status === 'running' ? `0 0 8px ${sc.color}` : 'none' }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
                        style={{ background: `${sc.color}20`, color: sc.color }}>
                        {sc.label}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-600">{run.trigger_type}</span>
                      {canExpand && <span className="text-[9px] text-neutral-700">{isExpanded ? '▲' : '▼'}</span>}
                    </div>
                    {run.summary && (
                      <p className={`text-xs text-neutral-medium mt-1 ${isExpanded ? 'whitespace-pre-wrap' : 'truncate'}`}>
                        {isExpanded ? run.summary : run.summary.slice(0, RUN_TRUNCATE) + (summaryIsLong ? '...' : '')}
                      </p>
                    )}
                    {run.error && (
                      <p className={`text-xs text-red-400/80 mt-1 ${isExpanded ? 'whitespace-pre-wrap' : 'truncate'}`}>
                        {isExpanded ? run.error : run.error.slice(0, RUN_TRUNCATE) + (errorIsLong ? '...' : '')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-right">
                  {run.insights_created > 0 && (
                    <div>
                      <p className="text-xs font-black text-primary">{run.insights_created}</p>
                      <p className="text-[9px] text-neutral-600 uppercase">insights</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-white font-mono">{fmtDuration(run.duration_ms)}</p>
                    <p className="text-[9px] text-neutral-600 uppercase">duration</p>
                  </div>
                  {(run.tokens_input > 0 || run.tokens_output > 0) && (
                    <div className="hidden md:block">
                      <p className="text-xs font-mono text-white/60">{(run.tokens_input + run.tokens_output).toLocaleString()}</p>
                      <p className="text-[9px] text-neutral-600 uppercase">tokens</p>
                    </div>
                  )}
                  <p className="text-[10px] text-neutral-600">{timeAgo(run.created_at)}</p>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default RunsPanel;
```

- [ ] **Step 2: Create `MemoryPanel.tsx`**

```tsx
// apps/ai-agent/components/MemoryPanel.tsx
import React from 'react';
import { AiEpisode } from '../services/aiAgentService';
import { fmtDate } from '../utils';

interface MemoryPanelProps {
  episodes: AiEpisode[];
}

const MemoryPanel: React.FC<MemoryPanelProps> = ({ episodes }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-base font-black text-white uppercase tracking-wider">🧠 Bộ nhớ Agent</span>
      <span className="text-[9px] font-bold text-neutral-600 uppercase">{episodes.length} sự kiện gần nhất</span>
    </div>
    {episodes.length === 0 ? (
      <div className="text-center py-16">
        <p className="text-3xl mb-3">🧠</p>
        <p className="text-neutral-600 text-sm">Agent chưa có ký ức nào</p>
      </div>
    ) : (
      <div className="relative pl-6">
        <div className="absolute left-2.5 top-2 bottom-2 w-px bg-white/10" />
        {episodes.map((ep, i) => (
          <div key={ep.id} className="relative pb-4">
            <div className="absolute -left-3.5 top-1.5 w-3 h-3 rounded-full border-2 border-white/20"
              style={{ background: i === 0 ? '#FF9500' : '#1a1a1a' }} />
            <div className="rounded-xl border border-white/8 p-3 ml-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-white/5 text-neutral-400">{ep.event_type}</span>
                <span className="text-[9px] text-neutral-600">{fmtDate(ep.created_at)}</span>
                <span className="text-[9px] font-bold text-neutral-700">imp:{ep.importance}</span>
              </div>
              <p className="text-xs text-neutral-medium leading-relaxed">{ep.summary}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default MemoryPanel;
```

- [ ] **Step 3: Create `ChatPanel.tsx`**

```tsx
// apps/ai-agent/components/ChatPanel.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AiConversation, sendChatMessage } from '../services/aiAgentService';

const CHANNEL_CONFIG = {
  app:      { label: 'APP',      color: '#FF9500' },
  telegram: { label: 'TELEGRAM', color: '#2196F3' },
} as const;

const chatDateKey = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const chatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

interface ChatPanelProps {
  conversations: AiConversation[];
  setConversations: React.Dispatch<React.SetStateAction<AiConversation[]>>;
  agentId: string;
  agentEmoji: string;
  agentName: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ conversations, setConversations, agentId, agentEmoji, agentName }) => {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, []);

  useEffect(() => { scrollToBottom(); }, [conversations, sending, scrollToBottom]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput('');
    setSending(true);
    const userMsg: AiConversation = {
      id: `temp-${Date.now()}`, agent_id: agentId, channel: 'app', role: 'user',
      content: trimmed, tokens_used: 0, created_at: new Date().toISOString(),
    };
    setConversations(prev => [...prev, userMsg]);
    const res = await sendChatMessage(agentId, trimmed);
    if (res.ok && res.reply) {
      setConversations(prev => [...prev, {
        id: `temp-reply-${Date.now()}`, agent_id: agentId, channel: 'app', role: 'assistant',
        content: res.reply!, tokens_used: 0, created_at: new Date().toISOString(),
      }]);
    } else if (!res.ok) {
      setConversations(prev => [...prev, {
        id: `temp-err-${Date.now()}`, agent_id: agentId, channel: 'app', role: 'assistant',
        content: `[Lỗi] ${res.error?.slice(0, 200) || 'Không nhận được phản hồi từ agent'}`,
        tokens_used: 0, created_at: new Date().toISOString(),
      }]);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  let lastDateKey = '';

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 380px)', minHeight: '400px' }}>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 pb-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {conversations.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">{agentEmoji}</p>
            <p className="text-neutral-600 text-sm">Chưa có cuộc trò chuyện nào với {agentName}</p>
            <p className="text-xs mt-1 text-neutral-700">Gửi tin nhắn để bắt đầu chat</p>
          </div>
        ) : (
          conversations.map(msg => {
            const dateKey = chatDateKey(msg.created_at);
            const showDateSep = dateKey !== lastDateKey;
            lastDateKey = dateKey;
            const isUser = msg.role === 'user';
            const chConf = CHANNEL_CONFIG[msg.channel as keyof typeof CHANNEL_CONFIG] || CHANNEL_CONFIG.app;
            return (
              <React.Fragment key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-700">{dateKey}</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                )}
                <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 mt-1"
                      style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.15)' }}>
                      {agentEmoji}
                    </div>
                  )}
                  <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
                        style={{ background: `${chConf.color}20`, color: chConf.color }}>{chConf.label}</span>
                      <span className="text-[10px] text-neutral-700">{chatTime(msg.created_at)}</span>
                    </div>
                    <div className={`rounded-2xl border p-3 ${isUser ? 'border-primary/20' : 'border-white/8'}`}
                      style={{ background: isUser ? 'rgba(255,149,0,0.05)' : 'rgba(255,255,255,0.02)' }}>
                      <p className="text-sm text-white whitespace-pre-wrap leading-relaxed break-words">{msg.content}</p>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        {sending && (
          <div className="flex justify-start gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 mt-1"
              style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.15)' }}>
              {agentEmoji}
            </div>
            <div className="rounded-2xl border border-white/8 p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-1.5">
                {[0, 200, 400].map(delay => (
                  <span key={delay} className="w-2 h-2 rounded-full bg-primary/60 animate-td-pulse" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="pt-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Nhắn tin cho ${agentName}...`}
            disabled={sending}
            className="flex-1 px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors disabled:opacity-50"
            style={{ background: '#1a1a1a' }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
            style={{ background: '#FF9500' }}
          >
            {sending ? 'Đang gửi...' : 'Gửi'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
```

- [ ] **Step 4: Create `ConfigPanel.tsx`**

```tsx
// apps/ai-agent/components/ConfigPanel.tsx
import React, { useState, useEffect } from 'react';
import { AiAgent, updateAgent } from '../services/aiAgentService';

interface ConfigPanelProps {
  agent: AiAgent;
  onSaved: (updated: AiAgent) => void;
  onError: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ agent, onSaved, onError }) => {
  const [form, setForm] = useState({
    name: agent.name, avatar_emoji: agent.avatar_emoji, role_title: agent.role_title,
    model: agent.model, temperature: agent.temperature, personality: agent.personality,
    is_active: agent.is_active,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: agent.name, avatar_emoji: agent.avatar_emoji, role_title: agent.role_title,
      model: agent.model, temperature: agent.temperature, personality: agent.personality,
      is_active: agent.is_active,
    });
  }, [agent.id]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await updateAgent(agent.id, form);
    setSaving(false);
    if (ok) onSaved({ ...agent, ...form }); else onError();
  };

  const fc = "w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-primary/50 transition-colors";
  const fs = { background: '#1a1a1a' };
  const lc = "text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-1.5 block";

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base font-black text-white uppercase tracking-wider">⚙️ Cấu hình Agent</span>
      </div>
      <div className="rounded-2xl border border-white/8 p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className={lc}>Trạng thái</p>
            <p className="text-xs text-neutral-600">Agent có được chạy theo lịch không</p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
            className={`relative w-12 h-6 rounded-full transition-all duration-200 ${form.is_active ? 'bg-primary' : 'bg-white/10'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${form.is_active ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
        <div className="h-px bg-white/5" />
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div>
            <label className={lc}>Emoji</label>
            <input type="text" value={form.avatar_emoji} onChange={e => setForm(f => ({ ...f, avatar_emoji: e.target.value }))} className={fc} style={fs} maxLength={4} />
          </div>
          <div>
            <label className={lc}>Tên Agent</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={fc} style={fs} />
          </div>
        </div>
        <div>
          <label className={lc}>Chức danh</label>
          <input type="text" value={form.role_title} onChange={e => setForm(f => ({ ...f, role_title: e.target.value }))} className={fc} style={fs} />
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div>
            <label className={lc}>Model</label>
            <input type="text" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className={fc} style={fs} placeholder="cx/gpt-5.5" />
          </div>
          <div>
            <label className={lc}>Temperature</label>
            <input type="number" min={0} max={1} step={0.05} value={form.temperature} onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) || 0 }))} className={fc} style={fs} />
          </div>
        </div>
        <div>
          <label className={lc}>Personality / System Prompt thêm</label>
          <textarea value={form.personality} onChange={e => setForm(f => ({ ...f, personality: e.target.value }))} rows={5} className={`${fc} resize-none`} style={fs} />
        </div>
      </div>
      <button onClick={handleSave} disabled={saving}
        className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
        style={{ background: '#FF9500' }}>
        {saving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
      </button>
    </div>
  );
};

export default ConfigPanel;
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` (AiAgentApp still has old inline code, these 4 files are unused but valid TypeScript).

- [ ] **Step 6: Commit**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms
git add apps/ai-agent/components/RunsPanel.tsx apps/ai-agent/components/MemoryPanel.tsx apps/ai-agent/components/ChatPanel.tsx apps/ai-agent/components/ConfigPanel.tsx
git commit -m "feat(ai-agent): extract RunsPanel, MemoryPanel, ChatPanel, ConfigPanel to separate files"
```

---

## Task 3: Extract + enhance InsightsPanel

**Files:**
- Create: `apps/ai-agent/components/InsightsPanel.tsx`

**Interfaces:**
- Consumes: `AiInsight` from `../services/aiAgentService`; `TYPE_CONFIG`, `STATUS_CONFIG`, `fmtDate` from `../utils`
- Produces: default export `InsightsPanel` with props:
  ```ts
  interface InsightsPanelProps {
    insights: AiInsight[];          // already filtered by parent
    filter: 'all' | 'new' | 'action_required';
    onFilterChange: (f: 'all' | 'new' | 'action_required') => void;
    onAction: (id: string, action: 'reviewed' | 'dismissed') => void;
    agentEmoji: string;
    agentName: string;
    onTrigger: () => void;
    triggerLoading: boolean;
    hasNoData: boolean;
  }
  ```
- New internal state: `sortOrder: 'newest' | 'oldest'`, `currentPage: number` (resets when `filter` changes), `expandedId: string | null`

- [ ] **Step 1: Create `InsightsPanel.tsx`**

```tsx
// apps/ai-agent/components/InsightsPanel.tsx
import React, { useState, useEffect } from 'react';
import { AiInsight } from '../services/aiAgentService';
import { TYPE_CONFIG, STATUS_CONFIG, fmtDate } from '../utils';

const BODY_TRUNCATE = 150;
const ITEMS_PER_PAGE = 10;

interface InsightsPanelProps {
  insights: AiInsight[];
  filter: 'all' | 'new' | 'action_required';
  onFilterChange: (f: 'all' | 'new' | 'action_required') => void;
  onAction: (id: string, action: 'reviewed' | 'dismissed') => void;
  agentEmoji: string;
  agentName: string;
  onTrigger: () => void;
  triggerLoading: boolean;
  hasNoData: boolean;
}

const InsightsPanel: React.FC<InsightsPanelProps> = ({
  insights, filter, onFilterChange, onAction,
  agentEmoji, agentName, onTrigger, triggerLoading, hasNoData,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [filter]);

  if (hasNoData) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">{agentEmoji}</p>
        <p className="text-neutral-500 text-sm font-semibold mb-1">{agentName} chưa có dữ liệu</p>
        <p className="text-xs text-neutral-700 mb-6">Chạy phân tích để bắt đầu nhận insights</p>
        <button onClick={onTrigger} disabled={triggerLoading}
          className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
          style={{ background: '#FF9500' }}>
          {triggerLoading ? 'Đang chạy...' : '▶ Chạy phân tích ngay'}
        </button>
      </div>
    );
  }

  const sorted = [...insights].sort((a, b) => {
    const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return sortOrder === 'newest' ? diff : -diff;
  });

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Filter bar + sort */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: 'all' as const,            label: 'Tất cả' },
          { key: 'new' as const,            label: 'Chưa xem' },
          { key: 'action_required' as const, label: 'Cần xử lý' },
        ]).map(f => (
          <button key={f.key} onClick={() => onFilterChange(f.key)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              filter === f.key
                ? 'text-white bg-primary/20 border border-primary/30'
                : 'text-neutral-400 border border-white/10 hover:text-white hover:border-white/20'
            }`}>
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={sortOrder}
            onChange={e => { setSortOrder(e.target.value as 'newest' | 'oldest'); setCurrentPage(1); }}
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 outline-none transition-colors"
            style={{ background: '#1a1a1a' }}
          >
            <option value="newest">Mới nhất ▼</option>
            <option value="oldest">Cũ nhất ▲</option>
          </select>
          <button
            disabled
            title="Bộ lọc nâng cao (sắp có)"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-600 border border-white/8 cursor-not-allowed opacity-40"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* List */}
      {paginated.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">{agentEmoji}</p>
          <p className="text-neutral-600 text-sm">{agentName} chưa có insight nào</p>
          <p className="text-xs mt-1 text-neutral-700">Chạy agent để phân tích dữ liệu</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginated.map(insight => {
            const typeConf   = TYPE_CONFIG[insight.type as keyof typeof TYPE_CONFIG]     ?? TYPE_CONFIG.info;
            const statusConf = STATUS_CONFIG[insight.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.new;
            const isExpanded     = expandedId === insight.id;
            const bodyIsLong     = insight.body.length > BODY_TRUNCATE;
            const hasSuggestedAction = !!insight.suggested_action;
            const canExpand      = bodyIsLong || hasSuggestedAction;

            return (
              <div key={insight.id}
                className="rounded-2xl border p-5 transition-all"
                style={{
                  background:   insight.status === 'new' ? 'rgba(255,149,0,0.03)' : 'rgba(255,255,255,0.02)',
                  borderColor:  insight.status === 'new' ? 'rgba(255,149,0,0.12)' : 'rgba(255,255,255,0.08)',
                }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
                        style={{ background: `${typeConf.color}20`, color: typeConf.color }}>
                        {typeConf.icon} {typeConf.label}
                      </span>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
                        style={{ background: `${statusConf.color}20`, color: statusConf.color }}>
                        {statusConf.label}
                      </span>
                      <span className="text-[9px] font-bold text-neutral-600">P{insight.priority}</span>
                    </div>
                    <div className={canExpand ? 'cursor-pointer' : ''} onClick={() => { if (canExpand) setExpandedId(prev => prev === insight.id ? null : insight.id); }}>
                      <h3 className="text-sm font-semibold text-white mb-1">{insight.title}</h3>
                      <p className="text-xs text-neutral-medium leading-relaxed">
                        {!isExpanded && bodyIsLong ? insight.body.slice(0, BODY_TRUNCATE) + '...' : insight.body}
                      </p>
                      {canExpand && !isExpanded && (
                        <span className="text-[10px] text-primary/60 mt-1 inline-block">Xem thêm</span>
                      )}
                    </div>
                    {isExpanded && insight.suggested_action && (
                      <div className="mt-3 px-3 py-2 rounded-xl text-xs text-primary/80 border border-primary/10"
                        style={{ background: 'rgba(255,149,0,0.05)' }}>
                        <span className="font-semibold">Gợi ý:</span> {insight.suggested_action}
                      </div>
                    )}
                    <p className="text-[10px] text-neutral-700 mt-2">{fmtDate(insight.created_at)}</p>
                  </div>

                  {/* Icon action buttons (replaces old text buttons) */}
                  {insight.status === 'new' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onAction(insight.id, 'reviewed')}
                        title="Đánh dấu đã xem"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm text-green-400 border border-green-500/20 hover:bg-green-500/10 transition-all"
                      >
                        👁
                      </button>
                      <button
                        disabled
                        title="Bookmark (sắp có)"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm text-neutral-600 border border-white/8 cursor-not-allowed opacity-40"
                      >
                        🔖
                      </button>
                      <button
                        disabled
                        title="Thêm tùy chọn (sắp có)"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm text-neutral-600 border border-white/8 cursor-not-allowed opacity-40"
                      >
                        ⋯
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <button
            onClick={() => setCurrentPage(p => p - 1)}
            disabled={currentPage === 1}
            className="px-2 py-1 rounded-lg text-xs text-neutral-400 border border-white/10 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
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
          <button
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 rounded-lg text-xs text-neutral-400 border border-white/10 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
};

export default InsightsPanel;
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms
git add apps/ai-agent/components/InsightsPanel.tsx
git commit -m "feat(ai-agent): extract InsightsPanel with sort, icon buttons, and pagination"
```

---

## Task 4: Build AgentSidebar

**Files:**
- Create: `apps/ai-agent/components/AgentSidebar.tsx`

**Interfaces:**
- Consumes: `AiAgent` from `../services/aiAgentService`
- Produces: default export `AgentSidebar` with props:
  ```ts
  interface AgentSidebarProps {
    agents: AiAgent[];
    selectedAgentId: string;
    onSelectAgent: (id: string) => void;
  }
  ```

- [ ] **Step 1: Create `AgentSidebar.tsx`**

```tsx
// apps/ai-agent/components/AgentSidebar.tsx
import React, { useState } from 'react';
import { AiAgent } from '../services/aiAgentService';

const SIDEBAR_KEY = 'ai-agent-sidebar-collapsed';

interface AgentSidebarProps {
  agents: AiAgent[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
}

const AgentSidebar: React.FC<AgentSidebarProps> = ({ agents, selectedAgentId, onSelectAgent }) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'true'; } catch { return false; }
  });

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch { /* ignore */ }
  };

  return (
    <aside
      className="flex flex-col shrink-0 border-r border-white/8 transition-all duration-200 overflow-hidden"
      style={{ width: collapsed ? 60 : 168, background: 'rgba(255,255,255,0.01)' }}
    >
      {/* Logo area */}
      <div className={`p-3 border-b border-white/5 flex items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
          style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.2)' }}
        >
          🤖
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600 leading-tight">TD GAMES</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-white leading-tight">AI AGENT</p>
          </div>
        )}
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {agents.map(a => {
          const isActive = a.id === selectedAgentId;
          return (
            <button
              key={a.id}
              onClick={() => onSelectAgent(a.id)}
              title={collapsed ? a.name : undefined}
              className={`w-full flex items-center transition-all rounded-xl ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-2'}`}
              style={isActive
                ? { background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)' }
                : { background: 'transparent', border: '1px solid transparent' }
              }
            >
              <span className="text-xl shrink-0">{a.avatar_emoji}</span>
              {!collapsed && (
                <>
                  <span className={`text-xs font-semibold truncate flex-1 text-left ${isActive ? 'text-white' : 'text-neutral-400'}`}>
                    {a.name.replace('Agent ', '')}
                  </span>
                  {!a.is_active && (
                    <span className="text-[8px] font-black uppercase tracking-widest text-neutral-600 shrink-0">OFF</span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Plan info (expanded only) */}
      {!collapsed && (
        <div className="p-3 border-t border-white/5">
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,149,0,0.03)', border: '1px solid rgba(255,149,0,0.08)' }}>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">👑</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-primary">Enterprise Plan</span>
            </div>
            <p className="text-[9px] text-neutral-600">Hiệu lực đến 12/08/2026</p>
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full bg-primary" style={{ width: '78%' }} />
            </div>
            <button
              className="w-full px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white transition-all"
              style={{ background: '#FF9500' }}
            >
              Nâng cấp gói
            </button>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        className="py-3 border-t border-white/5 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-600 hover:text-white transition-all"
      >
        {collapsed ? '▶' : <><span>◀</span><span>Thu gọn</span></>}
      </button>
    </aside>
  );
};

export default AgentSidebar;
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms
git add apps/ai-agent/components/AgentSidebar.tsx
git commit -m "feat(ai-agent): add collapsible AgentSidebar with localStorage state"
```

---

## Task 5: Build AgentRightPanel

**Files:**
- Create: `apps/ai-agent/components/AgentRightPanel.tsx`

**Interfaces:**
- Consumes: `AiRun`, `AiInsight`, `AgentStats` from `../services/aiAgentService`
- Produces: default export `AgentRightPanel` with props:
  ```ts
  interface AgentRightPanelProps {
    runs: AiRun[];
    insights: AiInsight[];
    stats: AgentStats | null;
    onTabChange: (tab: string) => void;
    onTrigger: () => void;
  }
  ```

- [ ] **Step 1: Create `AgentRightPanel.tsx`**

```tsx
// apps/ai-agent/components/AgentRightPanel.tsx
import React from 'react';
import { AiRun, AiInsight, AgentStats } from '../services/aiAgentService';

interface AgentRightPanelProps {
  runs: AiRun[];
  insights: AiInsight[];
  stats: AgentStats | null;
  onTabChange: (tab: string) => void;
  onTrigger: () => void;
}

// ── Sparkline: 7-day bar chart ──────────────────────────────────
const SparklineChart: React.FC<{ runs: AiRun[] }> = ({ runs }) => {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const counts = days.map(ds => runs.filter(r => r.created_at.slice(0, 10) === ds).length);
  const maxCount = Math.max(...counts, 1);
  const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const BAR_H = 40, BAR_W = 14, GAP = 5;
  const W = 7 * BAR_W + 6 * GAP;

  return (
    <svg width={W} height={BAR_H + 14} className="overflow-visible">
      {counts.map((count, i) => {
        const bh = Math.max(3, (count / maxCount) * BAR_H);
        const x = i * (BAR_W + GAP);
        const isToday = i === 6;
        return (
          <g key={i}>
            <rect x={x} y={BAR_H - bh} width={BAR_W} height={bh} rx={3}
              fill={isToday ? '#FF9500' : 'rgba(255,149,0,0.25)'} />
            <text x={x + BAR_W / 2} y={BAR_H + 12} textAnchor="middle"
              fill="rgba(157,156,157,0.6)" fontSize="7" fontWeight="700"
              fontFamily="Montserrat, sans-serif">
              {DAY_LABELS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ── Donut chart: insight types ──────────────────────────────────
const TYPE_COLORS: Record<string, { color: string; label: string }> = {
  warning:         { color: '#FF9500', label: 'Cảnh báo' },
  action_required: { color: '#F44336', label: 'Cần xử lý' },
  info:            { color: '#2196F3', label: 'Info' },
  other:           { color: '#444444', label: 'Khác' },
};

const DonutChart: React.FC<{ insights: AiInsight[] }> = ({ insights }) => {
  const total = insights.length;
  if (total === 0) return <p className="text-[10px] text-neutral-700 text-center py-3">Chưa có dữ liệu</p>;

  const counts: Record<string, number> = {
    warning: 0, action_required: 0, info: 0, other: 0,
  };
  insights.forEach(i => {
    if (i.type in counts) counts[i.type]++;
    else counts.other++;
  });

  const CX = 44, CY = 44, R = 30, SW = 10;
  const circ = 2 * Math.PI * R;
  let cum = 0;

  const arcs = Object.entries(counts)
    .filter(([, c]) => c > 0)
    .map(([type, count]) => {
      const pct = count / total;
      const dash = pct * circ;
      const offset = -(cum * circ);
      cum += pct;
      return { type, count, dash, offset, pct };
    });

  return (
    <div className="flex items-center gap-3">
      <svg width={88} height={88} className="shrink-0">
        <g transform={`rotate(-90, ${CX}, ${CY})`}>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={SW} />
          {arcs.map(({ type, dash, offset }) => (
            <circle key={type} cx={CX} cy={CY} r={R} fill="none"
              stroke={TYPE_COLORS[type]?.color ?? '#444'}
              strokeWidth={SW}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={offset} />
          ))}
        </g>
        <text x={CX} y={CY - 4} textAnchor="middle" fill="white" fontSize="14" fontWeight="900" fontFamily="Montserrat, sans-serif">{total}</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fill="rgba(157,156,157,0.6)" fontSize="7" fontWeight="700" fontFamily="Montserrat, sans-serif">TỔNG</text>
      </svg>
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {arcs.map(({ type, count, pct }) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_COLORS[type]?.color ?? '#444' }} />
            <span className="text-[9px] text-neutral-500 truncate flex-1">{TYPE_COLORS[type]?.label}</span>
            <span className="text-[9px] font-black text-neutral-400">{Math.round(pct * 100)}%</span>
            <span className="text-[9px] text-neutral-600">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────
const AgentRightPanel: React.FC<AgentRightPanelProps> = ({ runs, insights, onTabChange, onTrigger }) => {
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = runs.filter(r => now - new Date(r.created_at).getTime() < WEEK);
  const lastWeek = runs.filter(r => { const age = now - new Date(r.created_at).getTime(); return age >= WEEK && age < 2 * WEEK; });
  const weekDelta = lastWeek.length > 0 ? Math.round(((thisWeek.length - lastWeek.length) / lastWeek.length) * 100) : null;

  const recentRuns = runs.filter(r => r.status === 'completed' && r.summary).slice(0, 3);

  const CARD = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' };

  const quickActions = [
    { emoji: '📋', label: 'Tạo báo cáo',   sub: 'Báo cáo by Claude',    onClick: onTrigger },
    { emoji: '💬', label: 'Chat với AI',    sub: 'Đặt câu hỏi nhanh',   onClick: () => onTabChange('chat') },
    { emoji: '🧠', label: 'Bộ nhớ',         sub: 'Dữ liệu & Insights',   onClick: () => onTabChange('memory') },
    { emoji: '⚙️', label: 'Cài đặt Agent', sub: 'Điều hành AI',         onClick: () => onTabChange('config') },
  ];

  return (
    <aside className="w-60 shrink-0 border-l border-white/8 overflow-y-auto p-3 space-y-3"
      style={{ background: 'rgba(255,255,255,0.005)' }}>

      {/* 5a. Weekly overview */}
      <div className="rounded-2xl p-4 space-y-3" style={CARD}>
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-black uppercase tracking-wider text-neutral-600">TỔNG QUAN TUẦN NÀY</p>
          <span className="text-[9px] text-neutral-700 border border-white/10 px-2 py-0.5 rounded-lg">Tuần này</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-black text-white">{thisWeek.length}</span>
          {weekDelta !== null && (
            <span className={`text-[10px] font-semibold mb-1 ${weekDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {weekDelta >= 0 ? '+' : ''}{weekDelta}%
            </span>
          )}
        </div>
        <SparklineChart runs={runs} />
      </div>

      {/* 5b. Insight classification */}
      <div className="rounded-2xl p-4 space-y-3" style={CARD}>
        <p className="text-[9px] font-black uppercase tracking-wider text-neutral-600">PHÂN LOẠI INSIGHTS</p>
        <DonutChart insights={insights} />
      </div>

      {/* 5c. Quick actions */}
      <div className="rounded-2xl p-4 space-y-3" style={CARD}>
        <p className="text-[9px] font-black uppercase tracking-wider text-neutral-600">TRUY CẬP NHANH</p>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((a, i) => (
            <button key={i} onClick={a.onClick}
              className="rounded-xl p-2.5 text-left transition-all hover:border-white/15"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-lg mb-1">{a.emoji}</p>
              <p className="text-[9px] font-black text-white leading-tight">{a.label}</p>
              <p className="text-[8px] text-neutral-600 mt-0.5 leading-tight">{a.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 5d. Recent activity */}
      <div className="rounded-2xl p-4 space-y-3" style={CARD}>
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-black uppercase tracking-wider text-neutral-600">HOẠT ĐỘNG GẦN ĐÂY</p>
          <button onClick={() => onTabChange('runs')} className="text-[9px] text-primary/60 hover:text-primary transition-all">
            Xem tất cả →
          </button>
        </div>
        {recentRuns.length === 0 ? (
          <p className="text-[10px] text-neutral-700 text-center py-2">Chưa có dữ liệu</p>
        ) : (
          <div className="space-y-2.5">
            {recentRuns.map(run => (
              <div key={run.id} className="flex items-start gap-2">
                <span className="text-sm shrink-0 mt-0.5">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-white truncate">
                    {(run.summary || '').split('\n')[0].slice(0, 50)}
                  </p>
                  <p className="text-[9px] text-neutral-600 mt-0.5">
                    Đã tạo bởi agent •{' '}
                    {new Date(run.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}{' '}
                    {new Date(run.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="text-neutral-700 text-sm shrink-0 mt-0.5">⬇</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

export default AgentRightPanel;
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms
git add apps/ai-agent/components/AgentRightPanel.tsx
git commit -m "feat(ai-agent): add AgentRightPanel with sparkline, donut chart, quick actions"
```

---

## Task 6: Refactor AiAgentApp — 3-column layout + AgentHeader + KPI strip

**Files:**
- Modify: `apps/ai-agent/components/AiAgentApp.tsx` (replace entire file)

**Interfaces:**
- Consumes: all 7 extracted components + `aiAgentService` + `utils`
- The old inline panel definitions and helper functions are **deleted** from this file; they now live in their respective files.

- [ ] **Step 1: Replace `AiAgentApp.tsx` with the refactored version**

```tsx
// apps/ai-agent/components/AiAgentApp.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppBackground from '@/components/AppBackground';
import { Navbar } from '@/components/Navbar';
import { AccountUser } from '@/types';
import {
  fetchAgent, fetchAllAgents, fetchInsights, fetchRuns, fetchEpisodes,
  fetchAgentStats, fetchConversations, updateInsightStatus, triggerManualRun,
  AiAgent, AiInsight, AiRun, AiEpisode, AiConversation, AgentStats,
} from '../services/aiAgentService';
import { timeAgo, timeAgoShort, fmtDuration, AGENT_EMPTY_STATE } from '../utils';
import AgentSidebar from './AgentSidebar';
import AgentRightPanel from './AgentRightPanel';
import InsightsPanel from './InsightsPanel';
import RunsPanel from './RunsPanel';
import MemoryPanel from './MemoryPanel';
import ChatPanel from './ChatPanel';
import ConfigPanel from './ConfigPanel';

interface Props {
  currentUser: AccountUser;
  onBack: () => void;
  initialTab?: string | null;
}

const POLL_INTERVAL = 30_000;

// Colored icon box for KPI cards
const KpiIcon: React.FC<{ emoji: string; color: string }> = ({ emoji, color }) => (
  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0"
    style={{ background: `${color}20` }}>
    <span>{emoji}</span>
  </div>
);

const AiAgentApp: React.FC<Props> = ({ currentUser, onBack, initialTab }) => {
  const [activeTab, setActiveTab]           = useState<string>(initialTab || 'insights');
  const [allAgents, setAllAgents]           = useState<AiAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('chro');
  const [agent, setAgent]                   = useState<AiAgent | null>(null);
  const [stats, setStats]                   = useState<AgentStats | null>(null);
  const [insights, setInsights]             = useState<AiInsight[]>([]);
  const [runs, setRuns]                     = useState<AiRun[]>([]);
  const [episodes, setEpisodes]             = useState<AiEpisode[]>([]);
  const [conversations, setConversations]   = useState<AiConversation[]>([]);
  const [loading, setLoading]               = useState(true);
  const [agentSwitching, setAgentSwitching] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [toast, setToast]                   = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [insightFilter, setInsightFilter]   = useState<'all' | 'new' | 'action_required'>('all');
  const [lastUpdatedAt, setLastUpdatedAt]   = useState<number>(Date.now());
  const [, setTick]                         = useState(0);
  const isFirstLoad                         = useRef(true);

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

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = setInterval(() => { if (!document.hidden) load(true); }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const ticker = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const switchAgent = (id: string) => {
    setSelectedAgentId(id);
    setInsightFilter('all');
  };

  const handleTrigger = async () => {
    setTriggerLoading(true);
    const res = await triggerManualRun(selectedAgentId);
    if (res.ok) {
      setToast({ msg: 'Agent đang chạy phân tích...', type: 'success' });
      setTimeout(load, 5000);
    } else {
      setToast({ msg: `Lỗi: ${res.error?.slice(0, 100)}`, type: 'error' });
    }
    setTriggerLoading(false);
  };

  const handleInsightAction = async (id: string, action: 'reviewed' | 'dismissed') => {
    const ok = await updateInsightStatus(id, action, currentUser.id);
    if (ok) {
      setInsights(prev => prev.map(i => i.id === id ? { ...i, status: action } : i));
      setToast({ msg: action === 'reviewed' ? 'Đã đánh dấu xem xét' : 'Đã bỏ qua', type: 'success' });
    }
  };

  const filteredInsights = insights.filter(i => {
    if (insightFilter === 'all') return true;
    if (insightFilter === 'new') return i.status === 'new';
    if (insightFilter === 'action_required') return i.type === 'action_required';
    return true;
  });

  const hasNoData = runs.length === 0 && insights.length === 0 && episodes.length === 0;

  // KPI week delta
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const thisWeekRuns = runs.filter(r => now - new Date(r.created_at).getTime() < WEEK).length;
  const lastWeekRuns = runs.filter(r => { const age = now - new Date(r.created_at).getTime(); return age >= WEEK && age < 2 * WEEK; }).length;
  const runsDelta = lastWeekRuns > 0 ? Math.round(((thisWeekRuns - lastWeekRuns) / lastWeekRuns) * 100) : null;

  const tabs = { insights: 'Insights', runs: 'Lịch sử chạy', memory: 'Bộ nhớ', chat: 'Chat', config: 'Cài đặt' };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fadeInUp">
          <div className={`px-4 py-3 rounded-xl text-sm font-semibold border ${
            toast.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {toast.msg}
          </div>
        </div>
      )}

      <Navbar
        theme="dark"
        currentUser={currentUser}
        activeTab={activeTab}
        accessibleTabs={Object.keys(tabs)}
        onTabChange={setActiveTab}
        onLogout={onBack}
        onBack={onBack}
        appName="AI Agent"
        tabLabels={tabs}
      />

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden relative z-10">

        {/* Left sidebar */}
        <AgentSidebar
          agents={allAgents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={switchAgent}
        />

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ═══ AgentHeader ═══ */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                    style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.2)' }}>
                    {agent?.avatar_emoji || '🤖'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h1 className="text-lg font-black text-white">{agent?.name || 'AI Agent'}</h1>
                      {agent?.is_active && (
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-[9px] font-bold uppercase tracking-widest text-green-400">Active</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-medium">
                      {agent?.role_title || 'AI Assistant'} • Model: <span className="text-white/60 font-mono">{agent?.model}</span>
                    </p>
                    {agent?.personality && (
                      <p className="text-xs text-neutral-600 mt-0.5 truncate max-w-lg">{agent.personality}</p>
                    )}
                    <p className="text-[10px] text-neutral-700 mt-1">cập nhật {timeAgoShort(lastUpdatedAt)}</p>
                  </div>
                </div>
                <button
                  onClick={handleTrigger}
                  disabled={triggerLoading}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50 shrink-0"
                  style={{ background: '#FF9500' }}
                >
                  {triggerLoading ? 'Đang chạy...' : '▶ Chạy phân tích ngay'}
                </button>
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
                    <div className="grid grid-cols-5 gap-3">
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
                        <div key={i} className="rounded-2xl border border-white/8 p-4 space-y-2"
                          style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{kpi.label}</p>
                            <KpiIcon emoji={kpi.icon} color={kpi.iconColor} />
                          </div>
                          <p className={`${kpi.isText ? 'text-sm' : 'text-2xl'} font-black text-white`}>{kpi.value}</p>
                          {kpi.sub && <p className="text-[10px] text-neutral-600">{kpi.sub}</p>}
                          {kpi.delta !== undefined && (
                            <p className={`text-[10px] font-semibold ${kpi.deltaPos === true ? 'text-green-400' : kpi.deltaPos === false ? 'text-red-400' : 'text-neutral-600'}`}>
                              {kpi.delta}
                            </p>
                          )}
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
        </main>

        {/* Right panel — Insights tab only */}
        {activeTab === 'insights' && !loading && !agentSwitching && (
          <AgentRightPanel
            runs={runs}
            insights={insights}
            stats={stats}
            onTabChange={setActiveTab}
            onTrigger={handleTrigger}
          />
        )}
      </div>
    </div>
  );
};

export default AiAgentApp;
```

- [ ] **Step 2: Verify build passes with zero errors**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build 2>&1
```

Expected output contains `✓ built in` and **no TypeScript errors**. If errors appear, fix them before committing.

- [ ] **Step 3: Commit**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms
git add apps/ai-agent/components/AiAgentApp.tsx
git commit -m "feat(ai-agent): refactor to 3-column layout — sidebar, enhanced header, KPI strip, right panel"
```

---

## Success Checklist (verify after all tasks complete)

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] Sidebar shows all agents; clicking switches active agent
- [ ] Sidebar collapse/expand persists in localStorage after page reload
- [ ] Right panel (AgentRightPanel) appears only on Insights tab
- [ ] Switching to Runs/Memory/Chat/Config tab hides right panel and expands main content
- [ ] InsightsPanel sort dropdown changes card order
- [ ] InsightsPanel pagination shows controls when >10 insights
- [ ] 👁 icon button marks insight as reviewed
- [ ] 🔖 and ⋯ buttons are visible but disabled
- [ ] Agent switching resets InsightsPanel to page 1 (via `key={selectedAgentId}`)
- [ ] 30s auto-refresh still runs in background (check network tab)
- [ ] KPI strip shows colored icon boxes
