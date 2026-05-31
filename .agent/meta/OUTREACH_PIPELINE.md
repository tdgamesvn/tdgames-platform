# Outreach Pipeline — Runbook & Architecture

_Cập nhật: 2026-05-31_

---

## Kiến trúc tổng quan

```
[Apollo API] → FastAPI (VPS:8401) → Supabase (crm_outreach_leads)
                     ↑
          2 trigger paths chạy song song:
          1. VPS /etc/cron.d (local)
          2. Supabase pg_cron → Edge Functions
```

---

## Components

### FastAPI Backend
- **VPS:** `vps6core` (Tailscale SSH: `ssh root@vps6core`)
- **Path:** `/opt/td-mailer-api/`
- **Service:** `systemctl status td-mailer-api`
- **Port:** `8401`
- **Restart:** `systemctl restart td-mailer-api`
- **Main log:** `journalctl -u td-mailer-api -n 50`
- **Key files:**
  - `services/apollo.py` — Apollo API integration (people search + company search)
  - `routes/discovery.py` — `/api/discovery/auto-run`, `/api/leads/discover`
  - `routes/automation.py` — `/api/automation/daily-send`, `/api/automation/daily-discover`
  - `cron_followup.py` — Follow-up email logic (run by VPS cron)

### Apollo API (Contact Discovery)
- **Current endpoint:** `POST https://api.apollo.io/v1/mixed_people/api_search`
- **⚠️ History:** Deprecated twice. Was `people/search` → `mixed_people/search` → `mixed_people/api_search`
- **Auth:** Header `X-Api-Key: <APOLLO_API_KEY>` (in `.env` on VPS)
- **Company search:** `POST https://api.apollo.io/v1/mixed_companies/search`
- **Payload:** `q_organization_name`, `person_titles`, `q_organization_domains` (optional), `page`, `per_page`
- **If 422 error:** Check if endpoint deprecated again → update `services/apollo.py`

### Cron Schedule (VPS `/etc/cron.d/`)

| Time (ICT) | Job | Endpoint |
|------------|-----|---------|
| 08:00 | Auto discover contacts | `POST localhost:8401/api/automation/daily-discover` |
| 09:30 | Send initial emails | `POST localhost:8401/api/automation/daily-send` |
| 10:00 | Send follow-up emails | `python3 /opt/td-mailer-api/cron_followup.py` |

**Follow-up log:** `/opt/td-mailer-api/logs/followup.log`
**Auto log:** `/var/log/td-mailer-auto.log`

### Cron Schedule (Supabase pg_cron)

| Time (UTC) | Job | Target |
|------------|-----|--------|
| 00:00 | outreach-auto-batch-morning | Edge fn `outreach-auto-batch` |
| 07:00 | outreach-auto-batch-afternoon | Edge fn `outreach-auto-batch` |
| 02:00 | outreach-auto-discovery-daily | Edge fn `outreach-auto-discovery` |

**Check cron runs:** `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;`

### Supabase Edge Functions
- `outreach-auto-batch` — calls FastAPI `/api/automation/daily-send`, sends Discord ✅
- `outreach-auto-discovery` — calls FastAPI `/api/discovery/auto-run`, sends Discord ✅
- `outreach-proxy` — JWT-authenticated proxy for frontend → FastAPI

### Discord Notifications
- Webhook hardcoded in both Edge Functions
- `outreach-auto-batch` → Discord "📧 Auto Batch — Email đã gửi"
- `outreach-auto-discovery` → Discord "🔍 Auto Discovery — Kết quả"
- **Nếu Discord báo chạy nhưng 0 sent:** ĐÚNG — hết pending leads, không phải bug

---

## Email Sequence

```
pending → [initial_outreach] → initial_sent
                                    ↓ (3 ngày)
                              [followup_1] → followup1_sent
                                                  ↓ (7 ngày)
                                            [followup_2] → followup2_sent
```

- **`daily-send`** chỉ gửi `initial_outreach` cho `pending` leads (max 30/ngày)
- **`cron_followup.py`** gửi FU1 và FU2 theo delay
- **Bounces** được check qua `/api/email/check-bounces` (Gmail scan)

---

## DB Tables (Supabase)

| Table | Mục đích |
|-------|---------|
| `crm_outreach_leads` | Lead chính — status, email, tier, timestamps |
| `crm_email_log` | Log từng email đã gửi |
| `crm_email_templates` | Templates: `initial_outreach`, `followup_1`, `followup_2` |
| `crm_outreach_config` | Runtime config: `auto_discovery`, `auto_batch`, `cron_secret` |
| `crm_discovered_studios` | Studios đã discover (exclusion list 90 ngày) |
| `crm_outreach_batch_log` | Log từng batch run (type: auto/manual) |

---

## Quick Health Check SQL

```sql
-- Lead pipeline snapshot
SELECT outreach_status, COUNT(*) as count
FROM crm_outreach_leads
GROUP BY outreach_status ORDER BY count DESC;

-- Email volume 7 ngày
SELECT DATE(sent_at AT TIME ZONE 'Asia/Ho_Chi_Minh') as date_ict,
       template_name, COUNT(*) as sent
FROM crm_email_log
WHERE sent_at >= NOW() - INTERVAL '7 days'
GROUP BY 1, 2 ORDER BY 1 DESC, 2;

-- Cron runs gần nhất
SELECT jobname, status, start_time FROM cron.job_run_details
ORDER BY start_time DESC LIMIT 10;

-- Auto config state
SELECT key, value->>'enabled' AS enabled,
       value->>'last_run_at' AS last_run_at,
       value->'last_run_stats' AS last_run_stats
FROM crm_outreach_config WHERE key IN ('auto_discovery', 'auto_batch');
```

---

## Known Issues & Fixes Applied

| Date | Issue | Fix |
|------|-------|-----|
| 2026-05-30 | Apollo `mixed_people/search` deprecated (422) | Đổi sang `mixed_people/api_search` trong `services/apollo.py` |
| 2026-05-30 | `crm_outreach_batch_log.last_run_at` null | Bug cosmetic: Edge fn không ghi lại. Không ảnh hưởng tính năng |
| 2026-05-30 | Batch Add button trong Discovery truyền tên công ty làm email | Fix `EmailOutreach.tsx` line 1492 |

---

## Cải thiện cần làm

- [ ] **Monitoring alert:** Discord cảnh báo khi `contacts_added=0` liên tiếp 3+ ngày
- [ ] **Lead source diversity:** Apollo có thể lại deprecated → cần fallback (web scraping, LinkedIn)
- [ ] **Consolidate dual-trigger:** VPS cron + Supabase pg_cron đều gọi discovery — có thể gây double-process
- [ ] **Auto FU email Discord:** `cron_followup.py` không có Discord notification (chỉ file log)
- [ ] **Reply tracking:** Không có auto-detect reply, phải mark thủ công
