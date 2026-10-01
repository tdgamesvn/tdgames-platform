-- Lý do bonus nghiệm thu: trước đây chỉ ghi vào notes chung, phiếu/PDF hiện "+ Bonus +20 USD"
-- mà không rõ vì sao (phiếu Trần Lê Hưng T9/2026 — bù thuế TNCN trừ thừa T8). Hiện cạnh dòng bonus.
ALTER TABLE public.wf_settlements ADD COLUMN IF NOT EXISTS bonus_reason text NOT NULL DEFAULT '';
