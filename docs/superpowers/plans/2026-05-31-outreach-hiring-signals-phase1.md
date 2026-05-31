# Outreach Upgrade — Phase 1: Hiring Signal Discovery & Lead Scoring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm nguồn lead chất lượng cao từ job postings (studios đang tuyển art roles) vào pipeline hiện tại — không phá vỡ bất kỳ thứ gì đang chạy.

**Architecture:**
- **Giai đoạn A** (tasks 1–4): Hoàn toàn additive. Thêm cron mới, service mới, DB columns mới — không sửa một dòng code cũ nào. Hiring signal leads chạy qua pipeline email hiện tại như bình thường.
- **Giai đoạn B** (tasks 5–6): Sau khi A vận hành ổn 1–2 tuần. Mới personalize email template riêng và ưu tiên quota. Đây là phần duy nhất touch code cũ.

**Tech Stack:** Python 3.10, Google Custom Search API (đã có trên VPS), Supabase PostgreSQL, React/TypeScript.

---

## Giai đoạn A vs B — Rủi ro

| | Giai đoạn A | Giai đoạn B |
|-|------------|------------|
| Rủi ro luồng cũ | **Không** — chỉ thêm, không sửa | **Thấp** — sửa `daily_send` + `_run_batch` |
| Có thể rollback không | Không cần (không ảnh hưởng) | Có — git revert 2 files |
| Khi nào làm | Ngay bây giờ | Sau khi A chạy 1-2 tuần ổn định |
| Kết quả | Hiring leads vào pipeline, dùng template generic | Hiring leads dùng template personalized, ưu tiên quota |

---

## File Map

### Giai đoạn A

| Action | File | Mục đích |
|--------|------|---------|
| SQL (Supabase) | migration `20260531_add_trigger_source_score.sql` | Thêm `trigger_source` DEFAULT `'generic'`, `lead_score` DEFAULT `30` |
| CREATE (VPS) | `services/hiring_signals.py` | Google CSE tìm job postings → parse studio/job title |
| CREATE (VPS) | `cron_hiring_signals.py` | Daily cron 07:00 ICT — chạy discovery + upsert leads + Discord |
| MODIFY (VPS) | `/etc/cron.d/td-mailer-automation` | Thêm 1 dòng cron |
| MODIFY (Frontend) | `types.ts` | Thêm `trigger_source`, `lead_score` vào `CrmOutreachLead` |
| MODIFY (Frontend) | `apps/crm/services/outreachService.ts` | Filter thêm `trigger_source`, sort by `lead_score` |
| MODIFY (Frontend) | `apps/crm/components/EmailOutreach.tsx` | Badge "🔎 Hiring" + score + filter dropdown |

### Giai đoạn B (sau A ổn định)

| Action | File | Mục đích |
|--------|------|---------|
| SQL (Supabase) | Insert vào `crm_email_templates` | Template `initial_outreach_hiring` |
| MODIFY (VPS) | `routes/automation.py` — `daily_send` | Chia quota hiring/generic, map lead → template |
| MODIFY (VPS) | `routes/email.py` — `_run_batch` | Nhận `template_map` dict để gửi đúng template |

---

# ═══ GIAI ĐOẠN A ═══
# Additive hoàn toàn — không đụng code cũ

---

## Task A1: DB Migration — thêm `trigger_source` và `lead_score`

**Files:**
- SQL chạy trên Supabase Dashboard → SQL Editor
- Create: `supabase/migrations/20260531000000_add_trigger_source_score.sql`

- [ ] **Step 1: Chạy migration trên Supabase SQL Editor**

```sql
-- Thêm trigger_source: nguồn signal của lead
ALTER TABLE crm_outreach_leads
  ADD COLUMN IF NOT EXISTS trigger_source TEXT NOT NULL DEFAULT 'generic';

-- Thêm lead_score: 0-100, dùng để sort ưu tiên
ALTER TABLE crm_outreach_leads
  ADD COLUMN IF NOT EXISTS lead_score INTEGER NOT NULL DEFAULT 30;

-- Backfill score cho leads cũ theo tier
UPDATE crm_outreach_leads SET lead_score = 50 WHERE tier = 1 AND trigger_source = 'generic';
UPDATE crm_outreach_leads SET lead_score = 40 WHERE tier = 2 AND trigger_source = 'generic';
-- tier 3 giữ default 30

-- Index cho filter và sort
CREATE INDEX IF NOT EXISTS idx_leads_trigger_source ON crm_outreach_leads(trigger_source);
CREATE INDEX IF NOT EXISTS idx_leads_score ON crm_outreach_leads(lead_score DESC);
```

- [ ] **Step 2: Verify migration thành công**

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'crm_outreach_leads'
  AND column_name IN ('trigger_source', 'lead_score')
ORDER BY column_name;
```

Expected: 2 rows — `lead_score integer 30`, `trigger_source text 'generic'`.

- [ ] **Step 3: Verify không có lead nào bị ảnh hưởng**

```sql
-- Tất cả leads cũ vẫn pending/sent như cũ, chỉ thêm columns
SELECT outreach_status, trigger_source, COUNT(*)
FROM crm_outreach_leads
GROUP BY 1, 2
ORDER BY 1, 2;
```

Expected: tất cả existing leads có `trigger_source = 'generic'`.

- [ ] **Step 4: Lưu migration file vào repo và commit**

Tạo file `supabase/migrations/20260531000000_add_trigger_source_score.sql` với nội dung SQL ở Step 1:

```bash
# Từ máy local
git add supabase/migrations/20260531000000_add_trigger_source_score.sql
git commit -m "feat(db): add trigger_source and lead_score to crm_outreach_leads"
```

---

## Task A2: Hiring Signal Service

**Files:**
- Create (VPS): `/opt/td-mailer-api/services/hiring_signals.py`

- [ ] **Step 1: Kiểm tra Google CSE credentials trên VPS**

```bash
ssh root@vps6core
grep -i 'GOOGLE\|CSE\|SEARCH_KEY\|SEARCH_CX' \
  /etc/systemd/system/td-mailer-api.service \
  /opt/td-mailer-api/.env 2>/dev/null | grep -v '#'
```

Note lại tên biến thực tế (có thể là `GOOGLE_API_KEY`, `GOOGLE_CSE_CX`, hoặc tên khác).

> **Nếu chưa có:** Tạo Google Custom Search Engine tại https://cse.google.com → lấy CX ID. Thêm Google API Key tại https://console.cloud.google.com → enable Custom Search API. Thêm vào systemd service: `Environment=GOOGLE_API_KEY=<key>` và `Environment=GOOGLE_CSE_CX=<cx>`, rồi `systemctl daemon-reload`.

- [ ] **Step 2: Tạo `services/hiring_signals.py` trên VPS**

```bash
cat > /opt/td-mailer-api/services/hiring_signals.py << 'PYEOF'
"""
Hiring Signal Discovery
Dùng Google CSE tìm game studios đang tuyển art/animation roles.
Returns list of raw signal dicts — caller tự upsert vào DB.
"""
import os, re, logging, time, random
import requests

logger = logging.getLogger("td-mailer.hiring-signals")

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
GOOGLE_CSE_CX  = os.environ.get("GOOGLE_CSE_CX", "")

# Queries tìm job postings art/animation cho game studios
JOB_QUERIES = [
    '"game studio" "character artist" OR "3d artist" hiring site:linkedin.com/jobs',
    '"game studio" "animator" OR "vfx artist" hiring site:linkedin.com/jobs',
    '"game studio" "art director" OR "outsource manager" hiring site:linkedin.com/jobs',
    '"indie game" OR "mobile game" "environment artist" hiring site:linkedin.com/jobs',
    'site:gamejobs.co "3d artist" OR "character artist" OR "animator" 2025 OR 2026',
    '"game developer" "lead artist" OR "art director" hiring',
]

# Tier mapping: job title keyword → tier number
TITLE_TIER = {
    "art director": 1, "outsource manager": 1, "outsourcing manager": 1,
    "head of art": 1, "vp of art": 1, "lead artist": 1, "animation director": 1,
    "producer": 2, "executive producer": 2, "production manager": 2,
    "lead animator": 2, "senior art director": 2,
    "animator": 3, "3d artist": 3, "character artist": 3,
    "environment artist": 3, "vfx artist": 3, "concept artist": 3,
}

def _guess_tier(title: str) -> int:
    t = title.lower()
    for kw, tier in TITLE_TIER.items():
        if kw in t:
            return tier
    return 3

def _score_for_signal(tier: int) -> int:
    """Hiring signal leads nhận score cao hơn generic vì có intent."""
    return {1: 85, 2: 70, 3: 55}.get(tier, 55)

def _cse_search(query: str, num: int = 10) -> list:
    """Gọi Google Custom Search API. Returns list items hoặc []."""
    if not GOOGLE_API_KEY or not GOOGLE_CSE_CX:
        logger.warning("GOOGLE_API_KEY hoặc GOOGLE_CSE_CX chưa set — skip CSE search")
        return []
    params = {
        "key": GOOGLE_API_KEY, "cx": GOOGLE_CSE_CX,
        "q": query, "num": num,
    }
    try:
        r = requests.get(
            "https://www.googleapis.com/customsearch/v1",
            params=params, timeout=15,
        )
        if r.status_code == 200:
            return r.json().get("items", [])
        logger.warning(f"CSE {r.status_code}: {r.text[:200]}")
    except Exception as e:
        logger.error(f"CSE request error: {e}")
    return []

def _parse_result(item: dict) -> dict | None:
    """
    Parse 1 CSE result → signal dict.
    Returns None nếu không đủ thông tin (company name thiếu).
    Tiêu đề LinkedIn job thường có format: "Job Title - Company | LinkedIn"
    """
    raw_title  = item.get("title", "")
    snippet    = item.get("snippet", "")
    link       = item.get("link", "")

    # Extract: "Art Director - Supercell | LinkedIn" → job_title="Art Director", company="Supercell"
    parts = re.split(r"\s+[-–]\s+", raw_title, maxsplit=1)
    job_title = parts[0].strip() if parts else raw_title.strip()

    company = ""
    if len(parts) > 1:
        # Xoá "| LinkedIn", "| Glassdoor", "| Indeed"... ở cuối
        company = re.sub(r"\s*\|.*$", "", parts[1]).strip()

    # Fallback: thử lấy company từ snippet ("... at Supercell ...")
    if not company:
        m = re.search(r"\bat\s+([A-Z][A-Za-z0-9 &]+?)(?:\s+is|\s+\.|,|$)", snippet)
        if m:
            company = m.group(1).strip()

    # Bỏ qua nếu không tìm được company
    if not company or len(company) < 2:
        return None

    tier = _guess_tier(job_title)
    return {
        "studio_name":    company,
        "job_title":      job_title,
        "job_url":        link,
        "snippet":        snippet[:300],
        "tier":           tier,
        "trigger_source": "hiring_signal",
        "lead_score":     _score_for_signal(tier),
        "source":         "hiring_signal_cse",
    }

def run_hiring_signal_discovery(max_queries: int = 4) -> list:
    """
    Chạy Google CSE với các job queries.
    Returns list[dict] signal — unique by studio_name (lowercase).
    """
    signals = []
    seen: set = set()

    for query in JOB_QUERIES[:max_queries]:
        items = _cse_search(query, num=10)
        for item in items:
            parsed = _parse_result(item)
            if parsed is None:
                continue
            key = parsed["studio_name"].lower()
            if key not in seen:
                seen.add(key)
                signals.append(parsed)
        # Delay nhẹ giữa các query tránh rate limit
        time.sleep(random.uniform(1.0, 2.5))

    logger.info(f"Hiring signal discovery done: {len(signals)} unique studios found")
    return signals
PYEOF
echo "hiring_signals.py created: $?"
```

- [ ] **Step 3: Syntax check**

```bash
ssh root@vps6core
python3 -c "import ast; ast.parse(open('/opt/td-mailer-api/services/hiring_signals.py').read()); print('Syntax OK')"
```

Expected: `Syntax OK`

- [ ] **Step 4: Quick test (sẽ in kết quả hoặc warning nếu key chưa có)**

```bash
ssh root@vps6core
cd /opt/td-mailer-api
PYTHONPATH=/opt/td-mailer-api python3 -c "
from dotenv import load_dotenv; load_dotenv('/opt/td-mailer-api/.env')
import os
print('GOOGLE_API_KEY:', 'SET' if os.environ.get('GOOGLE_API_KEY') else 'MISSING')
print('GOOGLE_CSE_CX:', 'SET' if os.environ.get('GOOGLE_CSE_CX') else 'MISSING')
from services.hiring_signals import run_hiring_signal_discovery
results = run_hiring_signal_discovery(max_queries=1)
print(f'Found {len(results)} signals')
for r in results[:3]:
    print(f'  {r[\"studio_name\"]} | {r[\"job_title\"]} | tier={r[\"tier\"]} score={r[\"lead_score\"]}')
"
```

---

## Task A3: Cron Script `cron_hiring_signals.py`

**Files:**
- Create (VPS): `/opt/td-mailer-api/cron_hiring_signals.py`

- [ ] **Step 1: Tạo cron script**

```bash
cat > /opt/td-mailer-api/cron_hiring_signals.py << 'PYEOF'
#!/usr/bin/env python3
"""
Hiring Signal Cron — chạy 07:00 ICT (00:00 UTC) mỗi ngày.
Tìm job postings → insert leads vào Supabase (trigger_source='hiring_signal').
Leads này chạy qua pipeline email hiện tại như bình thường.
Dùng --dry-run để test không write DB.
"""
import os, sys, logging
from datetime import datetime

LOG_FILE = '/opt/td-mailer-api/logs/hiring_signals.log'
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

sys.path.insert(0, '/opt/td-mailer-api')
from dotenv import load_dotenv
load_dotenv('/opt/td-mailer-api/.env')

from services.supabase_client import get_client
from services.hiring_signals import run_hiring_signal_discovery
from services.discord import send_discord

DRY_RUN = '--dry-run' in sys.argv

def _already_tracked_studios(client) -> set:
    """Studios đã có trong DB (bất kỳ trigger_source nào) — tránh trùng."""
    rows = client.table("crm_outreach_leads") \
        .select("studio_name") \
        .execute().data or []
    return {r["studio_name"].lower() for r in rows}

def main():
    logger.info(f"{'='*50}\nHiring Signal Cron {'[DRY RUN] ' if DRY_RUN else ''}@ {datetime.now()}\n{'='*50}")

    signals = run_hiring_signal_discovery(max_queries=4)

    if not signals:
        logger.info("Không tìm thấy hiring signals hôm nay")
        send_discord(
            "🔎 Hiring Signals — Không có kết quả",
            0x888888,
            [{"name": "Kết quả", "value": "Không tìm thấy job posting mới hôm nay", "inline": False}],
        )
        return

    added = skipped = 0

    if not DRY_RUN:
        client = get_client()
        existing_studios = _already_tracked_studios(client)

        for sig in signals:
            if sig["studio_name"].lower() in existing_studios:
                skipped += 1
                logger.info(f"  Skip (already in DB): {sig['studio_name']}")
                continue

            # Email placeholder — Apollo sẽ enrich sau qua daily-discover
            placeholder_email = (
                f"__pending__{sig['studio_name'].lower().replace(' ', '_').replace('.', '')}@hiring.signal"
            )
            row = {
                "studio_name":       sig["studio_name"],
                "contact_name":      "",
                "first_name":        "",
                "email":             placeholder_email,
                "job_title":         sig["job_title"],
                "linkedin_url":      sig.get("job_url", ""),
                "tier":              sig["tier"],
                "outreach_status":   "pending",
                "trigger_source":    "hiring_signal",
                "lead_score":        sig["lead_score"],
                "source":            "hiring_signal_cse",
                "notes":             f"Hiring signal: {sig.get('snippet', '')[:200]}",
                "tags":              ["hiring_signal"],
                "initial_sent_at":   None,
                "followup1_sent_at": None,
                "followup2_sent_at": None,
                "replied_at":        None,
                "client_id":         None,
            }
            try:
                client.table("crm_outreach_leads").insert(row).execute()
                existing_studios.add(sig["studio_name"].lower())
                added += 1
                logger.info(f"  Added: {sig['studio_name']} | {sig['job_title']} | score={sig['lead_score']}")
            except Exception as e:
                skipped += 1
                logger.error(f"  Insert failed {sig['studio_name']}: {e}")
    else:
        logger.info("[DRY RUN] Would add:")
        for s in signals:
            logger.info(f"  {s['studio_name']} | {s['job_title']} | score={s['lead_score']}")
        added = len(signals)

    # Discord notification
    lines = [
        f"{'⭐' if s['tier']==1 else '★' if s['tier']==2 else '☆'} **{s['studio_name']}** — _{s['job_title']}_ (score: {s['lead_score']})"
        for s in signals[:15]
    ]
    if len(signals) > 15:
        lines.append(f"_...và {len(signals) - 15} studios khác_")

    send_discord(
        f"🔎 Hiring Signals — {'DRY RUN' if DRY_RUN else 'Kết quả hôm nay'}",
        0xFF9500,
        [
            {"name": "🏢 Tìm thấy", "value": str(len(signals)), "inline": True},
            {"name": "✅ Đã thêm", "value": str(added), "inline": True},
            {"name": "⏭ Bỏ qua", "value": str(skipped), "inline": True},
            {"name": "📋 Danh sách", "value": ("\n".join(lines) or "_(trống)_")[:1024], "inline": False},
        ],
    )
    logger.info(f"Done: added={added} skipped={skipped}")

if __name__ == '__main__':
    main()
PYEOF
echo "cron_hiring_signals.py created: $?"
```

- [ ] **Step 2: Syntax check**

```bash
python3 -c "import ast; ast.parse(open('/opt/td-mailer-api/cron_hiring_signals.py').read()); print('Syntax OK')"
```

- [ ] **Step 3: Dry run test — verify không ghi DB, Discord nhận message**

```bash
ssh root@vps6core
PYTHONPATH=/opt/td-mailer-api python3 /opt/td-mailer-api/cron_hiring_signals.py --dry-run
```

Expected output:
```
=== ... Hiring Signal Cron [DRY RUN] @ ... ===
Hiring signal discovery done: N unique studios found
[DRY RUN] Would add:
  Studio A | Art Director | score=85
  ...
Done: added=N skipped=0
```
Và Discord nhận embed màu cam với danh sách studios.

---

## Task A4: Đăng ký VPS Cron

**Files:**
- Modify: `/etc/cron.d/td-mailer-automation`

- [ ] **Step 1: Thêm cron line**

```bash
ssh root@vps6core
# Xem file cron hiện tại trước
cat /etc/cron.d/td-mailer-automation

# Thêm dòng mới (07:00 ICT = 00:00 UTC)
echo '
# 07:00 ICT (00:00 UTC) — tìm hiring signal job postings
0 0 * * * root PYTHONPATH=/opt/td-mailer-api /usr/bin/python3 /opt/td-mailer-api/cron_hiring_signals.py >> /opt/td-mailer-api/logs/hiring_signals.log 2>&1' \
  >> /etc/cron.d/td-mailer-automation
```

- [ ] **Step 2: Verify cron đã được đăng ký**

```bash
grep -n 'hiring' /etc/cron.d/td-mailer-automation
```

Expected: `0 0 * * * root ... cron_hiring_signals.py ...`

- [ ] **Step 3: Verify cron syntax valid**

```bash
crontab -l 2>/dev/null; cat /etc/cron.d/td-mailer-automation
```

---

## Task A5: Frontend — badge, score, filter

**Files:**
- Modify: `types.ts`
- Modify: `apps/crm/services/outreachService.ts`
- Modify: `apps/crm/components/EmailOutreach.tsx`

- [ ] **Step 1: Cập nhật `types.ts` — thêm 2 fields vào `CrmOutreachLead`**

Mở `types.ts`, tìm `interface CrmOutreachLead`, thêm sau field `source`:

```typescript
  trigger_source: 'generic' | 'hiring_signal' | 'funded' | 'csv_import' | 'crm_import' | 'discovery' | 'batch_discovery' | 'manual';
  lead_score: number;
```

- [ ] **Step 2: Cập nhật `fetchLeads` trong `outreachService.ts`**

Tìm `export async function fetchLeads`, update signature và query:

```typescript
export async function fetchLeads(filters?: {
  status?: string; tier?: number; source?: string; search?: string;
  trigger_source?: string;
}): Promise<CrmOutreachLead[]> {
  let q = supabase
    .from('crm_outreach_leads')
    .select('*')
    .order('lead_score', { ascending: false })  // sort: score cao nhất trước
    .order('tier')
    .order('created_at', { ascending: false });

  if (filters?.status) q = q.eq('outreach_status', filters.status);
  if (filters?.tier) q = q.eq('tier', filters.tier);
  if (filters?.source) q = q.eq('source', filters.source);
  if (filters?.trigger_source) q = q.eq('trigger_source', filters.trigger_source);
  if (filters?.search) {
    const safe = filters.search.trim().replace(/[(),%*]/g, '');
    if (safe) {
      q = q.or(`contact_name.ilike.%${safe}%,email.ilike.%${safe}%,studio_name.ilike.%${safe}%`);
    }
  }

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
```

- [ ] **Step 3: Thêm state `filterTrigger` vào `LeadsTab` trong `EmailOutreach.tsx`**

Tìm `const LeadsTab: React.FC<LeadsProps>`, thêm prop mới:

```typescript
// Thêm vào interface LeadsProps
filterTrigger: string;
setFilterTrigger: (v: string) => void;
```

Tìm `const EmailOutreach`, thêm state:
```typescript
const [filterTrigger, setFilterTrigger] = useState('');
```

Update `loadAll` để pass filter mới:
```typescript
svc.fetchLeads({
  search: searchQ || undefined,
  status: filterStatus || undefined,
  tier: filterTier || undefined,
  trigger_source: filterTrigger || undefined,
})
```

Pass prop xuống `LeadsTab`:
```tsx
<LeadsTab
  ...
  filterTrigger={filterTrigger} setFilterTrigger={setFilterTrigger}
/>
```

- [ ] **Step 4: Thêm filter dropdown và badge vào leads table**

Tìm Toolbar trong `LeadsTab` (cạnh select `filterTier`), thêm dropdown mới:

```tsx
<select
  style={{ ...inputStyle, width: '150px' }}
  value={filterTrigger}
  onChange={e => setFilterTrigger(e.target.value)}
>
  <option value="">Tất cả nguồn</option>
  <option value="hiring_signal">🔎 Hiring Signal</option>
  <option value="generic">Generic</option>
</select>
```

Trong leads table header, thêm cột `Signal` sau `Tier`:
```tsx
{['Tier', 'Signal', 'Contact', 'Email', 'Studio', 'Chức vụ', 'Trạng thái', 'Actions'].map(...)}
```

Trong leads table row, thêm cell sau Tier cell:
```tsx
<td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
  {lead.trigger_source === 'hiring_signal' ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span style={{
        fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: '4px',
        background: 'rgba(255,149,0,0.15)', color: '#FF9500',
      }}>🔎 Hiring</span>
      <span style={{ fontSize: '10px', color: '#FF9500', fontWeight: 700 }}>
        {lead.lead_score}pts
      </span>
    </div>
  ) : (
    <span style={{ fontSize: '10px', color: '#333' }}>—</span>
  )}
</td>
```

- [ ] **Step 5: Build và verify**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms
npm run build 2>&1 | tail -8
```

Expected: `✓ built in X.XXs` — không có TypeScript errors.

- [ ] **Step 6: Commit frontend**

```bash
git add types.ts apps/crm/services/outreachService.ts apps/crm/components/EmailOutreach.tsx
git commit -m "feat(crm): add trigger_source badge, lead_score and filter to leads table"
```

---

## Task A6: End-to-End Test Giai đoạn A

- [ ] **Step 1: Chạy hiring signals thật (lần đầu)**

```bash
ssh root@vps6core
PYTHONPATH=/opt/td-mailer-api python3 /opt/td-mailer-api/cron_hiring_signals.py
```

Expected: Leads được insert với email placeholder `__pending__studioname@hiring.signal`.

- [ ] **Step 2: Verify trong Supabase**

```sql
SELECT studio_name, job_title, trigger_source, lead_score, outreach_status, email
FROM crm_outreach_leads
WHERE trigger_source = 'hiring_signal'
ORDER BY lead_score DESC
LIMIT 10;
```

Expected: Rows với `trigger_source='hiring_signal'`, `lead_score=55/70/85`, `outreach_status='pending'`.

- [ ] **Step 3: Verify luồng cũ không bị ảnh hưởng**

```sql
-- Leads cũ vẫn có trigger_source='generic' và lead_score đúng
SELECT trigger_source, outreach_status, COUNT(*)
FROM crm_outreach_leads
GROUP BY 1, 2
ORDER BY 1, 2;
```

Expected: cả `generic` lẫn `hiring_signal` tồn tại, không có gì bị null hay sai.

- [ ] **Step 4: Verify Discord nhận đúng message**

Kiểm tra Discord channel — phải có embed màu cam "🔎 Hiring Signals — Kết quả hôm nay" với danh sách studios.

---

> ✅ **Giai đoạn A hoàn thành.** Hiring signal leads đã vào pipeline, chạy qua email sequence hiện tại. Chờ 1-2 tuần xem số lượng leads, tỷ lệ Apollo enrich email thành công, trước khi làm Giai đoạn B.

---

# ═══ GIAI ĐOẠN B ═══
# Làm SAU KHI Giai đoạn A vận hành ổn 1–2 tuần
# Touch code cũ — cần test kỹ

---

## Task B1: Email Template Personalized cho Hiring Signal

**Files:**
- SQL trên Supabase: insert vào `crm_email_templates`

- [ ] **Step 1: Kiểm tra template hiện tại trước**

```sql
SELECT name, array_length(subject_lines, 1) as subjects, is_active
FROM crm_email_templates ORDER BY name;
```

- [ ] **Step 2: Insert template mới**

```sql
INSERT INTO crm_email_templates (name, subject_lines, html_content, delay_days, is_active)
VALUES (
  'initial_outreach_hiring',
  ARRAY[
    'Re: {studio_name} is hiring — another option worth considering',
    'Alternative to hiring a {job_title} at {studio_name}',
    'Seen your {job_title} role at {studio_name} — TD Games here'
  ],
  '<p>Hi {first_name},</p>

<p>I noticed {studio_name} is currently looking for a {job_title} — that usually means a project is ramping up and the team needs extra hands.</p>

<p>We work with studios like yours on exactly this: art and animation outsourcing when you need more production capacity without a long-term hiring commitment. Character modeling, rigging, VFX, environment art — whatever the current project needs.</p>

<p>Rather than a generic pitch, I''d prefer to send you 2–3 sample assets that match your game''s visual style so you can judge quality directly. No calls, no decks — just the work.</p>

<p>Would that be useful?</p>

<p>Best,<br>Tony<br>TD Games — Art &amp; Animation Outsourcing<br>tdgamestudio.com</p>',
  0,
  true
)
ON CONFLICT (name) DO UPDATE SET
  subject_lines = EXCLUDED.subject_lines,
  html_content  = EXCLUDED.html_content,
  updated_at    = NOW();
```

- [ ] **Step 3: Verify template**

```sql
SELECT id, name, array_length(subject_lines, 1) as subjects, is_active, delay_days
FROM crm_email_templates
WHERE name = 'initial_outreach_hiring';
```

Expected: 1 row, `is_active=true`, `subjects=3`, `delay_days=0`.

---

## Task B2: Update `daily_send` — ưu tiên hiring leads + map template

**Files:**
- Modify (VPS): `/opt/td-mailer-api/routes/automation.py`

> ⚠️ **Backup trước khi sửa:**
> ```bash
> cp /opt/td-mailer-api/routes/automation.py /opt/td-mailer-api/routes/automation.py.bak-$(date +%Y%m%d)
> ```

- [ ] **Step 1: Backup**

```bash
ssh root@vps6core
cp /opt/td-mailer-api/routes/automation.py /opt/td-mailer-api/routes/automation.py.bak-$(date +%Y%m%d)
ls /opt/td-mailer-api/routes/automation.py.bak-*
```

- [ ] **Step 2: Đọc `daily_send` hiện tại để xác định chỗ sửa**

```bash
grep -n 'def daily_send\|get_pending_leads\|lead_ids\|_run_batch' /opt/td-mailer-api/routes/automation.py
```

Note lại line numbers của đoạn:
```python
pending = get_pending_leads(template_name="initial_outreach", limit=daily_limit)
if not pending:
    return ...
lead_ids = [l["id"] for l in pending]
```

- [ ] **Step 3: Thay đoạn lấy leads trong `daily_send`**

Thay đoạn từ `pending = get_pending_leads(...)` đến `lead_ids = [...]` bằng:

```python
from services.supabase_client import get_client as _gc_send
_db_send = _gc_send()

# Ưu tiên hiring_signal leads (có email thật, score cao)
_hiring_quota = max(1, daily_limit // 2)  # max nửa quota cho hiring signals
_hiring_leads = (
    _db_send.table("crm_outreach_leads")
    .select("*")
    .eq("outreach_status", "pending")
    .eq("trigger_source", "hiring_signal")
    .not_.like("email", "__pending__%")  # chỉ leads đã có email thật
    .order("lead_score", desc=True)
    .limit(_hiring_quota)
    .execute()
    .data or []
)

# Phần còn lại của quota dùng generic leads
_generic_quota = daily_limit - len(_hiring_leads)
_generic_leads = get_pending_leads(template_name="initial_outreach", limit=_generic_quota) if _generic_quota > 0 else []

# Merge (không trùng id)
_hiring_ids = {l["id"] for l in _hiring_leads}
pending = _hiring_leads + [l for l in _generic_leads if l["id"] not in _hiring_ids]

# Map lead_id → template_name
_template_map = {}
for _l in _hiring_leads:
    _template_map[_l["id"]] = "initial_outreach_hiring"
for _l in _generic_leads:
    _template_map[_l["id"]] = "initial_outreach"

if not pending:
    return {"status": "ok", "message": "Không có lead pending để gửi", "count": 0}

lead_ids = [l["id"] for l in pending]
```

- [ ] **Step 4: Pass `template_map` vào `_run_batch`**

Tìm dòng gọi `_run_batch` trong `daily_send`:
```python
t = threading.Thread(
    target=_run_batch,
    args=("initial_outreach", lead_ids, min_delay, max_delay),
    daemon=True,
)
```

Thay bằng:
```python
t = threading.Thread(
    target=_run_batch,
    args=("initial_outreach", lead_ids, min_delay, max_delay, _template_map),
    daemon=True,
)
```

---

## Task B3: Update `_run_batch` — nhận `template_map`

**Files:**
- Modify (VPS): `/opt/td-mailer-api/routes/email.py`

> ⚠️ **Backup trước khi sửa:**
> ```bash
> cp /opt/td-mailer-api/routes/email.py /opt/td-mailer-api/routes/email.py.bak-$(date +%Y%m%d)
> ```

- [ ] **Step 1: Backup**

```bash
ssh root@vps6core
cp /opt/td-mailer-api/routes/email.py /opt/td-mailer-api/routes/email.py.bak-$(date +%Y%m%d)
```

- [ ] **Step 2: Update signature `_run_batch`**

Tìm:
```python
def _run_batch(template_name, lead_ids, min_delay, max_delay):
```

Đổi thành:
```python
def _run_batch(template_name, lead_ids, min_delay, max_delay, template_map: dict | None = None):
```

- [ ] **Step 3: Trong loop của `_run_batch`, resolve template thực cho từng lead**

Tìm trong loop `for i, lid in enumerate(lead_ids):` đoạn lấy template:
```python
tpl = get_template(template_name)
```

Thay bằng:
```python
actual_template = (template_map or {}).get(lid, template_name)
tpl = get_template(actual_template)
```

Và tìm chỗ gọi `_send_one_lead(lead, tpl, template_name)`, thay `template_name` bằng `actual_template`:
```python
success, result = _send_one_lead(lead, tpl, actual_template)
```

- [ ] **Step 4: Restart service**

```bash
ssh root@vps6core
systemctl restart td-mailer-api && sleep 3 && systemctl is-active td-mailer-api
```

Expected: `active`

- [ ] **Step 5: Smoke test — verify daily_send vẫn chạy được**

```bash
ssh root@vps6core
curl -s -X POST http://localhost:8401/api/automation/daily-send \
  -H "X-Admin-Token: 36fc3fa7e1a6618b497d9c4c53937b5c8cf60c201b9a9316" \
  -H "Content-Type: application/json" | python3 -m json.tool
```

Expected: `{"status": "ok", ...}` hoặc `{"status": "started", ...}` — **không có lỗi**.

> **Nếu có lỗi:** Rollback ngay:
> ```bash
> cp /opt/td-mailer-api/routes/email.py.bak-YYYYMMDD /opt/td-mailer-api/routes/email.py
> cp /opt/td-mailer-api/routes/automation.py.bak-YYYYMMDD /opt/td-mailer-api/routes/automation.py
> systemctl restart td-mailer-api
> ```

- [ ] **Step 6: Commit backup files (optional) và log thay đổi**

```bash
# Không commit .bak files — chỉ ghi nhớ vị trí
echo "B giai đoạn done: $(date)" >> /opt/td-mailer-api/logs/hiring_signals.log
```

---

## Self-Review

**Spec coverage:**
- ✅ Hiring signal discovery (CSE) → Task A2
- ✅ `trigger_source` + `lead_score` → Task A1
- ✅ Cron 07:00 ICT → Task A3 + A4
- ✅ Email placeholder cho studios chưa có contact → Task A3
- ✅ Frontend badge + filter → Task A5
- ✅ E2E test Giai đoạn A → Task A6
- ✅ Template personalized → Task B1
- ✅ Ưu tiên quota hiring leads → Task B2
- ✅ `_run_batch` nhận template_map → Task B3
- ✅ Backup + rollback instructions → Task B2, B3

**Placeholder scan:** Không có TBD.

**Type consistency:**
- `trigger_source` dùng nhất quán: `TEXT` (DB) → `string` (Python) → `string` (TypeScript)
- `lead_score` dùng nhất quán: `INTEGER` (DB) → `int` (Python) → `number` (TypeScript)
- `template_map: dict | None` — default `None` đảm bảo backward-compatible với tất cả caller cũ của `_run_batch`

---

## Roadmap tiếp theo (Phase 2 + 3)

**Phase 2** (sau khi Phase 1 ổn định ~4 tuần):
- Open rate scoring: re-score leads theo Resend open/click events
- Hot lead alert: Discord khi lead mở email 2+ lần

**Phase 3:**
- Crunchbase funded studios integration
- Seasonal scheduling (tăng quota Jan-Feb, giảm Nov-Dec)
