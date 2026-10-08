import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CLICKUP_BASE = "https://api.clickup.com/api/v2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
}

/**
 * Auth: x-cron-secret (pg_cron) HOẶC Bearer JWT hợp lệ. Thiếu cả hai → 401.
 * Mẫu copy từ outreach-auto-batch. Không có client nào trong app gọi hàm này,
 * chỉ cron clickup-auto-sync-hourly (0 * * * *, từ 2026-09-30; secret đọc runtime trong cron.job).
 * Trả về null nếu hợp lệ, Response 401 nếu không.
 */
async function requireCronOrUser(req: Request): Promise<Response | null> {
  const deny = (detail: string) =>
    new Response(JSON.stringify({ ok: false, detail }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const cronSecret = req.headers.get("x-cron-secret");
  const auth = req.headers.get("Authorization");

  if (cronSecret) {
    const { data } = await getSupabaseAdmin()
      .from("crm_outreach_config").select("value").eq("key", "cron_secret").single();
    const expected = data?.value as string | undefined;
    if (!expected || cronSecret !== expected) return deny("Invalid cron secret");
    return null;
  }

  if (auth?.startsWith("Bearer ")) {
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return deny("Invalid session");
    return null;
  }

  return deny("Missing auth: provide x-cron-secret or Authorization Bearer");
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

function mapStatus(clickupStatus: string): string {
  const lower = clickupStatus.toLowerCase();
  if (["closed", "done", "complete", "approved"].some((s) => lower.includes(s))) return "approved";
  if (["rejected", "cancelled", "canceled"].some((s) => lower.includes(s))) return "rejected";
  if (lower.includes("client")) return "in_progress";
  if (["review", "qa", "testing"].some((s) => lower.includes(s))) return "completed";
  return "in_progress";
}

interface ListInfo {
  id: string;
  name: string;
  folder: string | null;
  space_name: string;
}

async function getAllLists(token: string, teamId: string): Promise<ListInfo[]> {
  const spacesData = await clickupFetch(`/team/${teamId}/space?archived=false`, token);
  const spaces = spacesData.spaces || [];
  const allLists: ListInfo[] = [];

  for (const space of spaces) {
    const listsData = await clickupFetch(`/space/${space.id}/list?archived=false`, token);
    for (const l of listsData.lists || []) {
      allLists.push({ id: l.id, name: l.name, folder: null, space_name: space.name });
    }
    const foldersData = await clickupFetch(`/space/${space.id}/folder?archived=false`, token);
    for (const folder of foldersData.folders || []) {
      for (const l of folder.lists || []) {
        allLists.push({ id: l.id, name: l.name, folder: folder.name, space_name: space.name });
      }
    }
  }
  return allLists;
}

async function getListTasks(token: string, listId: string): Promise<any[]> {
  const allTasks: any[] = [];
  let page = 0;
  while (true) {
    const data = await clickupFetch(
      `/list/${listId}/task?archived=false&include_closed=true&subtasks=true&page=${page}`,
      token
    );
    const tasks = data.tasks || [];
    allTasks.push(...tasks);
    if (tasks.length < 100) break;
    page++;
  }
  return allTasks;
}

/**
 * Đồng bộ người làm sang wf_task_assignees (nguồn sự thật từ 2026-08-19).
 * Giữ nguyên share_pct + payment_status đã có; người mới chỉ nhận phần % còn trống.
 */
async function syncAssignees(supabase: any, taskId: string, workerIds: string[], allMatched = false) {
  if (workerIds.length === 0) return;
  const { data: cur } = await supabase
    .from("wf_task_assignees").select("worker_id, share_pct, payment_status").eq("task_id", taskId);
  const shareOf = new Map<string, number>((cur || []).map((a: any) => [a.worker_id, Number(a.share_pct)]));
  const paidOf = new Map<string, string>((cur || []).map((a: any) => [a.worker_id, a.payment_status]));

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

  // ponytail: delete+insert không có transaction ⇒ 2 lượt sync chạy song song có thể
  // nhân đôi/mất share_pct. Chỉ xảy ra khi bị gọi dồn; guard auth ở trên đã chặn nguồn
  // gọi dồn duy nhất (Internet). Nâng cấp khi cần: advisory lock theo task_id.
  await supabase.from("wf_task_assignees").delete().eq("task_id", taskId);
  const { error } = await supabase.from("wf_task_assignees").insert(rows);
  if (error) console.error(`[clickup-auto-sync] assignee insert failed task=${taskId}:`, error.message);
}

/**
 * email ClickUp → worker. wf_workers.email ưu tiên; email + work_email của hồ sơ HR (worker
 * ĐANG HOẠT ĐỘNG) chỉ bổ sung khi email đó chưa có worker nào (freelancer có wf_workers.email =
 * email cá nhân ≠ email ClickUp — Đạt FL-011 thiếu task 30/9).
 *
 * 1 email ↔ NHIỀU worker: NV nghỉ fulltime rồi hợp tác freelancer, dùng lại email công ty
 * trên ClickUp (Linh FT-014 → hồ sơ freelancer từ 26/9, sếp chốt 30/9). Chọn:
 *   1. task đã gán cho 1 trong các worker đó (kể cả gán tay) ⇒ GIỮ — nhờ vậy sửa tay ngoại lệ
 *      (task Amanda Waller tạo 18/9 nhưng làm dưới dạng freelancer) không bị sync đè.
 *   2. chưa gán ⇒ theo ngày tạo task: hồ sơ có start_date gần nhất mà ≤ ngày tạo.
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
    if (!active.has(h.worker_id)) continue; // không kéo task cũ của người đã nghỉ
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

async function runAutoSync() {
  const supabase = getSupabaseAdmin();
  const log: string[] = [];

  const { data: config } = await supabase
    .from("wf_clickup_config").select("*").limit(1).single();
  if (!config?.api_token || !config?.team_id) {
    return { ok: false, error: "No ClickUp config found" };
  }
  log.push(`Config loaded: team=${config.team_name}`);

  const allLists = await getAllLists(config.api_token, config.team_id);
  log.push(`Found ${allLists.length} lists`);
  if (allLists.length === 0) return { ok: true, message: "No lists found", log };

  const teamData = await clickupFetch(`/team/${config.team_id}`, config.api_token);
  const team = teamData.team || teamData;
  const emailMap = new Map<number, string>();
  for (const m of team.members || []) {
    if (m.user?.email) emailMap.set(m.user.id, m.user.email.toLowerCase());
  }
  log.push(`Team members: ${emailMap.size}`);

  // Ghép theo wf_workers.email TRƯỚC, rồi thêm email + work_email của hồ sơ HR đã liên kết —
  // freelancer có wf_workers.email = email cá nhân ≠ email ClickUp (xem clickup-webhook).
  const [{ data: workers }, { data: hrRows }] = await Promise.all([
    supabase.from("wf_workers").select("id, email, is_active"),
    supabase.from("hr_employees").select("worker_id, email, work_email, start_date").not("worker_id", "is", null),
  ]);
  const resolver = buildResolver(workers || [], hrRows || []);
  // Email ClickUp không khớp ai ⇒ log 1 lần/lượt để lần sau thiếu task là thấy ngay.
  const unmatched = new Set<string>();

  let synced = 0;
  let skipped = 0;
  let errors = 0;
  let dupes = 0;

  for (const list of allLists) {
    try {
      const tasks = await getListTasks(config.api_token, list.id);

      for (const task of tasks) {
        const assigneeEmails = (task.assignees || [])
          .map((a: any) => (a.email || emailMap.get(a.id) || "").toLowerCase())
          .filter(Boolean);

        // TẤT CẢ người khớp, không dừng ở người đầu tiên.
        const workerIds = await resolver(assigneeEmails, task.date_created, () => currentAssignees(supabase, task.id));

        if (workerIds.length === 0) {
          assigneeEmails.forEach((e: string) => unmatched.add(e));
          skipped++;
          continue;
        }

        const clickupStatus = task.status?.status || "";
        const ourStatus = mapStatus(clickupStatus);
        // Hạn chót ClickUp (ms, UTC) → ngày theo giờ VN, null nếu không đặt hạn. App Dự án dùng để tính trễ hạn.
        const dueDate = task.due_date
          ? new Date(parseInt(task.due_date) + 7 * 3600_000).toISOString().split("T")[0]
          : null;
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
          .from("wf_tasks").select("id").eq("clickup_task_id", task.id);

        // 1 clickup_task_id = 1 dong. Nhieu dong = du lieu cu chua don ⇒ bo qua, don tay.
        if (existingRows && existingRows.length > 1) { dupes++; continue; }
        const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

        if (existing) {
          const { error: updErr } = await supabase.from("wf_tasks").update({
            title: task.name,
            clickup_status: clickupStatus,
            status: ourStatus,
            start_date: startDate,
            due_date: dueDate,
            closed_date: closedDate,
            completed_at: closedDate,
            clickup_updated_at: clickupUpdatedAt,
            clickup_space_name: list.space_name,
            clickup_folder_name: list.folder,
            clickup_list_name: list.name,
            clickup_list_id: list.id,
            synced_at: new Date().toISOString(),
          }).eq("id", existing.id);
          // Trước đây không check ⇒ update lỗi vẫn đếm synced, log báo errors=0.
          if (updErr) {
            console.error(`[clickup-auto-sync] update failed task=${task.id}:`, updErr.message);
            errors++;
            continue;
          }
          await syncAssignees(supabase, existing.id, workerIds, resolver.allMatched(task, assigneeEmails));
        } else {
          // ponytail: upsert — auto-sync có thể chạy trùng lúc webhook bắn, cả hai cùng
          // thấy "chưa có" rồi cùng chèn (11 task trùng, migration 20260827180000).
          // Unique constraint chặn ở DB, upsert biến kẻ thua race thành UPDATE.
          const { data: inserted, error: insErr } = await supabase.from("wf_tasks").upsert({
            project: list.folder || list.name || "",
            client_name: list.space_name || "",
            title: task.name,
            clickup_task_id: task.id,
            clickup_list_id: list.id,
            clickup_status: clickupStatus,
            clickup_space_name: list.space_name,
            clickup_folder_name: list.folder,
            clickup_list_name: list.name,
            status: ourStatus,
            price: 0,
            currency: "VND",
            exchange_rate: 0,
            bonus: 0,
            bonus_note: "",
            start_date: startDate,
            due_date: dueDate,
            closed_date: closedDate,
            completed_at: closedDate,
            clickup_updated_at: clickupUpdatedAt,
            approved_at: ourStatus === "approved" ? (closedDate || new Date().toISOString().split("T")[0]) : null,
            payment_status: "unpaid",
            notes: "",
            synced_at: new Date().toISOString(),
          }, { onConflict: "clickup_task_id" }).select("id").single();

          if (insErr || !inserted) {
            console.error(`[clickup-auto-sync] insert failed task=${task.id}:`, insErr?.message);
            errors++;
            continue;
          }
          await syncAssignees(supabase, inserted.id, workerIds, resolver.allMatched(task, assigneeEmails));
        }
        synced++;
      }
    } catch (e: any) {
      log.push(`Error on list ${list.name}: ${e.message}`);
      errors++;
    }
  }

  await supabase
    .from("wf_clickup_config")
    .update({ last_synced: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", config.id);

  if (unmatched.size) log.push(`Email ClickUp không khớp worker/HR nào: ${[...unmatched].join(", ")}`);
  log.push(`Done: synced=${synced}, skipped=${skipped}, dupes=${dupes}, errors=${errors}`);
  return { ok: true, synced, skipped, dupes, errors, lists: allLists.length, log };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = await requireCronOrUser(req);
  if (denied) return denied;

  try {
    console.log("[clickup-auto-sync] Starting auto sync...");
    const result = await runAutoSync();
    console.log("[clickup-auto-sync] Result:", JSON.stringify(result));
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[clickup-auto-sync] Fatal error:", err.message);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
