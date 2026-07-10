# Apollo Bulk Contact Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quét 1 lần toàn bộ ~625 studio trong `crm_discovered_studios`, lấy tối đa 3 contact/studio qua Apollo, insert vào `crm_outreach_leads` (status `pending`), dừng cứng ở 2300 credits. Tắt auto-discovery studio mới.

**Architecture:** Một script CLI mới `bulk_enrich.py` trên VPS `/opt/td-mailer-api/`, reuse `services.apollo.apollo_search_people` (2-step: search FREE → bulk_match reveal 1 credit/người) và `services.supabase_client.get_client`. Checkpoint JSON local để resume. Không sửa frontend, không sửa luồng gửi mail.

**Tech Stack:** Python 3 (đã có trên VPS), supabase-py, requests. VPS access: `tailscale ssh root@vps6core`.

## Global Constraints

- Credit guard cứng: **2300** (spec) — đếm số person ID gửi vào reveal (ước lượng an toàn, cao hơn thực tế).
- 3 contact/studio (trừ số lead đã có, match theo `LOWER(studio_name)`).
- Leads mới: `outreach_status='pending'`, `source='apollo_bulk_enrich'`, dedupe theo email toàn bảng.
- Rate limit: sleep 1.5s giữa mỗi studio; backoff 60s khi HTTP 429.
- Dry-run 20 studio đầu → sếp duyệt trong tab Outreach → mới full run.
- KHÔNG đụng: `daily-send`, follow-up cron, templates.

---

### Task 1: Tắt auto-discovery

**Files:**
- Modify: Supabase `crm_outreach_config` + `cron.job` (SQL, không phải file)
- Modify: file trong `/etc/cron.d/` trên VPS có dòng `daily-discover`

**Interfaces:**
- Produces: không còn job nào tạo studio mới; luồng send giữ nguyên.

- [ ] **Step 1: Xem config và cron hiện có (Supabase MCP `execute_sql`)**

```sql
SELECT * FROM crm_outreach_config;
SELECT jobid, jobname, schedule FROM cron.job WHERE jobname ILIKE '%discovery%';
```

- [ ] **Step 2: Tắt flag + unschedule pg_cron**

```sql
UPDATE crm_outreach_config SET value = 'false' WHERE key = 'auto_discovery';
SELECT cron.unschedule('outreach-auto-discovery-daily');
```
(Điều chỉnh tên key/jobname theo kết quả Step 1. Nếu flag không tồn tại thì chỉ unschedule.)

- [ ] **Step 3: Comment cron VPS 08:00 daily-discover**

```bash
tailscale ssh root@vps6core "grep -rln 'daily-discover' /etc/cron.d/"
# với file tìm được:
tailscale ssh root@vps6core "sed -i 's|^\(.*daily-discover.*\)$|#\1|' /etc/cron.d/<file>"
tailscale ssh root@vps6core "grep -r 'daily-discover' /etc/cron.d/"
```
Expected: dòng daily-discover bắt đầu bằng `#`. KHÔNG comment dòng `daily-send` và followup.

- [ ] **Step 4: Verify** — chạy lại Step 1, xác nhận job discovery biến mất / flag false.

---

### Task 2: Script `bulk_enrich.py` trên VPS

**Files:**
- Create: `/opt/td-mailer-api/bulk_enrich.py` (viết local ở `$TMPDIR/bulk_enrich.py` rồi scp lên)
- Create (runtime): `/opt/td-mailer-api/data/bulk_enrich_checkpoint.json`, `/opt/td-mailer-api/logs/bulk_enrich.log`

**Interfaces:**
- Consumes: `services.apollo.apollo_search_people(company, domain="", page=1, max_reveals=N)` → list dict có keys `name, title, email, linkedin_url, tier_label, source`; `services.supabase_client.get_client()` → supabase client.
- Produces: CLI `python3 bulk_enrich.py [--limit N] [--per-studio 3] [--max-credits 2300] [--no-reveal]`.

- [ ] **Step 1: Viết script**

```python
#!/usr/bin/env python3
"""Bulk enrich contacts for existing studios via Apollo.
Usage: python3 bulk_enrich.py --limit 20            # dry-run đợt đầu
       python3 bulk_enrich.py                        # full run
       python3 bulk_enrich.py --no-reveal --limit 5  # smoke test, 0 credit
"""
import argparse, json, logging, os, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from services.apollo import apollo_search_people
from services.supabase_client import get_client

CHECKPOINT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "bulk_enrich_checkpoint.json")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                    handlers=[logging.StreamHandler(),
                              logging.FileHandler(os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs", "bulk_enrich.log"))])
log = logging.getLogger("bulk_enrich")


def load_checkpoint():
    if os.path.exists(CHECKPOINT):
        with open(CHECKPOINT) as f:
            return json.load(f)
    return {"done": [], "credits_used": 0}


def save_checkpoint(cp):
    with open(CHECKPOINT, "w") as f:
        json.dump(cp, f)


def fetch_studios(sb):
    """Studios + số lead hiện có, match theo lower(studio_name)."""
    studios = sb.table("crm_discovered_studios").select("studio_name,country").execute().data
    leads = sb.table("crm_outreach_leads").select("studio_name,email").execute().data
    counts, emails = {}, set()
    for l in leads:
        counts[(l.get("studio_name") or "").lower()] = counts.get((l.get("studio_name") or "").lower(), 0) + 1
        if l.get("email"):
            emails.add(l["email"].lower())
    return studios, counts, emails


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="chỉ xử lý N studio (0 = hết)")
    ap.add_argument("--per-studio", type=int, default=3)
    ap.add_argument("--max-credits", type=int, default=2300)
    ap.add_argument("--no-reveal", action="store_true", help="chỉ search, không reveal, 0 credit")
    args = ap.parse_args()

    sb = get_client()
    cp = load_checkpoint()
    studios, counts, seen_emails = fetch_studios(sb)
    todo = [s for s in studios
            if s["studio_name"] not in cp["done"]
            and counts.get(s["studio_name"].lower(), 0) < args.per_studio]
    if args.limit:
        todo = todo[:args.limit]
    log.info("todo=%d studios, credits_used(cp)=%d", len(todo), cp["credits_used"])

    inserted = 0
    for i, s in enumerate(todo):
        name = s["studio_name"]
        need = args.per_studio - counts.get(name.lower(), 0)
        if cp["credits_used"] + need > args.max_credits:
            log.warning("CREDIT GUARD: %d + %d > %d — dừng.", cp["credits_used"], need, args.max_credits)
            break
        try:
            if args.no_reveal:
                contacts = apollo_search_people(name, max_reveals=0)  # search-only path below
                log.info("[%d/%d] %s: (no-reveal) skip insert", i + 1, len(todo), name)
                cp["done"].append(name); save_checkpoint(cp)
                time.sleep(1.5); continue
            contacts = apollo_search_people(name, max_reveals=need)
        except Exception as e:
            log.error("[%s] apollo error: %s — skip", name, e)
            cp["done"].append(name); save_checkpoint(cp)
            time.sleep(60); continue

        cp["credits_used"] += need  # đếm theo reveal attempts (ước lượng cao — an toàn)
        new = 0
        for c in contacts:
            em = (c.get("email") or "").lower()
            if not em or em in seen_emails:
                continue
            seen_emails.add(em)
            first = (c.get("name") or "").split(" ")[0]
            try:
                sb.table("crm_outreach_leads").insert({
                    "studio_name": name,
                    "contact_name": c.get("name") or "",
                    "first_name": first,
                    "email": em,
                    "job_title": c.get("title") or "",
                    "linkedin_url": c.get("linkedin_url") or "",
                    "tier": c.get("tier_label") or "",
                    "outreach_status": "pending",
                    "source": "apollo_bulk_enrich",
                }).execute()
                new += 1
            except Exception as e:
                log.error("[%s] insert %s failed: %s", name, em, e)
        inserted += new
        cp["done"].append(name); save_checkpoint(cp)
        log.info("[%d/%d] %s: +%d contacts (credits~%d)", i + 1, len(todo), name, new, cp["credits_used"])
        time.sleep(1.5)

    log.info("DONE: %d leads inserted, credits_used~%d", inserted, cp["credits_used"])


if __name__ == "__main__":
    main()
```

Lưu ý khi implement: `apollo_search_people` với `max_reveals=0` → `candidates[:0]` = rỗng → `_bulk_reveal_emails([])` trả `[]`, 0 credit — đúng hành vi smoke-test, không cần sửa `apollo.py`. Kiểm tra cột `tier` trong `crm_outreach_leads` nhận text label (xem lead cũ: `SELECT DISTINCT tier FROM crm_outreach_leads LIMIT 10`) — nếu là số thì đổi sang `c.get("tier_num")`.

- [ ] **Step 2: scp lên VPS + syntax check**

```bash
scp "$TMPDIR/bulk_enrich.py" root@vps6core:/opt/td-mailer-api/bulk_enrich.py
tailscale ssh root@vps6core "cd /opt/td-mailer-api && python3 -m py_compile bulk_enrich.py && echo OK"
```
Expected: `OK`

- [ ] **Step 3: Smoke test 0 credit**

```bash
tailscale ssh root@vps6core "cd /opt/td-mailer-api && set -a && . ./.env 2>/dev/null; set +a; python3 bulk_enrich.py --no-reveal --limit 3"
```
(Env: kiểm tra service load env kiểu gì — `systemctl cat td-mailer-api` → EnvironmentFile; source đúng file đó.)
Expected: log 3 studio, `credits_used=0`, không insert. Sau đó **xoá checkpoint** để dry-run thật không bị skip 3 studio này: `rm /opt/td-mailer-api/data/bulk_enrich_checkpoint.json`

---

### Task 3: Dry-run 20 studio + sếp duyệt (GATE)

- [ ] **Step 1: Chạy dry-run**

```bash
tailscale ssh root@vps6core "cd /opt/td-mailer-api && set -a && . ./.env; set +a; python3 bulk_enrich.py --limit 20"
```
Expected: log ~20 studio, credits_used ≤ 60.

- [ ] **Step 2: Verify SQL**

```sql
SELECT studio_name, contact_name, job_title, email, tier
FROM crm_outreach_leads WHERE source = 'apollo_bulk_enrich'
ORDER BY created_at DESC;
```
Expected: leads mới, email hợp lệ, title thuộc nhóm CONTACT_TITLES/BROAD_TITLES.

- [ ] **Step 3: DỪNG — báo sếp duyệt trong tab Outreach.** Chỉ tiếp Task 4 khi sếp OK. Nếu sếp chê chất lượng → chỉnh titles/logic rồi lặp lại Task 3.

---

### Task 4: Full run + verify + memory

- [ ] **Step 1: Full run (nohup — chạy ~30-60 phút)**

```bash
tailscale ssh root@vps6core "cd /opt/td-mailer-api && set -a && . ./.env; set +a; nohup python3 bulk_enrich.py > logs/bulk_enrich_full.log 2>&1 & echo started"
```

- [ ] **Step 2: Theo dõi tới xong**

```bash
tailscale ssh root@vps6core "tail -5 /opt/td-mailer-api/logs/bulk_enrich_full.log; pgrep -f bulk_enrich.py || echo FINISHED"
```
Nếu process chết giữa chừng: chạy lại lệnh Step 1 — checkpoint tự resume.

- [ ] **Step 3: Verify tổng**

```sql
SELECT COUNT(*) FROM crm_outreach_leads WHERE source = 'apollo_bulk_enrich';
SELECT outreach_status, COUNT(*) FROM crm_outreach_leads GROUP BY 1;
```
Đối chiếu credits còn lại trên dashboard Apollo (sếp check) — phải còn ≥ 160.

- [ ] **Step 4: Cập nhật memory + commit plan**

- `.agent/meta/OUTREACH_PIPELINE.md`: thêm mục `bulk_enrich.py`, ghi chú auto-discovery đã tắt.
- `.agent/meta/TASKS.md` + `LOG.md` theo Memory Protocol.
```bash
git add docs/superpowers/plans/2026-07-08-apollo-bulk-contact-enrich.md
git commit -m "docs: plan apollo bulk contact enrichment"
```
