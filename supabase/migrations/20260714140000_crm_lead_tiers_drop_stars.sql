-- Sếp yêu cầu bỏ ngôi sao + numbering "Tier 1/2/3" — chỉ cần nhãn phân loại đơn giản,
-- không phải thang xếp hạng. Đổi label/icon 3 tier seed, giữ nguyên id (không phá dữ liệu
-- crm_outreach_leads.tier hiện có).
UPDATE public.crm_lead_tiers SET label='Art Director / Outsource Manager', icon='🔹', description='' WHERE id=1;
UPDATE public.crm_lead_tiers SET label='Producer / Lead Artist', icon='🔸', description='' WHERE id=2;
UPDATE public.crm_lead_tiers SET label='CEO / BD Manager', icon='🔺', description='' WHERE id=3;
