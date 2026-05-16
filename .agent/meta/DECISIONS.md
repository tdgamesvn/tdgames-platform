# DECISIONS

## 2026-05-14 — Project memory will be file-based first
Decision:
- Use repository files as the canonical memory source for this project.
- Defer external/shared memory layers until the codebase and workflow stabilize.

Reason:
- easier to audit
- simpler to maintain
- better suited for project bootstrap

Impact:
- agent must keep `.agent/meta/PROJECT.md`, `.agent/meta/TASKS.md`, and `.agent/meta/LOG.md` updated

---

## 2026-05-14 — Preserve project-agent files outside the application codebase
Decision:
- Keep project-agent operations files under `.agent/meta/` and keep `.agent/WORKFLOW.md` as the workflow entrypoint.

Reason:
- keeps the repository root focused on application code and core project config
- still provides a stable, versioned source of truth for the project agent
- avoids relying only on ephemeral chat/session memory

Impact:
- root stays cleaner
- agent-management files are grouped under `.agent/meta/`
- references must use the new paths consistently

---

## 2026-05-14 — Respect GitNexus guidance before sensitive edits
Decision:
- For future code changes on important symbols, follow the GitNexus workflow documented in `.agent/meta/CLAUDE.md` before editing.

Reason:
- the repository explicitly depends on GitNexus for impact analysis and safe navigation
- reduces risk of broad unintended changes in a non-trivial codebase

Impact:
- project-agent should treat impact analysis as part of the normal edit workflow when changing core functions/classes/methods

---

## 2026-05-14 — Use a dedicated Telegram inbox mapping for tdgames-platforms
Decision:
- Attach a project-specific Telegram inbox configuration to `tdgames-platforms`, but keep file intake manual and operator-triggered.

Reason:
- avoids mixing external files across projects
- keeps a clean mapping between project, bot, chat, and inbox directory
- reduces accidental downloads/imports

Impact:
- Telegram file handling for this project should use `telegram-inbox` with `--project tdgames-platforms`
- no file should be downloaded or imported unless explicitly requested by the operator
