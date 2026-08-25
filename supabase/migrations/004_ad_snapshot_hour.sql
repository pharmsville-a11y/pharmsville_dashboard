-- 광고 스냅샷을 KST 시간 단위로 보관한다.
-- 같은 날·플랫폼·상품은 hour 가 다르면 별도 행이다.

alter table public.ad_snapshots
  add column if not exists snapshot_hour smallint not null default 0;

update public.ad_snapshots
set snapshot_hour = (
  extract(hour from timezone('Asia/Seoul', updated_at))
)::int;

alter table public.ad_snapshots
  drop constraint if exists ad_snapshots_unique;

alter table public.ad_snapshots
  drop constraint if exists ad_snapshots_hour_check;

alter table public.ad_snapshots
  add constraint ad_snapshots_unique
  unique (company_id, platform, product, snapshot_date, snapshot_hour, period);

alter table public.ad_snapshots
  add constraint ad_snapshots_hour_check
  check (snapshot_hour >= 0 and snapshot_hour <= 23);

create index if not exists ad_snapshots_company_date_hour_idx
  on public.ad_snapshots (company_id, snapshot_date desc, snapshot_hour desc);

comment on column public.ad_snapshots.snapshot_hour is
  'KST 시(0-23). 오늘 수집은 현재 시, 과거일 마감은 23.';
comment on column public.ad_snapshots.snapshot_date is
  'KST 기준 날짜. 플랫폼·상품·시간당 한 줄.';
