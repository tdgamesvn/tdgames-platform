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
async function syncAssignees(supabase: any, taskId: string, workerIds: string[], allMatched = false) {
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

  // Xoá bớt người trên ClickUp, không ai được thêm ⇒ phần % của người bị xoá chia lại cho người
  // còn lại theo tỷ lệ đang có (trước 30/9 bị bỏ trống: Amanda Waller còn 1 người mà 50%).
  // CHỈ khi mọi assignee ClickUp đều khớp worker — còn người ngoài app (vd Châu FL-010 đã nghỉ)
  // thì phần trống là của họ, không dồn cho người khác.
  const keptSum = kept.reduce((s, id) => s + (shareOf.get(id) || 0), 0);
  if (n === 0 && kept.length > 0 && keptSum < 100 && allMatched) {
    kept.forEach((id) => shareOf.set(id, keptSum > 0
      ? Math.floor((shareOf.get(id) || 0) * 100 / keptSum)
      : Math.floor(100 / kept.length)));
    const diff = 100 - kept.reduce((s, id) => s + (shareOf.get(id) || 0), 0);
    shareOf.set(kept[0], (shareOf.get(kept[0]) || 0) + diff);
  }

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

/**
 * email ClickUp → worker. BẢN SAO của clickup-auto-sync/buildResolver (2 edge function tách
 * runtime, không share file) — sửa 1 chỗ phải sửa cả 2.
 * 1 email ↔ nhiều worker: (1) task đã gán cho 1 trong số đó ⇒ giữ (sửa tay không bị đè);
 * (2) chưa gán ⇒ hồ sơ có start_date gần nhất mà ≤ ngày tạo task.
 */
function buildResolver(workers: any[], hrRows: any[]) {
  const startOf = new Map<string, string>();
  for (const h of hrRows) if (h.start_date) startOf.set(h.worker_id, String(h.start_date));
  const byEmail = new Map<string, { id: string; from: string }[]>();
  const add = (email: string | null, id: string) => {
    const k = (email || "").trim().toLowerCase();
    if (!k) return;
    const list = byEmail.get(k) || [];
    if (!list.some((c) => c.id === id)) list.push({ id, from: startOf.get(id) || "0000-00-00" });
    byEmail.set(k, list);
  };
  const active = new Set<string>();
  for (const w of workers) {
    add(w.email, w.id);
    if (w.is_active) active.add(w.id);
  }
  for (const h of hrRows) {
    if (!active.has(h.worker_id)) continue;
    for (const e of [h.email, h.work_email]) {
      const k = (e || "").trim().toLowerCase();
      if (k && !byEmail.has(k)) add(k, h.worker_id);
    }
  }

  const resolve = async (emails: string[], dateCreated: string | undefined, getCur: () => Promise<Set<string>>) => {
    const day = dateCreated ? new Date(parseInt(dateCreated)).toISOString().slice(0, 10) : "9999-12-31";
    const out = new Set<string>();
    let cur: Set<string> | null = null;
    for (const e of emails) {
      const c = byEmail.get(e);
      if (!c?.length) continue;
      if (c.length === 1) { out.add(c[0].id); continue; }
      cur ??= await getCur();
      const kept = c.find((x) => cur!.has(x.id));
      if (kept) { out.add(kept.id); continue; }
      const sorted = [...c].sort((a, b) => a.from.localeCompare(b.from));
      out.add((sorted.filter((x) => x.from <= day).pop() || sorted[0]).id);
    }
    return [...out];
  };
  // true ⇔ mọi assignee trên ClickUp đều khớp được 1 worker trong app
  const allMatched = (task: any, emails: string[]) =>
    emails.length === (task.assignees || []).length && emails.every((e) => byEmail.has(e));
  return Object.assign(resolve, { allMatched });
}

async function currentAssignees(supabase: any, clickupTaskId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("wf_tasks").select("wf_task_assignees(worker_id)").eq("clickup_task_id", clickupTaskId);
  return new Set((data || []).flatMap((r: any) => (r.wf_task_assignees || []).map((a: any) => a.worker_id)));
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
  // Ghép theo wf_workers.email TRƯỚC, rồi thêm email + work_email của hồ sơ HR đã liên kết.
  // Freelancer: wf_workers.email = email CÁ NHÂN (hrService.syncEmployeeToWorkforce) trong khi
  // ClickUp dùng email công việc ⇒ trước 2026-09-30 mọi task chỉ giao cho người đó bị bỏ qua
  // ("khong khop worker nao") — Đạt FL-011 thiếu task, FL-010/FT-014 chưa từng được sync.
  // Chỉ worker ĐANG HOẠT ĐỘNG mới được ghép thêm qua email HR — sếp chốt 30/9 không kéo
  // task cũ của người đã nghỉ (FL-010, FT-014) vào app thành dòng "chưa thanh toán".
  // 1 email ↔ nhiều worker (Linh fulltime → freelancer 26/9): xem buildResolver.
  const [{ data: workers }, { data: hrRows }] = await Promise.all([
    supabase.from("wf_workers").select("id, email, is_active"),
    supabase.from("hr_employees").select("worker_id, email, work_email, start_date").not("worker_id", "is", null),
  ]);
  const resolver = buildResolver(workers || [], hrRows || []);
  const matchedWorkerIds = await resolver(assigneeEmails, task.date_created, () => currentAssignees(supabase, taskId));

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
    await syncAssignees(supabase, existing.id, matchedWorkerIds, resolver.allMatched(task, assigneeEmails));
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
  await syncAssignees(supabase, inserted.id, matchedWorkerIds, resolver.allMatched(task, assigneeEmails));
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
