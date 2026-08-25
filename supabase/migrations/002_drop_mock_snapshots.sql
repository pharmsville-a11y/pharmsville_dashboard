-- 목업 행 정리. 네이버 검색광고 extra가 있으면 source를 바로잡고, 나머지 mock은 지웁니다.
-- SQL Editor에서 Run 하세요.

update public.channel_snapshots
set source = 'naver_sa'
where channel_id = 'naver'
  and source = 'mock'
  and extra ? 'naver_sa';

delete from public.channel_snapshots
where source = 'mock';
