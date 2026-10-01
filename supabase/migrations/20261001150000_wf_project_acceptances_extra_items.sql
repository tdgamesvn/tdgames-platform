-- Khoản cộng thêm không gắn task trên phiếu nghiệm thu khách (vd. khách bonus cho công ty).
-- Dạng: [{ "label": "Client bonus Sep 2026", "amount": 10000 }]
-- total_amount vẫn = tổng client_price các task (subtotal, recalcAcceptanceTotal ghi đè);
-- net = subtotal − discount + Σ extra_items.amount (tính ở client, acceptanceNetAmount).
-- Discount chỉ áp lên subtotal task; extra_items KHÔNG phân bổ vào doanh thu/KPI từng NV.
alter table public.wf_project_acceptances
  add column if not exists extra_items jsonb not null default '[]'::jsonb;
