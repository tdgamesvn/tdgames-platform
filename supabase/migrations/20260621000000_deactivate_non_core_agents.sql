-- Deactivate 6 non-core agents, keeping only CHRO, CFO, CTO, BD active.
-- Part of: AI Agent Simplify & Unified Feed (spec 2026-06-21)
UPDATE ai_agents
SET is_active = false
WHERE id IN ('ceo', 'pm', 'sales', 'ops', 'data', 'support');
