-- Luu nguyen payload sinh hop dong de mo lai sua duoc.
-- Truoc day handleSave chi luu metadata + notes rut gon => hop dong da luu
-- khong xem lai va khong sua lai duoc.
alter table public.crm_documents
  add column if not exists contract_data jsonb;

comment on column public.crm_documents.contract_data is
  'ClientContractData day du cua hop dong sinh tu CRM generator; null voi tai lieu upload tay.';
