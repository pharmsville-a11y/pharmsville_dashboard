-- 채널보드: 일자별 채널 스냅샷
-- Supabase SQL Editor에 붙여 넣고 Run 하세요.
-- 같은 SQL을 두 번 실행해도 되도록 IF NOT EXISTS 를 썼습니다.

create table if not exists public.channel_snapshots (
  id bigint generated always as identity primary key,
  company_id text not null default 'internal',
  snapshot_date date not null,
  period text not null default 'daily',
  channel_id text not null,
  kind text not null,
  source text not null default 'mock',
  sales numeric,
  orders integer,
  conversion_rate numeric,
  ad_spend numeric,
  roi numeric,
  followers integer,
  reach integer,
  engagement_rate numeric,
  extra jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint channel_snapshots_period_check
    check (period in ('daily', 'weekly', 'monthly')),
  constraint channel_snapshots_kind_check
    check (kind in ('commerce', 'sns')),
  constraint channel_snapshots_unique
    unique (company_id, channel_id, snapshot_date, period)
);

comment on table public.channel_snapshots is
  '회사별 채널 일일 스냅샷. 같은 날·채널은 upsert 로 덮어쓴다.';
comment on column public.channel_snapshots.company_id is
  '지금은 internal 하나. 나중에 고객사 코드.';
comment on column public.channel_snapshots.snapshot_date is
  'KST 기준 영업일 (YYYY-MM-DD).';
comment on column public.channel_snapshots.source is
  '데이터 출처: mock, coupang, naver, makeshop 등.';
comment on column public.channel_snapshots.ad_spend is
  '광고비. Manager 조회 API에서는 이 컬럼을 내려주면 안 된다.';

create index if not exists channel_snapshots_company_date_idx
  on public.channel_snapshots (company_id, snapshot_date desc);

create index if not exists channel_snapshots_channel_date_idx
  on public.channel_snapshots (company_id, channel_id, snapshot_date desc);

create or replace function public.set_channel_snapshots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists channel_snapshots_set_updated_at on public.channel_snapshots;
create trigger channel_snapshots_set_updated_at
before update on public.channel_snapshots
for each row
execute function public.set_channel_snapshots_updated_at();

-- 광고비·ROI 없는 읽기용 뷰 (Manager 조회에 사용)
create or replace view public.channel_snapshots_safe
with (security_invoker = true)
as
select
  id,
  company_id,
  snapshot_date,
  period,
  channel_id,
  kind,
  source,
  sales,
  orders,
  conversion_rate,
  followers,
  reach,
  engagement_rate,
  extra,
  captured_at,
  updated_at
from public.channel_snapshots;

-- 브라우저 anon 키로는 직접 읽기/쓰기 불가.
-- 수집·조회는 Edge Function이 service_role(secret) 로 한다.
alter table public.channel_snapshots enable row level security;

drop policy if exists channel_snapshots_no_direct_anon on public.channel_snapshots;

revoke all on public.channel_snapshots from anon, authenticated;
revoke all on public.channel_snapshots_safe from anon, authenticated;
grant select, insert, update, delete on public.channel_snapshots to service_role;
grant select on public.channel_snapshots_safe to service_role;
