-- 광고 일별 스냅샷. 판매 채널(사방넷)과 분리한다.
-- 플랫폼: naver | coupang | google
-- 상품: sa(검색광고) | da(노출광고)
-- SQL Editor에 붙여 넣고 Run 하세요.

create table if not exists public.ad_snapshots (
  id bigint generated always as identity primary key,
  company_id text not null default 'internal',
  snapshot_date date not null,
  period text not null default 'daily',
  platform text not null,
  product text not null,
  source text not null,
  ad_spend numeric,
  impressions bigint,
  clicks bigint,
  conversions numeric,
  conv_amt numeric,
  extra jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_snapshots_period_check
    check (period in ('daily', 'weekly', 'monthly')),
  constraint ad_snapshots_platform_check
    check (platform in ('naver', 'coupang', 'google')),
  constraint ad_snapshots_product_check
    check (product in ('sa', 'da')),
  constraint ad_snapshots_unique
    unique (company_id, platform, product, snapshot_date, period)
);

comment on table public.ad_snapshots is
  '광고 플랫폼별 일 스냅샷. 판매 채널(channel_snapshots, 사방넷)과 분리.';
comment on column public.ad_snapshots.platform is
  'naver | coupang | google';
comment on column public.ad_snapshots.product is
  'sa=검색광고, da=노출광고';
comment on column public.ad_snapshots.source is
  'naver_searchad, naver_gfa, coupang_ads, google_ads 등.';

create index if not exists ad_snapshots_company_date_idx
  on public.ad_snapshots (company_id, snapshot_date desc);

drop trigger if exists ad_snapshots_set_updated_at on public.ad_snapshots;
create trigger ad_snapshots_set_updated_at
before update on public.ad_snapshots
for each row
execute function public.set_channel_snapshots_updated_at();

alter table public.ad_snapshots enable row level security;

revoke all on public.ad_snapshots from anon, authenticated;
grant select, insert, update, delete on public.ad_snapshots to service_role;
