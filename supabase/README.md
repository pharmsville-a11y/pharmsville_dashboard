# Supabase 연결

지금은 **네이버 광고 SA/DA**, **사방넷 매출·주문(API 3.0)**, **쿠팡 검색광고**, **PlusCL 물류(재고·주문 레포트)** 를 수집합니다. 쿠팡·구글 광고 스위치는 `src/ads/catalog.ts` 에서 켭니다.

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

키가 있는 계정만 실호출합니다. 쿠팡 윙 주문 수집은 collect-daily 가 매시·수동 실행 때 함께 돕니다.

네이버 검색광고(SA) — 채팅에 붙여 넣지 말 것. IP 등록은 보통 필요 없습니다.

- `NAVER_SA_API_KEY` — 검색광고 API 라이선스(Access License)
- `NAVER_SA_SECRET_KEY` — Secret Key
- `NAVER_SA_CUSTOMER_ID` — 광고주 ID (숫자)
- `NAVER_SA_LABEL` — 구분용 이름 (선택)

계정이 두 개면 `NAVER_SA_2_API_KEY` / `SECRET_KEY` / `CUSTOMER_ID` 를 추가로 넣습니다. 광고비는 `naver` 행의 `ad_spend`에 합산됩니다. 스마트스토어 매출·주문 API는 아직 없습니다.

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 는 Function 환경에 보통 이미 들어 있습니다.

## 4. 한 번 실행해서 표에 넣기

```bash
curl -X POST "https://<PROJECT-REF>.supabase.co/functions/v1/collect-daily" ^
  -H "x-collect-secret: <COLLECT_SECRET>"
```

성공하면 Table Editor → `channel_snapshots` 에 해당 날짜 **네이버 1줄**이 생깁니다. `source`는 `naver_sa`, `ad_spend`는 실광고비입니다. 예전 mock 행은 `002_drop_mock_snapshots.sql` 로 지울 수 있습니다.

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

## 5. 매시 정각 KST

Function이 성공한 뒤 `supabase/cron.sql` 을 참고해 Cron을 켭니다. `0 * * * *` 이면 매시 정각에 오늘 광고를 갱신합니다. 오전 8시에는 어제 날짜도 한 번 더 닫습니다.

## 6. 대시보드에서 읽기

수집 Function과 별도로 조회 Function을 배포합니다.

```bash
npx supabase functions deploy query-snapshots --no-verify-jwt
```

로컬 `.env.local`에 조회 주소를 넣습니다. GitHub Pages 빌드는 조회 URL만 넣고, **COLLECT_SECRET은 프론트에 넣지 않습니다.** `query-ads` GET은 대시보드가 광고비를 읽도록 열려 있습니다.

```
VITE_QUERY_URL=https://<PROJECT-REF>.supabase.co/functions/v1/query-ads
```

로컬에서 시크릿을 쓰려면 `VITE_QUERY_SECRET`을 같이 넣으면 됩니다. 넣은 뒤 `npm run dev`를 다시 켜면 마케팅 탭에 네이버 실광고비가 보입니다.

## 7. PlusCL 물류

[Open API 문서](https://outlink.pluscl.com/service/api/index.html) 기준입니다. Base URL은 `https://service.pluscl.com`, 헤더는 `auth_key`, POST JSON 입니다.

인증키는 **Edge Function Secrets**에만 넣습니다. 값을 채팅·GitHub·프론트에 넣지 마세요. **API 키만 받았다면 `PLUSCL_AUTH_KEY`만** 넣으면 됩니다. 창고·화주 코드는 비워 두면 기초정보에서 채웁니다.

```
PLUSCL_AUTH_KEY=
```

업체코드가 따로 있으면 같이 넣습니다.

```
PLUSCL_COMPANY_CODE=
PLUSCL_WAREHOUSE_CODE=
PLUSCL_SELLER_CODE=
PLUSCL_USER_ID=
PLUSCL_COMPANY_ID=
PLUSCL_BASE_URL=https://service.pluscl.com
```

```bash
npx supabase functions deploy collect-pluscl --no-verify-jwt
npx supabase functions deploy query-pluscl --no-verify-jwt
```

매시 광고 수집(`collect-daily`)이 키가 있으면 PlusCL도 같이 돌립니다. 매출·주문 탭은 `query-pluscl` GET을 읽습니다. 수취인·전화·주소는 DB에 저장하지 않습니다.

## 8. 사방넷 매출·주문 (API 3.0)

[개발자센터 소개](https://developer.sabangnet.co.kr/docs/guides/intro) 기준입니다. 프로덕션 호스트는 `https://api.sabangnet.co.kr` 입니다. 샌드박스는 고정 응답이라 실매출 수집에 쓰지 않습니다.

시크릿은 서버 `.env`에만 넣습니다. 채팅·프론트·GitHub에 넣지 마세요. 개발자센터에서 **허용 IP**에 수집 서버 공인 IP를 등록해야 토큰이 발급됩니다.

```
SABANGNET_BASE_URL=https://api.sabangnet.co.kr
SABANGNET_AUTH_MODE=PRODUCTION
SABANGNET_CLIENT_TYPE=SB_APP
SABANGNET_CLIENT_CD=
SABANGNET_SECRET=
SABANGNET_SVC_ACNT_ID=
SABANGNET_SHOP_MAP=
SABANGNET_MALL_MAP=
```

- `SABANGNET_CLIENT_CD` / 시크릿: 앱 또는 솔루션 등록 후 발급
- `SABANGNET_SVC_ACNT_ID`: 사용 고객사 목록의 서비스코드
- `SABANGNET_SHOP_MAP`: 쇼핑몰ID(`shmaId`) 또는 로그인ID → 채널 ID JSON. 쿠팡 1/2 구분할 때 씁니다.
- 주문조회는 `updateOrderStsYn=N` 이라 신규주문을 주문확인으로 바꾸지 않습니다.

`collect-daily`가 매시 광고 수집과 함께 사방넷 매출을 `channel_snapshots`에 넣습니다. 대시보드는 `query-snapshots` GET을 읽습니다.

