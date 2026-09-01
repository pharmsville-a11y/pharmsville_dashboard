-- PlusCL 현재고 유통기한. lot_no(제조일/로트) + 유통기간으로 expire_date 를 저장한다.

alter table public.pluscl_stock_snapshots
  add column if not exists manufactured_on date,
  add column if not exists shelf_life integer not null default 0,
  add column if not exists shelf_life_unit text not null default '',
  add column if not exists expire_date date;

create index if not exists pluscl_stock_expire_idx
  on public.pluscl_stock_snapshots (company_id, expire_date);

comment on column public.pluscl_stock_snapshots.manufactured_on is
  'lot_no 에서 읽은 제조일. 유통기간이 없으면 lot_no 를 유통기한으로 본다.';
comment on column public.pluscl_stock_snapshots.expire_date is
  '유통기한. 제조일+유통기간, 또는 lot_no 날짜.';
