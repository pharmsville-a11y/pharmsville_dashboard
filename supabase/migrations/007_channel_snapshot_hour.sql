-- 매출 스냅샷을 KST 시간 단위로 보관한다.
-- 같은 날·채널은 hour 가 다르면 별도 행이다.

alter table public.channel_snapshots
  add column if not exists snapshot_hour smallint not null default 0;

update public.channel_snapshots
set snapshot_hour = (
  extract(hour from timezone('Asia/Seoul', captured_at))
)::int
where snapshot_hour = 0;

alter table public.channel_snapshots
  drop constraint if exists channel_snapshots_unique;

alter table public.channel_snapshots
  drop constraint if exists channel_snapshots_hour_check;

alter table public.channel_snapshots
  add constraint channel_snapshots_unique
  unique (company_id, channel_id, snapshot_date, snapshot_hour, period);

alter table public.channel_snapshots
  add constraint channel_snapshots_hour_check
  check (snapshot_hour >= 0 and snapshot_hour <= 23);

create index if not exists channel_snapshots_company_date_hour_idx
  on public.channel_snapshots (company_id, snapshot_date desc, snapshot_hour desc);

comment on column public.channel_snapshots.snapshot_hour is
  'KST 시(0-23). 오늘 수집은 현재 시, 과거일 마감은 23.';
