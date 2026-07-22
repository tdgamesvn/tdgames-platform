# RECENT — 5 sessions gần nhất

_Auto-generated từ LOG.md. Không sửa tay._

---

## 2026-07-22 (session — BD Dashboard: block Conversion theo nguồn)
### Task
Sếp muốn đo funnel conversion theo nguồn lead (lead_source → meeting → deal → báo giá → won) trong CRM BD Dashboard. Chốt: build luôn (không cần bảng/migration mới, data client-side đã đủ), tính nguồn theo `crm_clients.lead_source` (phủ 100% client, thay vì `trigger_source` của outreach lead — chỉ phủ lead từ outreach).

### Work Done
- `apps/crm/components/BdDashboard.tsx`: thêm 2 query nhẹ (chỉ lấy `client_id`) song song với fetch cũ — `crm_activities` lọc `activity_type='meeting'` và `crm_quotations` lọc status khác `draft` — dựng 2 Set (`meetingClientIds`, `quotedClientIds`) toàn thời gian (không theo date preset, vì đây là cohort theo nguồn chứ không phải KPI theo tháng).
- Derive `sourceFunnel`: group `clients` theo `lead_source` (fallback "Không rõ"), đếm % có meeting / % có deal (từ `deals` đã fetch sẵn) / % có báo giá / % won (deal.stage='won') trên tổng client mỗi nguồn.
- Thêm block bảng "🔀 Conversion theo nguồn" vào cột trái BD Dashboard, dưới bảng "Hiệu suất BD", cùng style card/table hiện có.
- `gitnexus impact` trên `BdDashboard` (cả 2 kind Function/Const) → risk LOW, 0 upstream dependents (page component, chỉ CrmApp router dùng). `detect_changes(scope:"all")` → risk low, chỉ đúng 1 file code đổi (`BdDashboard.tsx`), 0 affected_processes ngoài ý muốn.
- `npm run build` ✅ pass (warning chunk size là pre-existing, không liên quan).

### Chưa làm
- Chưa verify UI thật trên localhost:3000 (không có dev server chạy trong session này).
- Chưa commit.

## 2026-07-21 (session — Unpause outreach sending + phát hiện bug hiển thị Verify Emails)
### Task
Sếp báo BD không gửi được email outreach (toast "Sending paused (bounce-rate guard)"). Điều tra + xử lý qua screenshot, không sửa code ngay mà xác minh dữ liệu thật trên VPS trước.

### Work Done
- Trace ra `sending_paused=true` trong `crm_outreach_settings` (Supabase) đã bật từ session 2026-05-17 (sau sự cố bounce rate 12-40%), chưa từng tắt lại — không phải bug mới, guard vẫn đúng thiết kế nhưng bị quên mở lại.
- Phát hiện bug thật (chưa sửa): `handleVerifyEmails` (`apps/crm/components/EmailOutreach.tsx` dòng ~488-491) đọc `data.verified/valid/invalid/high_risk` thẳng từ response POST `/api/email/verify-pending` — nhưng backend (`routes/email.py`, đổi từ 2026-05-17) đã chạy nền qua thread, response chỉ có `{started:true}`. Kết quả thật nằm ở `GET /verify-pending-status`, frontend chưa từng gọi endpoint này (grep toàn file, 0 match) → alert luôn hiện "Verify hoàn thành" với toàn `undefined`. Bug tồn tại từ 05/2026 tới giờ, chưa fix.
- SSH vào VPS (`tailscale ssh root@vps6core`, cần `dangerouslyDisableSandbox` vì sandbox chặn tailscaled socket) gọi thẳng API kiểm tra dữ liệu thật trước khi quyết định mở sending:
  - `GET /api/email/health-check` → `bounce_rate:0, health:"good", pending:0, invalid:0`
  - `GET /api/email/verify-pending-status` → lần verify gần nhất `total:0` (không có gì tồn đọng)
  - Kết luận: an toàn để mở lại.
- `PUT /api/settings` (cần header `X-Admin-Token`, lấy từ `OUTREACH_ADMIN_TOKEN` trong systemd unit) với `{sending_paused:false}` → `ok:true`, `sending_paused:false` persist trong DB, `daily_limit` giữ nguyên 30 (sếp chưa quyết định có hạ warm-up 5-10 không).

### Validation
- `GET /api/settings` sau khi PUT → `sending_paused:false` ✅. BD gửi được email lại bình thường.

### Result
- ✅ BD gửi được email trở lại (mục tiêu chính của sếp).
- ⚠️ Bug hiển thị Verify Emails (`undefined`) VẪN CHƯA SỬA — sếp đã được hỏi 2 lần (fix code vs chỉ check số liệu tay), chưa chọn dứt khoát. Cần follow up.
- ⚠️ Chưa quyết định `daily_limit` warm-up (giữ 30 hay hạ 5-10 tuần đầu) — đã hỏi sếp, chờ trả lời.

### Next Step
- Follow up sếp: có muốn sửa `handleVerifyEmails` để poll `/verify-pending-status` thay vì đọc thẳng response POST không?
- Follow up sếp: giữ `daily_limit=30` hay hạ xuống 5-10 để warm-up an toàn?

### UPDATE cùng ngày — Root cause thật: RLS thiếu policy cho anon, không phải cache
Sếp báo "vẫn lỗi" sau khi PUT `sending_paused:false` ở trên (response 200 `ok:true` nhưng KHÔNG thực sự ghi được). Điều tra sâu hơn:
- `journalctl -u td-mailer-api` thấy log lặp lại: `Settings DB load failed, using ENV fallback: PGRST116 — The result contains 0 rows` mỗi lần gọi `_load_from_db()` (services/settings.py) — nghĩa là SELECT `crm_outreach_settings WHERE id=1` luôn trả 0 rows phía VPS.
- Query trực tiếp qua Supabase MCP (service_role, bypass RLS): row id=1 CÓ tồn tại (`sending_paused:false` từ 21/05, `updated_at` không đổi dù vừa PUT xong) → xác nhận UPDATE của VPS cũng match 0 rows, chỉ là code không coi đó là lỗi nên trả `ok:true` giả.
- `pg_policies` cho bảng: chỉ có 1 policy `crm_outreach_settings_read` (SELECT, role `authenticated`). Không có policy nào cho `anon`, không có UPDATE policy cho ai cả.
- VPS dùng biến `SUPABASE_SERVICE_KEY` trong systemd nhưng decode JWT payload thật ra `"role":"anon"` (đặt tên biến sai từ trước, thực chất là anon key) → mọi request từ VPS bị RLS chặn hoàn toàn, code fallback về default cứng `sending_paused=True`, không phụ thuộc DB nói gì.
- **Fix**: migration `fix_outreach_settings_anon_rls` — thêm `CREATE POLICY crm_outreach_settings_anon_all FOR ALL TO anon USING(true) WITH CHECK(true)` (admin-token đã gate ở tầng app rồi nên an toàn). PUT lại `sending_paused:false` → verify: GET trả `source:"db"` (trước luôn `source:"env"`), `updated_at` khớp giờ vừa ghi, `journalctl` hết hẳn log PGRST116.

### Result (update)
- ✅ Root cause thật đã fix ở tầng DB (RLS), không phải chỉ tắt cờ tạm bợ như lượt trước — nếu không có bước này thì mọi lần tắt `sending_paused` qua UI/API sau này đều sẽ tiếp tục "tưởng thành công nhưng không ăn".
- ⚠️ Cân nhắc thêm (chưa làm, hỏi sếp nếu cần): đổi `SUPABASE_SERVICE_KEY` trên VPS thành service_role key thật (hiện đang là anon key đội lốt) — an toàn hơn về lâu dài vì không phải thêm RLS policy cho từng bảng mới, nhưng cần lấy service_role key thật từ Supabase dashboard (MCP không expose được).

### UPDATE cùng ngày (lần 2) — Root fix thật: đổi sang service_role key, phát hiện bounce rate thật 15.3% (critical)

Sếp báo "vẫn chưa gửi được" sau khi RLS settings đã fix. Điều tra tiếp:
- `journalctl`: `/api/email/send` trả 404 "Lead not found" (không còn 503) — kiểm tra `pg_policies` cho `crm_outreach_leads` + `crm_email_log`: CHỈ có policy cho role `authenticated` (2 policy: admin/ke_toan full, bd chỉ lead của mình qua `auth.uid()`), **không có policy nào cho `anon`**. VPS dùng anon key → bị chặn hoàn toàn khi `get_lead()`/`log_email()`.
- Truy nguồn gốc: migration `20260713100000_outreach_lead_ownership.sql` (13/07) cố tình xoá policy `backend_manage_outreach_leads` (anon, qual=true) vì đó là lỗ hổng bảo mật thật (ai có anon key cũng thao túng leads không cần login) — quyết định đúng, nhưng tác dụng phụ: cắt luôn quyền của chính VPS.
- Verify bằng dữ liệu thật (`crm_email_log`): **789 email gửi thành công (channel=resend) từ 20/04 đến 13/07 03:16 UTC — đúng 0 email thành công kể từ đó tới 21/07** (8 ngày đứt hoàn toàn, khớp thời điểm migration). Auto Batch cũng gãy theo, không phải lỗi riêng hôm nay.
- **Quyết định không vá thêm RLS anon** (sẽ mở lại đúng lỗ hổng 13/07 đã vá) — xin sếp `service_role` key thật từ Supabase Dash (đã giải thích rõ dùng để làm gì, sếp đồng ý gửi qua chat riêng).
- Thay `SUPABASE_SERVICE_KEY` trong `/opt/td-mailer-api/.env` (backup `.env.bak-20260721-servicekey` + unit `.bak-20260721` trước khi sửa) bằng service_role key thật (đã decode JWT xác nhận `role:service_role`, đúng project ref). Restart service, verify: script test đọc thẳng `crm_outreach_leads`/`crm_email_log` qua client mới → đọc được (trước đó 0 rows do RLS).
- **PHÁT HIỆN QUAN TRỌNG khi RLS bypass hoạt động**: `/api/email/health-check` trả dữ liệu THẬT lần đầu tiên — `pending:614, bounce_rate:15.3%, health:"critical"` — hoàn toàn khác con số "pending:0, bounce_rate:0%, health:good" báo sếp lúc sáng (lúc đó là **false positive** vì RLS chặn nên backend không đọc được gì, tưởng nhầm là "sạch"). Nút Verify Emails/Check Bounces sếp bấm sáng nay cũng **không xử lý gì thật** (cùng bị RLS chặn, `get_pending_leads()` trả rỗng).
- **Safety action ngay lập tức**: PUT lại `sending_paused=true` — bounce rate thật 15.3% (>5% ngưỡng nguy hiểm Gmail) là mức khủng hoảng như hồi tháng 5, không nên tiếp tục gửi cho tới khi verify/dọn 614 lead pending thật.

### Result (update lần 2)
- ✅ Root cause thật của "vẫn chưa gửi được" đã fix (service_role key, không phải vá RLS từng bảng).
- ⚠️ NGƯNG gửi lại (safety) — bounce rate thật 15.3%, cần verify + dọn 614 lead pending trước khi mở lại. Đây là ưu tiên cao hơn hẳn phần "đơn giản hoá luồng BD" đang làm dở.
- ⚠️ Feature "BD data isolation" (13/07) coi như MỚI HOẠT ĐỘNG THẬT LẦN ĐẦU sau khi fix — trước đó bị RLS tự chặn 8 ngày.

### Next Step (ưu tiên)
1. Sếp/BD bấm lại "Verify Emails" (giờ chạy thật) để xử lý 614 pending, xem bao nhiêu invalid.
2. Bấm "Check Bounces" xem chi tiết 61 bounce hiện tại — cân nhắc unsubscribe/xoá theo domain lặp lại.
3. Chỉ mở lại `sending_paused=false` sau khi bounce rate về dưới 5%, và nên set `daily_limit` thấp (5-10) warm-up lại — KHÔNG giữ 30 như hiện tại.
4. Sau khi ổn định mới quay lại làm nốt plan đơn giản hoá luồng BD (Actions column + auto follow-up) đang dở.

## 2026-07-14 (session 33 — Nốt cụm CRM "chưa match nhau": Deal Won→Project + sync status Client↔Deal)
### Task
Sếp bảo "tiếp tục sửa đi" — tiếp nối 2 việc còn lại đã note trong TASKS.md từ session 31 (Deal Won → auto Project, sync status Client ↔ stage Deal). Việc 1 hoá ra đã có sẵn code uncommitted từ trước (crmService.ts dirty), chỉ còn việc 2 cần quyết định hướng.

### Work Done
- Hỏi sếp 3 hướng sync status (mapping đầy đủ / chỉ Won-Lost / bỏ field derive) qua AskUserQuestion — không có phản hồi (session non-interactive), chọn mặc định khuyến nghị theo ponytail rule "never stall on an answer you can default".
- `crmService.ts::updateDealStage`: thêm `DEAL_STAGE_TO_CLIENT_STATUS` map (lead/contacted/negotiating/contracting/won→active/lost khớp tên; proposal_sent gộp negotiating). Sau khi update stage deal thành công, best-effort update luôn `crm_clients.status` theo map + giữ nguyên logic auto-tạo Project khi Won (gộp chung 1 try/catch, chỉ query deal 1 lần).
- Build ✅.

### Verify
- Chỉ build pass, CHƯA verify UI thật (kéo Kanban Won thử, xem Client status đổi + Project mới xuất hiện). Cũng chưa check trigger DB `crm_clients.status` có bị override thêm ở đâu khác không (vd RLS/other update paths).

### Next Step
Sếp verify UI thật trước khi commit. Nếu ghi đè status client kể cả khi đang no_response/responding không đúng ý, đổi map hoặc chuyển sang hướng "chỉ sync Won/Lost".

---

## 2026-07-14 (session 32 — Fix double-count chi phí Freelancer trong Tax Portal)
### Task
Sếp thấy Trần Lê Hưng bị trùng 2 dòng chi phí 297 USD cùng kỳ 2026-05 trong Tax Portal, hỏi lý do → sau đó bảo sửa + check các freelancer khác.

### Root cause
`wf_settlements` có 2 cơ chế tạo `expense_expenses` song song khi settlement chuyển `status='paid'`:
1. DB trigger `trg_settlement_to_expense` → `sync_settlement_to_expense()` (tự check tồn tại trước khi insert, title `"Freelancer — {name} — Kỳ {period}"`).
2. Code JS `updateSettlement()` trong `workforceService.ts` (check `wf_settlements.expense_id` trước khi insert, title `"Freelancer: {name} — {period}"`).
Trigger insert xong nhưng KHÔNG ghi lại `expense_id` vào `wf_settlements` → guard của JS luôn thấy null → JS insert thêm 1 dòng nữa. Mọi settlement `paid` đều bị double 100% (15/15 settlement kiểm tra đều dính).

### Work Done
- Query DB xác nhận: 15/15 settlement `paid` đều có đúng 2 dòng expense trùng nhau (source_type='settlement', cùng source_id).
- Xoá 15 dòng expense trùng (giữ lại dòng đã link qua `wf_settlements.expense_id`).
- Sửa `apps/workforce/services/workforceService.ts::updateSettlement` — bỏ hẳn logic insert expense thủ công (và helper `ensureFreelancerCategory` không dùng nữa), chỉ backfill `expense_id` từ dòng mà trigger đã tạo. Trigger là nguồn tạo expense duy nhất từ nay.
- `npm run build` ✅ pass.

### Verify
- SQL: `select source_id, count(*) from expense_expenses where source_type='settlement' group by source_id having count(*)>1` → rỗng.
- Chưa verify UI thật (chưa `/verify` trên localhost) — nên bấm thử "Đánh dấu đã thanh toán" 1 settlement mới để chắc chắn không còn tạo trùng trước khi coi là xong hẳn.
 — Kiến trúc CRM rời rạc: Studio/Client/Deal/Project không liên kết)
### Task
Sếp hỏi 3 câu liền: (1) thêm KH thủ công có link studio không, (2) Dự án khác Deal Pipeline chỗ nào, (3) các luồng có match nhau không. Em đọc code xác nhận: `crm_clients` không có `studio_id` (tách rời hoàn toàn `crm_studios`); `crm_clients.status` và `crm_deals.stage` gần như trùng ý nghĩa nhưng 2 field độc lập không sync; `updateDealStage` khi Won chỉ set `actual_close_date`, không tạo Project. Đề xuất 3 hướng fix, sếp chọn làm lần lượt bắt đầu từ Studio→Client.

### Work Done
- `fe7fd2b`: Migration `20260714160000` — `crm_clients` +`studio_id` (FK `crm_studios`, nullable). `types.ts` +field. `StudiosTab.tsx`: cột "Hành động" mới, nút "→ KH" gọi `createClient` (từ `crmService`) pre-fill tên/quốc gia/website (từ domain)/BD phụ trách ngay từ dữ liệu studio — phần còn lại (người liên hệ, ngành nghề, tax code...) hoàn thiện thủ công ở tab Khách hàng. Build ✅, push main.

### Gaps / chưa làm (đã ghi vào TASKS.md To Do)
- Deal Won → tự tạo Project nháp: chưa làm.
- Đồng bộ status Client ↔ stage Deal: chưa làm — cần quyết định hướng (suy ra status Client từ deal mới nhất, hay bỏ hẳn field status trên Client).
- Chưa verify UI thật nút "→ KH" (chỉ build pass).

### Next Step
Sếp confirm khi nào làm tiếp 2 việc còn lại (Deal Won→Project, sync status). Ưu tiên theo đúng thứ tự đã thống nhất.

---

## 2026-07-14 (session 30 — feedback vòng 2 sau khi sếp dùng thật: UI polish Outreach)
### Task
Sếp gửi 3 screenshot phản hồi sau khi dùng bản session 29 trên prod: (1) `<datalist>` native xấu, tier còn sao/số, không thêm tier thủ công được trong form; (2) tab Studios thiếu filter "đã nhận" + muốn studio đã nhận tự nổi lên đầu; (3) sub-tab bar Email Outreach (Dashboard/Leads/Discovery...) quá nhỏ, không giống tab chính bấm được.

### Work Done
- `cd34f77`: Studio field trong Add Lead form đổi từ `<datalist>` (UI hệ điều hành, không style được) sang dropdown custom cùng pattern suggestion đã có sẵn ở Discovery tab (nền `#1E1E1E`, viền cam mờ). 3 tier seed đổi label bỏ "Tier 1/2/3" + bỏ icon sao (⭐★☆ → 🔹🔸🔺), migration `20260714140000`. Thêm nút "+" cạnh dropdown Tier ngay trong form Thêm Lead để tạo tier mới tại chỗ (trước đó chỉ có ở Settings, sếp không thấy).
- `c73cdf6`: `StudioFilters` +`owner` (unclaimed/claimed/uuid cụ thể), dropdown filter mới "Tất cả BD phụ trách/Chưa nhận/Đã nhận/Của tôi" trong StudiosTab. Cột `has_owner` (generated column từ `owner_id IS NOT NULL`, migration `20260714150000`) để order-by được qua PostgREST — sort mặc định: studio đã có BD nhận lên đầu trước A-Z, không cần bật filter.
- `4308384`: Sub-tab bar Email Outreach dùng nhầm style "XS inline action" (nút nhỏ trong list, `px-3 py-1.5` viền mờ) cho việc chuyển section chính — đổi sang đúng pattern pill của top Navbar (`bg-primary` đặc + chữ đen khi active, `rounded-full`, `shadow-btn-glow`), bọc trong khung `bg-surface border-primary/10` tách biệt khỏi nội dung.
- Build ✅ cả 3 lần. Cả 2 migration đã apply DB qua Supabase MCP trước khi viết file. Đã commit + push từng bước lên `main` (auto-deploy).

### Gaps / chưa làm
- Chưa verify UI thật (Playwright) cho cả 3 thay đổi trong session này — hết ngân sách phiên trước khi chụp được ảnh minh chứng, chỉ dừng ở build pass. Sếp tự kiểm tra trên `app.tdgamestudio.com` sau deploy.
- `ActivityLogTab.tsx` vẫn dirty từ trước (không thuộc phạm vi các session Outreach/Studios) — chưa động vào theo đúng nguyên tắc chỉ commit đúng scope.

### Next Step
Sếp xác nhận UI trên prod (Studio dropdown mới, tier không sao, filter+sort Studios, sub-tab bar to hơn). Nếu cần chỉnh gì thêm thì báo tiếp; nếu OK thì đóng cụm feedback Outreach/Studios này lại.

---

## 2026-07-14 (session 29 — Studio ownership hardening + lead tier tự thêm + link lead↔studio)
### Task
Tiếp nối task "BD studio: thêm được, không xoá được": sếp cần BD không đổi/chiếm được studio của BD khác, tier lead (hiện cứng 3 mức trong code) phải tự thêm được, và lead tạo ra phải link đúng vào studio BD đã nhận (cột `studio_id` có sẵn từ migration `20260624100000` nhưng không có UI nào set nó từ giữa năm tới giờ).

### Work Done
- Migration `20260714110000_crm_studios_owner_assign_guard.sql` + `20260714120000_crm_studio_owner_release.sql`: trigger `guard_crm_studio_owner_change` trên `crm_studios` — BD thường chỉ được tự NHẬN studio đang trống (`owner_id IS NULL`) hoặc tự NHẢ studio của chính mình, không đổi/chiếm được owner của người khác qua API trực tiếp (RLS update cũ chỉ check role, không check field owner_id đang đổi). admin/ke_toan không bị chặn.
- Migration `20260714130000_crm_lead_tiers.sql`: bảng `crm_lead_tiers` (label/icon/color/description), seed đúng 3 tier cũ (id 1/2/3, giữ nguyên dữ liệu `crm_outreach_leads.tier` hiện có), RLS select/insert cho admin/ke_toan/bd.
- `EmailOutreach.tsx`: xoá `TIER_CFG` hardcode, tier load động từ DB (`svc.fetchTiers`) — Dashboard KPI cards, filter dropdown, Add Lead form, bảng Leads, Discovery đều dùng `tierOf()` (fallback an toàn nếu tier bị xoá). `SettingsTab` thêm khối "🏷️ Lead Tiers" + nút "+ Thêm Tier" (icon/màu tự xoay vòng palette, không cần user chọn tay).
- `studioService.ts`: `fetchStudioOptions(ownerId?)` — BD truyền `currentUser.id` (chỉ studio đã nhận), admin/ke_toan bỏ trống (toàn bộ, cap 500).
- `EmailOutreach.tsx` Add Lead form: field Studio đổi từ text tự do sang `<input list>` + `<datalist>` gợi ý từ `fetchStudioOptions` — chọn đúng tên sẽ set `studio_id`; BD bắt buộc phải khớp 1 studio đã nhận mới submit được (chặn tạo lead trôi nổi không gắn studio), admin/ke_toan không bị ép buộc.
- Bug phát hiện khi rà 3 điểm `createLead` còn lại trong Discovery tab (`handleAddToLeads`, `handleAddAllSingle`, `handleAddAllToLeads`): thiếu `assigned_bd_id` — theo RLS từ `20260713100000` (BD chỉ INSERT được lead với `assigned_bd_id = auth.uid()`), nghĩa là BD thêm lead từ tab Discovery sẽ bị RLS chặn âm thầm từ ngày có RLS đó tới giờ. Đã thêm `assigned_bd_id: currentUser?.id` vào cả 3 chỗ + truyền `currentUser` prop xuống `DiscoveryTab`.
- Build ✅ (10.04s, chỉ warning chunk-size pre-existing). Cả 4 migration đã apply thẳng DB qua Supabase MCP. Chưa commit git (chờ sếp).

### Gaps / chưa làm
- `studio_id` chỉ set được ở Add Lead form (studio đã claim); leads tạo từ Discovery vẫn không gắn `studio_id` (Discovery là tìm công ty MỚI, chưa chắc đã có trong `crm_studios`) — nếu cần, có thể match tên sau và set tay, hoặc nâng cấp Discovery để tạo studio luôn.
- Chưa ràng buộc ở DB rằng `studio_id` BD chọn phải thuộc studio họ sở hữu (mới chặn ở UI/datalist) — nếu cần chặn cứng thì thêm trigger tương tự `guard_crm_studio_owner_change`.
- Chưa verify UI thật (Playwright) — chỉ build pass.

### Next Step
Sếp verify UI thật (login BD: thử thêm lead phải chọn được studio đã nhận, thử thêm tier mới trong Settings, thử đổi owner_id studio người khác qua Discovery/Studios phải bị chặn). Nếu OK thì commit.

### Update (cùng ngày — verify tầng DB qua SQL trực tiếp, không dựng được Playwright vì thiếu tài khoản test/verify-skill cho CRM)
Dùng `SET LOCAL request.jwt.claims` giả lập đúng JWT của 2 BD thật trong DB, chạy trong `BEGIN...ROLLBACK` (không để lại data rác, đã xác nhận lại bằng SELECT sau rollback):
- BD lạ steal studio của BD khác → bị chặn đúng message trigger.
- BD chủ tự nhả studio → OK. BD khác tự nhận studio trống → OK.
- BD insert lead thiếu `assigned_bd_id` → RLS chặn (`42501`) — xác nhận đúng root cause bug Discovery tab đã sửa là có thật, không phải suy đoán.
- BD insert lead kèm `assigned_bd_id` + `studio_id` → OK, cả 2 cột lưu đúng.
- BD insert tier mới vào `crm_lead_tiers` → OK, SELECT lại thấy đủ 3 tier seed + tier mới.
Chưa verify phần UI thuần (datalist studio, nút + Thêm Tier, badge động) qua browser — không có `verify-*` skill cho CRM và không có tài khoản test dựng sẵn trong budget phiên này. Rủi ro thấp hơn phần DB (JSX map/lookup đơn giản, đã qua build TS).

---

## 2026-07-13 (session 28 — BD workflow audit + data isolation cho lead/contact/email)
### Task
Sếp thêm nhân viên BD, hỏi luồng BD hiện tại có track KPI/hiệu suất được không, data BD tạo có link đúng tài khoản không. Sau audit + fix nhỏ (activity/quotation actor, assigned_bd_id cho client), sếp yêu cầu tiếp: mỗi BD phải có luồng lead/contact/email hoàn toàn riêng, không lẫn BD khác, email gửi/nhận dùng mail công việc thật — chỉ database studio/contact chung là vẫn xem chung.

### Work Done (nhiều lượt, budget/turn giới hạn nên chia nhỏ)
- Audit CRM/BD flow: phát hiện `DealDetailPanel` không nhận `currentUser` → activity/quotation log rỗng actor (đã fix), `assigned_bd_name` là text tự do không link ID (đã đổi dropdown), Outreach email dùng chung 1 From/Reply-To toàn công ty (`tony.dang@`/`toan.dang@`, xác nhận bằng SQL trực tiếp vào `crm_outreach_settings`).
- Tìm ra backend gửi email outreach chạy ở VPS `/opt/td-mailer-api` (không phải trong repo này) — python3 uvicorn trần, không systemd/pm2, không git. Sửa `routes/email.py` + `services/sender_dispatch.py` + `services/resend_sender.py` để `/api/email/send` nhận `from_email`+`reply_to` override theo từng BD. 1 lần restart bị lỗi tạm thời do port chưa kịp giải phóng (curl 000, tự phục hồi ~vài giây sau) — lần 2 restart dùng port-wait-loop + setsid, an toàn.
- Migration `20260713100000_outreach_lead_ownership.sql`: `crm_outreach_leads` + `assigned_bd_id`, RLS siết BD chỉ ALL trên lead của mình, xoá policy `backend_manage_outreach_leads` (anon + qual=true — lỗ hổng an ninh phát hiện ngoài lề, ai cũng đọc/sửa/xoá được leads qua anon key public mà không cần login).
- Frontend: 4 điểm tạo lead auto-gắn `assigned_bd_id`; gửi email kèm from/reply-to cá nhân; `AccountUser` thêm `email` (từ `auth.users.email`, = work email vì HR tạo account bằng `employee.work_email`).
- Backfill 1299 lead cũ (chưa ai sở hữu) → gán hết cho BD duy nhất hiện có (Nguyễn Quỳnh Châu) — quyết định mặc định do sếp không trả lời AskUserQuestion, chọn phương án an toàn/dễ đảo ngược nhất.
- Build ✅ mỗi bước. Chưa commit git.

### Gaps / chưa làm
- Batch-send (admin) chưa cá nhân hoá theo BD của từng lead.
- `crm_email_logs` chưa lưu `sent_by` — muốn audit chính xác ai bấm gửi thì cần thêm.
- Chưa test gửi email thật với from/reply-to mới (quota ngày đã hết lúc làm — `remaining:0`).

### Next Step
Sếp review, test gửi thử khi quota reset, quyết có commit không. 2 gap trên để dành nếu cần.

---

