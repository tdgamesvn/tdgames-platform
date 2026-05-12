---
name: gitnexus-cli
description: "Use when the user needs to run GitNexus CLI commands like analyze/index a repo, check status, clean the index, generate a wiki, or list indexed repos. Examples: \"Index this repo\", \"Reanalyze the codebase\", \"Generate a wiki\""
---

# GitNexus CLI Commands

All commands work via `npx` — no global install required.

## Commands

### analyze — Build or refresh the index

```bash
npx gitnexus analyze
```

Run from the project root. This parses all source files, builds the knowledge graph, writes it to `.gitnexus/`, and generates CLAUDE.md / AGENTS.md context files.

| Flag           | Effect                                                           |
| -------------- | ---------------------------------------------------------------- |
| `--force`      | Force full re-index even if up to date                           |
| `--embeddings` | Enable embedding generation for semantic search (off by default) |
| `--drop-embeddings` | Drop existing embeddings on rebuild. By default, an `analyze` without `--embeddings` preserves them. |

**When to run:** First time in a project, after major code changes, or when `gitnexus://repo/{name}/context` reports the index is stale. In Claude Code, a PostToolUse hook detects staleness after `git commit` and `git merge` and notifies the agent to run `analyze` — the hook does not run analyze itself, to avoid blocking the agent for up to 120s and risking KuzuDB corruption on timeout.

### status — Check index freshness

```bash
npx gitnexus status
```

Shows whether the current repo has a GitNexus index, when it was last updated, and symbol/relationship counts. Use this to check if re-indexing is needed.

### clean — Delete the index

```bash
npx gitnexus clean
```

Deletes the `.gitnexus/` directory and unregisters the repo from the global registry. Use before re-indexing if the index is corrupt or after removing GitNexus from a project.

| Flag      | Effect                                            |
| --------- | ------------------------------------------------- |
| `--force` | Skip confirmation prompt                          |
| `--all`   | Clean all indexed repos, not just the current one |

### wiki — Generate documentation from the graph

```bash
npx gitnexus wiki
```

Generates repository documentation from the knowledge graph using an LLM. Requires an API key (saved to `~/.gitnexus/config.json` on first use).

| Flag                | Effect                                    |
| ------------------- | ----------------------------------------- |
| `--force`           | Force full regeneration                   |
| `--model <model>`   | LLM model (default: minimax/minimax-m2.5) |
| `--base-url <url>`  | LLM API base URL                          |
| `--api-key <key>`   | LLM API key                               |
| `--concurrency <n>` | Parallel LLM calls (default: 3)           |
| `--gist`            | Publish wiki as a public GitHub Gist      |

### list — Show all indexed repos

```bash
npx gitnexus list
```

Lists all repositories registered in `~/.gitnexus/registry.json`. The MCP `list_repos` tool provides the same information.

## After Indexing

1. **Read `gitnexus://repo/{name}/context`** to verify the index loaded
2. Use the other GitNexus skills (`exploring`, `debugging`, `impact-analysis`, `refactoring`) for your task

## Troubleshooting

- **"Not inside a git repository"**: Run from a directory inside a git repo
- **Index is stale after re-analyzing**: Restart Claude Code to reload the MCP server
- **Embeddings slow**: Omit `--embeddings` (it's off by default) or set `OPENAI_API_KEY` for faster API-based embedding

### Node / npm (Windows)

- **GitNexus 1.6.x** declares **`node >= 22`**. Dùng Node 20 có thể vẫn chạy được CLI sau khi cài nhưng nên nâng Node (nvm: `nvm install 22 && nvm use 22`) để khớp engine và tránh lỗi native addon.
- **`npm ERR! Cannot set properties of null (setting 'peer')`** khi chạy `npx -y gitnexus@latest …`: lỗi Arborist của npm 10.x với một số cây phụ thuộc. Cách ổn định: trong **root repo** chạy  
  `npm install gitnexus@^1.6.4 --save-dev --legacy-peer-deps`  
  rồi dùng `npx gitnexus …` / `npm run gitnexus:analyze` (dùng bản cục bộ trong `node_modules`).
- **`gitnexus setup`**: cấu hình MCP Cursor (và có thể Codex). Trên Windows, nếu `npx` vẫn lỗi, setup có thể trỏ MCP tới `node_modules\\.bin\\gitnexus.cmd` của repo — **chỉ hoạt động khi đường dẫn đó tồn tại**; với nhiều repo có thể cài `gitnexus` devDependency ở mỗi repo hoặc dùng Node 22+ và cấu hình thủ công theo [Cursor Setup](https://abhigyanpatwari-gitnexus.mintlify.app/mcp/cursor) (`cmd /c npx -y gitnexus@latest mcp`).

### MCP Cursor (`Connection closed`, tool không chạy)

1. Trong repo: `npm run gitnexus:analyze` (hoặc `npx gitnexus analyze`) — index phải tương ứng commit hiện tại.
2. **Khởi động lại Cursor** sau khi sửa `~/.cursor/mcp.json` hoặc sau `analyze` lớn.
3. Kiểm tra MCP thủ công: trong terminal `npx gitnexus mcp` — process phải đứng yên chờ (không thoát ngay); nếu crash, xem stack trace.
4. Không nhúng secret (token API) vào `mcp.json` nếu tránh được — dùng biến môi trường hoặc file riêng theo hướng dẫn Cursor.
