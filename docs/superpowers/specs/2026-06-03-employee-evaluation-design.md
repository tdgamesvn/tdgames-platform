# Employee Evaluation System — Design Spec
_Date: 2026-06-03 | Project: tdgames-platforms_

---

## 1. Overview

Hệ thống đánh giá nhân viên tích hợp vào HR app, hỗ trợ:
- Đánh giá hết thử việc (probation end review)
- Review định kỳ 6 tháng 1 lần
- Template linh hoạt: admin tạo tiêu chí, trọng số, câu hỏi tự luận
- Nhân viên tự đánh giá + leader đánh giá độc lập
- Cả hai xem được kết quả sau khi cả hai đã submit
- HR ra kết luận + hành động + mục tiêu kỳ tiếp

---

## 2. Luồng chính

```
HR tạo kỳ đánh giá (chọn NV + template + leader + ngày deadline)
    ↓
Noti in-app + email → Nhân viên + Leader
    ↓
Nhân viên điền self-assessment → submit   (status: pending_self → pending_leader)
    ↓
Leader điền evaluation → submit           (status: pending_leader → pending_hr)
    ↓
[Unlock] Cả hai xem được form của nhau
    ↓
HR vào xem cả hai form
    → Chọn: kết luận + hành động + mục tiêu kỳ tiếp → close
    (status: pending_hr → completed)
    ↓
Noti → Nhân viên nhận kết quả
```

**Tự động nhắc:** Cronjob hàng ngày check:
- NV còn 5 ngày hết thử việc (`probation_end`) → noti cho HR
- NV đến kỳ review 6 tháng (tính từ `official_date`) → noti cho HR

---

## 3. Data Schema

### `hr_eval_templates`
```sql
id            uuid PRIMARY KEY
name          text NOT NULL                -- "Đánh giá hết thử việc", "Review 6 tháng"
type          text                         -- 'probation' | 'semi_annual' | 'annual'
criteria      jsonb NOT NULL DEFAULT '[]'  -- [{key, label, type:'score'|'text', weight, max_score}]
self_questions  jsonb DEFAULT '[]'         -- [{key, question, type:'text'|'score'}]
leader_questions jsonb DEFAULT '[]'        -- [{key, question, type:'text'|'score'}]
is_active     boolean DEFAULT true
created_by    uuid
created_at    timestamptz DEFAULT now()
```

**Ví dụ criteria:**
```json
[
  {"key": "work_quality", "label": "Chất lượng công việc", "type": "score", "weight": 30, "max_score": 10},
  {"key": "attitude",     "label": "Thái độ & tinh thần",  "type": "score", "weight": 20, "max_score": 10},
  {"key": "teamwork",     "label": "Làm việc nhóm",        "type": "score", "weight": 20, "max_score": 10},
  {"key": "initiative",   "label": "Chủ động & sáng tạo",  "type": "score", "weight": 15, "max_score": 10},
  {"key": "reliability",  "label": "Đáng tin cậy & đúng giờ", "type": "score", "weight": 15, "max_score": 10}
]
```

### `hr_evaluations` (mở rộng bảng có sẵn)
```sql
-- Thêm các cột mới:
template_id           uuid REFERENCES hr_eval_templates(id)
type                  text  -- 'probation_end' | 'semi_annual'
review_period_start   date
review_period_end     date
status                text DEFAULT 'pending_self'
  -- 'pending_self' | 'pending_leader' | 'pending_hr' | 'completed' | 'cancelled'
leader_id             uuid  -- auth user id của leader

self_submitted_at     timestamptz
self_answers          jsonb  -- {criteria: {key: score}, questions: {key: text}}
self_overall_score    numeric(5,2)  -- tính từ criteria * weight

leader_submitted_at   timestamptz
leader_answers        jsonb
leader_overall_score  numeric(5,2)

hr_conclusion         text  -- 'pass' | 'needs_improvement' | 'fail'
hr_action             text  -- 'confirm_official' | 'salary_increase' | 'extend_probation' | 'terminate' | null
hr_action_notes       text
hr_goals_next         jsonb  -- [{goal, deadline, metric}]
hr_closed_by          uuid
hr_closed_at          timestamptz

deadline              date
created_by            uuid
```

---

## 4. UI Components

### HR App — Tab "Đánh giá" (mới trong apps/hr/)

**4.1 EvalTemplatePanel** — Quản lý templates
- Danh sách templates
- Form tạo/sửa: tên, loại, thêm/xóa tiêu chí, câu hỏi

**4.2 EvalCycleList** — Danh sách kỳ đánh giá
- Filter: all / pending / completed
- Badge status: ⏳ Chờ NV / ⏳ Chờ Leader / 📋 Chờ HR / ✅ Hoàn thành
- Nút "Tạo kỳ đánh giá"

**4.3 EvalCycleDetail** — Chi tiết 1 kỳ
- Section: Self-assessment của NV (locked cho đến khi cả 2 submit)
- Section: Evaluation của Leader
- Section: HR Decision (kết luận + hành động + mục tiêu)
- Điểm tổng hợp (nếu có criteria dạng score)

**4.4 CreateEvalModal** — Tạo kỳ mới
- Chọn nhân viên, template, leader, deadline

### Employee Portal — Tab "Đánh giá" (mới trong apps/portal/)

**4.5 PortalEvalList** — Danh sách kỳ của nhân viên
**4.6 PortalEvalForm** — Điền self-assessment (khi pending_self)
**4.7 PortalEvalResult** — Xem kết quả sau khi completed

---

## 5. Services & Backend

### `apps/hr/services/evalService.ts`
- `fetchEvalTemplates()` / `saveTemplate()` / `deleteTemplate()`
- `fetchEvalCycles(filter?)` / `createEvalCycle()` / `closeEvalCycle()`
- `submitLeaderEval(cycleId, answers)`

### `apps/portal/services/portalService.ts` (mở rộng)
- `fetchMyEvaluations(employeeId)`
- `submitSelfEval(cycleId, answers)`

### Notifications
- Khi HR tạo kỳ → noti cho NV + Leader
- Khi NV submit → noti cho Leader
- Khi Leader submit → noti cho HR + unlock cho NV/Leader
- Khi HR close → noti cho NV (kết quả)

### Auto-reminder (Supabase Edge Function hoặc DB trigger)
- Check hàng ngày: NV sắp hết thử việc → noti HR
- Check hàng ngày: NV đến kỳ review 6 tháng → noti HR

---

## 6. RLS Policies

| Table | Role | Permission |
|---|---|---|
| hr_eval_templates | staff | ALL |
| hr_eval_templates | employee | SELECT (is_active) |
| hr_evaluations | staff | ALL |
| hr_evaluations | employee (own) | SELECT + UPDATE self_answers, self_submitted_at |

---

## 7. Default Templates (seed data)

**Template 1: Đánh giá hết thử việc**
- 5 tiêu chí điểm (chất lượng, thái độ, teamwork, chủ động, đáng tin cậy)
- 3 câu tự luận NV: thành tựu, khó khăn, mục tiêu
- 3 câu tự luận leader: điểm mạnh, cần cải thiện, khuyến nghị

**Template 2: Review 6 tháng**
- Tương tự + thêm tiêu chí "Hoàn thành mục tiêu kỳ trước"
- Câu hỏi về mục tiêu đã đặt từ kỳ trước

---

## 8. Scope & Out of Scope

**In scope:**
- CRUD templates
- Tạo/quản lý kỳ đánh giá
- Form self-assessment (portal)
- Form leader evaluation (HR app)
- HR decision + mục tiêu
- Notifications

**Out of scope (for now):**
- Export PDF báo cáo đánh giá
- Biểu đồ analytics lịch sử đánh giá
- Peer review (đồng nghiệp đánh giá)
- Tích hợp tự động tăng lương khi action = 'salary_increase'
