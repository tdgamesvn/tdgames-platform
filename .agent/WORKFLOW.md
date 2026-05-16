# AGENT WORKFLOW

## Mandatory Read Order
1. .agent/meta/PROJECT.md
2. .agent/meta/TASKS.md
3. .agent/meta/DECISIONS.md
4. .agent/WORKFLOW.md

## Execution Rules
- Work only within the tdgames-platforms project scope
- Keep changes minimal, reversible, and reviewable
- If starting a task from To do, move it to Doing first
- Only work on one main task at a time unless explicitly instructed
- Do not guess infra/secrets/runtime details; inspect and document them
- Before editing important functions/classes/methods, follow the GitNexus guidance in `.agent/meta/CLAUDE.md` and assess impact where applicable

## Update Rules
After each meaningful work session, update:
- .agent/meta/TASKS.md
- .agent/meta/LOG.md

If a durable technical decision is made, update:
- .agent/meta/DECISIONS.md

If intake happens through Telegram project inbox, record the import source and intended use in .agent/meta/LOG.md when it becomes relevant to project work.

## Reporting Format
Each report should include:
1. Task name
2. Files changed
3. Summary of work
4. Validation performed
5. Risks / next steps

## Safety Rules
- No production deploys
- No secret changes
- No destructive file operations without approval
- Ask before integrating external services such as Telegram bot tokens
- Do not assume `.env.local` or Supabase configuration is safe or complete without inspection
- Telegram inbox intake is manual-only: do not download or import files unless explicitly instructed by the operator
