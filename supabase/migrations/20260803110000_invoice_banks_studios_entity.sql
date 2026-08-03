-- Tách sổ cho invoice_banks / invoice_studios: mỗi sổ chỉ thấy profile của mình,
-- và có default riêng (is_default giờ là "default trong phạm vi entity").
alter table public.invoice_banks   add column if not exists entity text not null default 'TD GAMES';
alter table public.invoice_studios add column if not exists entity text not null default 'TD GAMES';

update public.invoice_banks   set entity = 'TD CONSULTING' where account_name ilike '%CONSULTING%';
update public.invoice_studios set entity = 'TD CONSULTING' where name ilike '%CONSULTING%';

-- Sổ TD GAMES: mặc định = Techcombank USD (19040215726021)
update public.invoice_banks set is_default = (account_number = '19040215726021') where entity = 'TD GAMES';
update public.invoice_banks set is_default = (account_number = '19039948424015') where entity = 'TD CONSULTING';
update public.invoice_studios set is_default = true;
