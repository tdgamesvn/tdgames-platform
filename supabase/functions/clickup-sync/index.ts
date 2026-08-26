import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const CLICKUP_BASE = "https://api.clickup.com/api/v2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Trước đây `Deno.serve` chạy thẳng vào logic, KHÔNG đọc một header nào.
 * Function này không giữ secret (token ClickUp do client gửi kèm) và không ghi DB, nên nó
 * không lộ dữ liệu công ty — nhưng nó là **open proxy có khuếch đại**: một POST vào
 * `sync_tasks` khiến server phân trang qua từng list, 1 request vào ⇒ hàng trăm request ra
 * api.clickup.com, đốt quota/egress Edge Function của dự án và cho người lạ mượn IP server.
 *
 * Quyền khớp với app Workforce: admin / ke_toan. Đọc `app_metadata`, KHÔNG phải
 * `user_metadata` (user_metadata do chính người dùng ghi được).
 */
async function requireStaff(req: Request): Promise<Response | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return jsonRes({ error: "Unauthorized: thiếu Authorization header" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return jsonRes({ error: "Unauthorized: token không hợp lệ" }, 401);

  const meta = (user.app_metadata || {}) as Record<string, unknown>;
  const roles = [meta.role, ...(Array.isArray(meta.secondary_roles) ? meta.secondary_roles : [])];
  if (!roles.some((r) => r === "admin" || r === "ke_toan")) {
    return jsonRes({ error: "Forbidden: cần quyền admin hoặc ke_toan" }, 403);
  }
  return null;
}

interface ClickUpMember {
  user: { id: number; username: string; email: string };
}

interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  status: { status: string };
  assignees: Array<{ id: number; username: string; email?: string }>;
  list: { id: string; name: string };
  folder: { id: string; name: string } | null;
  space: { id: string };
  date_done?: string;
  date_created?: string;
  date_updated?: string;
  custom_fields?: any[];
}

interface ListContext {
  list_id: string;
  list_name: string;
  folder_name: string | null;
  space_name: string;
}

async function clickupFetch(path: string, token: string) {
  const resp = await fetch(`${CLICKUP_BASE}${path}`, {
    headers: { Authorization: token, "Content-Type": "application/json" },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickUp API error ${resp.status}: ${text}`);
  }
  return resp.json();
}

// id từ body nội suy thẳng vào path ⇒ `..%2F` đổi được endpoint ClickUp. Encode hết.
const seg = (v: unknown) => encodeURIComponent(String(v ?? ""));

async function getTeams(token: string) {
  const data = await clickupFetch("/team", token);
  return data.teams || [];
}

async function getSpaces(token: string, teamId: string) {
  const data = await clickupFetch(`/team/${seg(teamId)}/space?archived=false`, token);
  return data.spaces || [];
}

async function getSpaceLists(token: string, spaceId: string) {
  const listsData = await clickupFetch(`/space/${seg(spaceId)}/list?archived=false`, token);
  const lists = (listsData.lists || []).map((l: any) => ({ id: l.id, name: l.name, folder: null }));

  const foldersData = await clickupFetch(`/space/${seg(spaceId)}/folder?archived=false`, token);
  for (const folder of foldersData.folders || []) {
    for (const l of folder.lists || []) {
      lists.push({ id: l.id, name: l.name, folder: folder.name });
    }
  }
  return lists;
}

async function getTeamMembers(token: string, teamId: string): Promise<Map<number, string>> {
  const data = await clickupFetch(`/team/${seg(teamId)}`, token);
  const team = data.team || data;
  const members: ClickUpMember[] = team.members || [];
  const emailMap = new Map<number, string>();
  for (const m of members) {
    if (m.user?.email) {
      emailMap.set(m.user.id, m.user.email.toLowerCase());
    }
  }
  return emailMap;
}

async function getListTasks(token: string, listId: string): Promise<ClickUpTask[]> {
  const allTasks: ClickUpTask[] = [];
  let page = 0;
  while (true) {
    const data = await clickupFetch(
      `/list/${seg(listId)}/task?archived=false&include_closed=true&subtasks=true&page=${page}`,
      token,
    );
    const tasks = data.tasks || [];
    allTasks.push(...tasks);
    if (tasks.length < 100) break;
    page++;
    // ponytail: chặn cứng 100 trang. ClickUp trả 100 task/trang nên đây là 10k task/list —
    // xa hơn mọi list thật, mà vẫn không để vòng lặp chạy vô hạn nếu API đổi hành vi.
    if (page > 100) break;
  }
  return allTasks;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const { action, token, teamId, spaceId, listIds, listContexts } = await req.json();

    if (!token) {
      return jsonRes({ error: "Missing API token" }, 400);
    }

    let result: any;

    switch (action) {
      case "get_teams": {
        const teams = await getTeams(token);
        result = { teams: teams.map((t: any) => ({ id: t.id, name: t.name })) };
        break;
      }

      case "get_spaces": {
        if (!teamId) throw new Error("Missing teamId");
        const spaces = await getSpaces(token, teamId);
        result = { spaces: spaces.map((s: any) => ({ id: s.id, name: s.name })) };
        break;
      }

      case "get_lists": {
        if (!spaceId) throw new Error("Missing spaceId");
        const lists = await getSpaceLists(token, spaceId);
        result = { lists };
        break;
      }

      case "sync_tasks": {
        if (!teamId) throw new Error("Missing teamId");

        const contexts: ListContext[] = listContexts || [];
        const resolvedListIds: string[] = listIds || contexts.map((c: ListContext) => c.list_id);

        if (resolvedListIds.length === 0) {
          throw new Error("Missing listIds or listContexts");
        }

        // Use frontend-provided listContexts directly (no redundant API calls)
        // Frontend already fetched all spaces & lists dynamically
        const contextMap = new Map<string, ListContext>();
        for (const ctx of contexts) {
          contextMap.set(ctx.list_id, ctx);
        }

        // 1. Get team members email map (1 API call)
        const emailMap = await getTeamMembers(token, teamId);

        // 2. Fetch tasks from all lists (1 API call per list)
        const allTasks: any[] = [];
        for (const listId of resolvedListIds) {
          const tasks = await getListTasks(token, listId);
          const ctx = contextMap.get(listId);

          for (const task of tasks) {
            const assigneeEmails = task.assignees.map((a) => {
              return (a.email || emailMap.get(a.id) || "").toLowerCase();
            }).filter(Boolean);

            allTasks.push({
              clickup_task_id: task.id,
              title: task.name,
              clickup_status: task.status?.status || "",
              clickup_list_id: task.list?.id || listId,
              list_name: ctx?.list_name || task.list?.name || "",
              folder_name: ctx?.folder_name || null,
              space_name: ctx?.space_name || "",
              assignee_emails: assigneeEmails,
              date_done: task.date_done ? new Date(parseInt(task.date_done)).toISOString() : null,
              date_created: task.date_created ? new Date(parseInt(task.date_created)).toISOString() : null,
              date_updated: task.date_updated ? new Date(parseInt(task.date_updated)).toISOString() : null,
            });
          }
        }

        result = { tasks: allTasks, member_count: emailMap.size };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return jsonRes(result);
  } catch (err: any) {
    return jsonRes({ error: err.message }, 500);
  }
});
