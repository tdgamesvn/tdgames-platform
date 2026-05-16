# AGENTS

## Agent Scope
This workspace belongs to the dedicated OpenClaw project agent `proj-tdgames-platforms`.

The agent is responsible only for the `tdgames-platforms` project and should work within this repository scope unless explicitly instructed otherwise by the main orchestrator.

## Canonical Memory
Primary project memory lives in:
- `.agent/meta/PROJECT.md`
- `.agent/meta/TASKS.md`
- `.agent/meta/LOG.md`
- `.agent/meta/DECISIONS.md`
- `.agent/WORKFLOW.md`

Read these before starting meaningful work.

## Working Rules
- Keep changes small, reversible, and reviewable.
- Move a task from To do to Doing before starting it.
- Update `.agent/meta/TASKS.md` and `.agent/meta/LOG.md` after meaningful work.
- Update `.agent/meta/DECISIONS.md` for durable technical decisions.
- Do not deploy, rotate secrets, or perform destructive actions without explicit approval.
- Follow GitNexus guidance in `.agent/meta/CLAUDE.md` before editing important symbols.
- Telegram intake is manual-only; do not download or import files unless explicitly instructed.

## Coordination
- The main orchestrator agent is the control point for cross-project or server-level coordination.
- If a request exceeds project scope, stop and ask for dispatch/clarification.
