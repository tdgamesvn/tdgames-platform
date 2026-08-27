import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CLICKUP_BASE = "https://api.clickup.com/api/v2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
}

function mapStatus(clickupStatus: string): string {
  const lower = clickupStatus.toLowerCase();
  if (["closed", "done", "complete", "approved"].some((s) => lower.includes(s))) return "approved";
  if (["rejected", "cancelled", "canceled"].some((s) => lower.includes(s))) return "rejected";
  if (lower.includes("client")) return "in_progress";
  if (["review", "qa", "testing"].some((s) => lower.includes(s))) return "completed";
  return "in_progress";
}

async function clickupFetch(path: string, token: string) {
  const resp = await fetch(`${CLICKUP_BASE}${path}`, {
    headers: { Authorization: token, "Content-Type": "application/json" },
  });
  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error(`ClickUp API error ${resp.status}: ${text}`);
    (err as any).status = resp.status; // để phân biệt 404 (task bị xoá thật) với lỗi mạng/quota
    throw err;
  }
  return resp.json();
}

/**
 * Đồng bộ người làm sang wf_task_assignees (nguồn sự thật từ 2026-08-19).
 * Giữ nguyên share_pct + payment_status của người đã có; người mới chỉ nhận phần %
 * còn trống. wf_tasks.payment_status do trigger sync_task_payment_status lo.
 */
async function syncAssignees(supabase: any, taskId: string, workerIds: string[]) {
  if (workerIds.length === 0) return;
  const { data: cur } = await supabase
    .from("wf_task_assignees").select("worker_id, share_pct, payment_status").eq("task_id", taskId);
  const shareOf = new Map<string, number>((cur || []).map((a: any) => [a.worker_id, Number(a.share_pct)]));
  const paidOf = new Map<string, string>((cur || []).map((a: any) => [a.worker_id, a.payment_status]));

  // Không đổi người ⇒ khỏi đụng (tránh ghi đè % sếp chỉnh tay mỗi lần webhook bắn).
  if (workerIds.length === shareOf.size && workerIds.every((id) => shareOf.has(id))) return;

  const kept = workerIds.filter((id) => shareOf.has(id));
  const added = workerIds.filter((id) => !shareOf.has(id));
  const rest = Math.max(0, 100 - kept.reduce((s, id) => s + (shareOf.get(id) || 0), 0));
  const n = added.length;
  const base = n > 0 ? Math.floor(rest / n) : 0;

  const rows = [
    ...kept.map((id) => ({ task_id: taskId, worker_id: id, share_pct: shareOf.get(id) })),
    ...added.map((id, i) => ({
      task_id: taskId,
      worker_id: id,
      share_pct: i === 0 ? rest - base * (n - 1) : base,
    })),
  ].map((r) => ({ ...r, payment_status: paidOf.get(r.worker_id) || "unpaid" }));

  await supabase.from("wf_task_assignees").delete().eq("task_id", taskId);
  const { error } = await supabase.from("wf_task_assignees").insert(rows);
  if (error) console.error(`[clickup-webhook] assignee insert failed task=${taskId}:`, error.message);
}

async function handleWebhookEvent(body: any) {
  const supabase = getSupabaseAdmin();
  const event = body.event;
  const taskId = body.task_id;

  console.log(`[clickup-webhook] event=${event} task_id=${taskId}`);

  if (!taskId) return { ok: true, skipped: true, reason: "no task_id" };

  const { data: config } = await supabase
    .from("wf_clickup_config").select("*").limit(1).single();
  if (!config?.api_token) return { ok: true, skipped: true, reason: "no config" };

  // ── Không tin body, hỏi lại ClickUp (sửa 2026-08-26) ────────────────────────
  // Endpoint này verify_jwt=false và ClickUp KHÔNG lưu webhook secret ở đâu trong hệ
  // thống (wf_clickup_config không có cột nào giữ nó) ⇒ không verify HMAC được nếu
  // không đăng ký lại webhook. Trước đây `body.event` được tin tuyệt đối, nên:
  //   curl -X POST .../clickup-webhook -d '{"event":"taskDeleted","task_id":"<id>"}'
  // xoá thẳng dòng wf_tasks (kèm assignee theo cascade) mà không cần xác thực gì —
  // lặp qua danh sách id là xoá sạch bảng công việc freelancer.
  //
  // Chặn bằng cách bỏ tin `event`: LUÔN hỏi ClickUp bằng api_token công ty.
  //   404 ⇒ task đã bị xoá thật ⇒ mới được xoá dòng DB.
  //   200 ⇒ đồng bộ theo dữ liệu ClickUp trả về (event giả cũng chỉ ra đúng dữ liệu thật).
  //   lỗi khác (mạng/quota/401) ⇒ bỏ qua, KHÔNG xoá.
  // Rẻ hơn HMAC (không phải đăng ký lại webhook, không thêm secret).
  // ponytail: kẻ có task_id thật vẫn ép đồng bộ lại được — kết quả y hệt webhook thật
  // nên vô hại; syncAssignees đã tự no-op khi danh sách người làm không đổi.
  // encodeURIComponent chặn path traversal `../` trong task_id ghép vào URL ClickUp.
  let task;
  try {
    task = await clickupFetch(`/task/${encodeURIComponent(taskId)}`, config.api_token);
  } catch (e: any) {
    if (e?.status === 404) {
      const { data: existing } = await supabase
        .from("wf_tasks").select("id").eq("clickup_task_id", taskId).maybeSingle();
      if (existing) {
        await supabase.from("wf_tasks").delete().eq("id", existing.id);
        return { ok: true, action: "deleted", taskId };
      }
      return { ok: true, skipped: true, reason: "task not in DB" };
    }
    console.error(`[clickup-webhook] fetch task ${taskId} failed:`, e.message);
    return { ok: true, skipped: true, reason: `fetch failed: ${e.message}` };
  }

  const emailMap = new Map<number, string>();
  try {
    const teamData = await clickupFetch(`/team/${config.team_id}`, config.api_token);
    const team = teamData.team || teamData;
    for (const m of team.members || []) {
      if (m.user?.email) emailMap.set(m.user.id, m.user.email.toLowerCase());
    }
  } catch {
    // tiếp tục, dựa vào a.email
  }

  const assigneeEmails = (task.assignees || [])
    .map((a: any) => (a.email || emailMap.get(a.id) || "").toLowerCase())
    .filter(Boolean);

  // TẤT CẢ người khớp, không dừng ở người đầu tiên (task nhiều người).
  const { data: workers } = await supabase.from("wf_workers").select("id, email");
  const emailToWorkerId = new Map<string, string>();
  for (const w of workers || []) {
    if (w.email) emailToWorkerId.set(w.email.toLowerCase(), w.id);
  }
  const matchedWorkerIds = [
    ...new Set(assigneeEmails.map((e: string) => emailToWorkerId.get(e)).filter(Boolean)),
  ] as string[];

  if (matchedWorkerIds.length === 0) {
    console.log(`[clickup-webhook] skip task=${taskId} — khong khop worker nao. emails=${JSON.stringify(assigneeEmails)}`);
    return { ok: true, skipped: true, reason: "no worker match", assigneeEmails };
  }

  const listId = task.list?.id || "";
  let spaceName = "";
  let folderName: string | null = null;
  let listName = task.list?.name || "";
  for (const space of config.spaces || []) {
    for (const list of space.lists || []) {
      if (list.id === listId) {
        spaceName = space.name;
        folderName = list.folder || null;
        listName = list.name;
        break;
      }
    }
  }

  const clickupStatus = task.status?.status || "";
  const ourStatus = mapStatus(clickupStatus);
  const startDate = task.date_created
    ? new Date(parseInt(task.date_created)).toISOString().split("T")[0]
    : null;
  let closedDate = task.date_done
    ? new Date(parseInt(task.date_done)).toISOString().split("T")[0]
    : null;
  if (!closedDate && (ourStatus === "approved" || ourStatus === "completed") && task.date_updated) {
    closedDate = new Date(parseInt(task.date_updated)).toISOString().split("T")[0];
  }
  // Moc "task con dong" tren ClickUp. Dashboard dung lam fallback cuoi khi
  // completed_at/closed_date trong (task client_review) — thieu cot nay task roi khoi moi thang.
  const clickupUpdatedAt = task.date_updated
    ? new Date(parseInt(task.date_updated)).toISOString().split("T")[0]
    : null;

  const { data: existingRows } = await supabase
    .from("wf_tasks").select("id").eq("clickup_task_id", taskId);

  // 1 clickup_task_id = 1 dong wf_tasks. Nhieu dong = du lieu cu chua don ⇒ khong doan bua.
  if (existingRows && existingRows.length > 1) {
    return { ok: true, skipped: true, reason: "duplicate rows for clickup_task_id", taskId };
  }
  const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

  if (existing) {
    await supabase.from("wf_tasks").update({
      title: task.name,
      clickup_status: clickupStatus,
      status: ourStatus,
      start_date: startDate,
      closed_date: closedDate,
      completed_at: closedDate,
      clickup_updated_at: clickupUpdatedAt,
      clickup_space_name: spaceName || null,
      clickup_folder_name: folderName,
      clickup_list_name: listName || null,
      synced_at: new Date().toISOString(),
    }).eq("id", existing.id);
    await syncAssignees(supabase, existing.id, matchedWorkerIds);
    return { ok: true, action: "updated", taskId, title: task.name, assignees: matchedWorkerIds.length };
  }

  // ponytail: upsert — ClickUp bắn 2 webhook cách nhau vài ms cho cùng 1 task mới, hai
  // lần chạy song song cùng thấy "chưa có" rồi cùng chèn (11 task trùng, migration
  // 20260827180000). Unique constraint chặn ở DB, upsert biến kẻ thua race thành UPDATE.
  const { data: inserted, error: insErr } = await supabase.from("wf_tasks").upsert({
    project: folderName || listName || "",
    client_name: spaceName || "",
    title: task.name,
    clickup_task_id: taskId,
    clickup_list_id: listId,
    clickup_status: clickupStatus,
    clickup_space_name: spaceName || null,
    clickup_folder_name: folderName,
    clickup_list_name: listName || null,
    status: ourStatus,
    price: 0,
    currency: "VND",
    exchange_rate: 0,
    bonus: 0,
    bonus_note: "",
    start_date: startDate,
    closed_date: closedDate,
    completed_at: closedDate,
    clickup_updated_at: clickupUpdatedAt,
    approved_at: ourStatus === "approved" ? (closedDate || new Date().toISOString().split("T")[0]) : null,
    payment_status: "unpaid",
    notes: "",
    synced_at: new Date().toISOString(),
  }, { onConflict: "clickup_task_id" }).select("id").single();

  if (insErr || !inserted) {
    console.error(`[clickup-webhook] insert failed task=${taskId}:`, insErr?.message);
    return { ok: false, error: insErr?.message, taskId };
  }
  await syncAssignees(supabase, inserted.id, matchedWorkerIds);
  return { ok: true, action: "inserted", taskId, title: task.name, assignees: matchedWorkerIds.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    if (body.event === "test" || body.event === undefined) {
      return new Response(JSON.stringify({ ok: true, message: "Webhook endpoint ready" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = await handleWebhookEvent(body);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[clickup-webhook] error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
