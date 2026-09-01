-- PlusCL 물류: 현재고·주문 레포트. 개인정보(이름·전화·주소)는 저장하지 않는다.

create table if not exists public.pluscl_stock_snapshots (
  id bigint generated always as identity primary key,
  company_id text not null default 'internal',
  snapshot_date date not null,
  snapshot_hour smallint not null default 0
    check (snapshot_hour >= 0 and snapshot_hour <= 23),
  warehouse_code text not null default '',
  seller_code text not null default '',
  item_code text not null,
  item_name text not null default '',
  option_name text not null default '',
  category_name1 text not null default '',
  category_name2 text not null default '',
  rack_code text not null default '',
  lot_no text not null default '',
  qty integer not null default 0,
  item_state text not null default '',
  captured_at timestamptz not null default now(),
  constraint pluscl_stock_unique unique (
    company_id,
    snapshot_date,
    snapshot_hour,
    warehouse_code,
    item_code,
    rack_code,
    lot_no
  )
);

comment on table public.pluscl_stock_snapshots is
  'PlusCL /open/stock_qty 현재고. 같은 시·상품·로케이션·로트는 upsert.';

create index if not exists pluscl_stock_date_hour_idx
  on public.pluscl_stock_snapshots (company_id, snapshot_date desc, snapshot_hour desc);

create table if not exists public.pluscl_order_lines (
  id bigint generated always as identity primary key,
  company_id text not null default 'internal',
  report_type text not null,
  ord_inner_seq bigint not null,
  item_seq integer not null default 1,
  ord_date date,
  ord_comp_code text not null default '',
  ord_comp_name text not null default '',
  ord_no1 text not null default '',
  item_code text not null default '',
  item_name text not null default '',
  option_name text not null default '',
  qty integer not null default 0,
  amount numeric not null default 0,
  fare_price numeric not null default 0,
  invoice_no text not null default '',
  event_at timestamptz,
  captured_at timestamptz not null default now(),
  constraint pluscl_order_type_check check (
    report_type = any (array[
      'standby',
      'order',
      'out',
      'cancel',
      'exchange',
      'return_complete',
      'return_able',
      'out_miss',
      'return_miss',
      'return_giveup',
      'noout',
      'outfix_noout'
    ])
  ),
  constraint pluscl_order_unique unique (company_id, report_type, ord_inner_seq, item_seq)
);

comment on table public.pluscl_order_lines is
  'PlusCL /open/order_report 주문 레포트. 수취인·연락처·주소는 저장하지 않는다.';

create index if not exists pluscl_order_date_idx
  on public.pluscl_order_lines (company_id, ord_date desc, report_type);

create table if not exists public.pluscl_flow_daily (
  id bigint generated always as identity primary key,
  company_id text not null default 'internal',
  snapshot_date date not null,
  kind text not null,
  docs integer not null default 0,
  captured_at timestamptz not null default now(),
  constraint pluscl_flow_kind_check check (
    kind = any (array['in_plan', 'out_plan', 'in_doc', 'out_doc'])
  ),
  constraint pluscl_flow_unique unique (company_id, snapshot_date, kind)
);

comment on table public.pluscl_flow_daily is
  'PlusCL 입고/출고 예정서·작성 현황 건수.';

alter table public.pluscl_stock_snapshots enable row level security;
alter table public.pluscl_order_lines enable row level security;
alter table public.pluscl_flow_daily enable row level security;

revoke all on public.pluscl_stock_snapshots from anon, authenticated;
revoke all on public.pluscl_order_lines from anon, authenticated;
revoke all on public.pluscl_flow_daily from anon, authenticated;

grant select, insert, update, delete on public.pluscl_stock_snapshots to service_role;
grant select, insert, update, delete on public.pluscl_order_lines to service_role;
grant select, insert, update, delete on public.pluscl_flow_daily to service_role;
