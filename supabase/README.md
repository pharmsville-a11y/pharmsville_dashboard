# Supabase 연결

대시보드 화면은 아직 mock입니다. DB에는 **수집 Function**이 값을 넣고, 나중에 조회 Function이 읽어 화면에 줍니다.

쿠팡 Access Key / Secret 은 프론트가 아니라 **Edge Function Secrets**에만 넣습니다.

## 1. 테이블

이미 SQL Editor에서 `001_channel_snapshots.sql` 을 실행했습니다.

## 2. CLI로 프로젝트 연결

프로젝트 ref는 대시보드 URL의 `.../project/` 다음 값입니다.

```bash
npx supabase login
npx supabase link --project-ref <PROJECT-REF>
npx supabase functions deploy collect-daily --no-verify-jwt
```

## 3. 비밀값

Dashboard → **Edge Functions** → **Secrets** (또는 `npx supabase secrets set`)

필수:

- `COLLECT_SECRET` — 수집을 아무나 못 부르게 하는 임의의 긴 문자열

쿠팡은 계정(서비스)마다 한 세트입니다. 지금은 **두 개**까지 받습니다. 채팅에 붙여 넣지 말 것.

1번 스토어:

- `COUPANG_1_ACCESS_KEY`
- `COUPANG_1_SECRET_KEY`
- `COUPANG_1_VENDOR_ID` — 윙 판매자 ID (`A`로 시작하는 값)
- `COUPANG_1_LABEL` — 화면 이름 (예: `쿠팡 파머스빌`)

2번 스토어:

- `COUPANG_2_ACCESS_KEY`
- `COUPANG_2_SECRET_KEY`
- `COUPANG_2_VENDOR_ID`
- `COUPANG_2_LABEL`

키가 있는 계정만 실호출하고, 없는 쪽은 mock으로 저장됩니다.

네이버 검색광고(SA) — 채팅에 붙여 넣지 말 것. IP 등록은 보통 필요 없습니다.

- `NAVER_SA_API_KEY` — 검색광고 API 라이선스(Access License)
- `NAVER_SA_SECRET_KEY` — Secret Key
- `NAVER_SA_CUSTOMER_ID` — 광고주 ID (숫자)
- `NAVER_SA_LABEL` — 구분용 이름 (선택)

계정이 두 개면 `NAVER_SA_2_API_KEY` / `SECRET_KEY` / `CUSTOMER_ID` 를 추가로 넣습니다. 광고비는 `naver` 행의 `ad_spend`에 합산됩니다. 스마트스토어 매출은 아직 mock입니다.

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 는 Function 환경에 보통 이미 들어 있습니다.

## 4. 한 번 실행해서 표에 넣기

```bash
curl -X POST "https://<PROJECT-REF>.supabase.co/functions/v1/collect-daily" ^
  -H "x-collect-secret: <COLLECT_SECRET>"
```

성공하면 Table Editor → `channel_snapshots` 에 해당 날짜 **9줄**이 생깁니다. 네이버 SA가 성공하면 `naver` 행의 `source`가 `naver_sa`이고 `ad_spend`가 실광고비입니다.

로컬에서 오늘·최근 며칠을 한 번에 넣으려면 `.env.example`을 `.env.local`로 복사한 뒤:

```bash
npm run collect
npm run collect -- --date=2026-08-19
npm run collect -- --days=7
```

날짜를 지정하려면:

```bash
curl -X POST "https://<PROJECT-REF>.supabase.co/functions/v1/collect-daily?date=2026-08-18" ^
  -H "x-collect-secret: <COLLECT_SECRET>"
```

## 5. 매일 08:00 KST

Function이 성공한 뒤 `supabase/cron.sql` 을 참고해 Cron을 켭니다. `0 23 * * *` UTC = 한국 오전 8시입니다.
