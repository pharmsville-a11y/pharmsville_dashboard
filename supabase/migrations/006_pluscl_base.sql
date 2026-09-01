-- PlusCL 기초정보(화주·창고·주문사·택배사). 거래처 연락처는 저장하지 않는다.

create table if not exists public.pluscl_base_rows (
  id bigint generated always as identity primary key,
  company_id text not null default 'internal',
  kind text not null,
  code text not null default '',
  name text not null default '',
  extra jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  constraint pluscl_base_kind_check check (
    kind = any (array[
      'seller',
      'warehouse_type',
      'order_company',
      'delivery',
      'deal_company',
      'common_code'
    ])
  ),
  constraint pluscl_base_unique unique (company_id, kind, code)
);

comment on table public.pluscl_base_rows is
  'PlusCL /open/base_data 기초정보.';

create index if not exists pluscl_base_kind_idx
  on public.pluscl_base_rows (company_id, kind);

alter table public.pluscl_base_rows enable row level security;
revoke all on public.pluscl_base_rows from anon, authenticated;
grant select, insert, update, delete on public.pluscl_base_rows to service_role;
