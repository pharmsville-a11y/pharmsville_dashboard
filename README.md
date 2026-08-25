# 채널보드

쇼핑 채널과 SNS 채널 성과를 한 화면에서 보는 대시보드입니다.

지금은 **네이버 검색광고(SA)·노출광고(DA)** 를 수집합니다. 판매 채널은 사방넷 연동 예정이고, 쿠팡·구글 광고는 `src/ads/catalog.ts` 에서 켭니다.

Supabase 테이블·수집 Function 안내는 [supabase/README.md](supabase/README.md) 를 보세요.


## 실행

Node.js 18 이상이 필요합니다.

```bash
cd "C:\Users\admin\Desktop\김승도 작업\채널대시보드"
npm install
npm run dev
```

브라우저에서 Vite가 안내하는 주소(보통 `http://localhost:5173`)를 엽니다.

## GitHub Pages (임시 배포)

개인 계정이 아니라 **회사 GitHub 조직**에 올린 뒤 Pages로 엽니다. 수집 시크릿(`COLLECT_SECRET`)은 프론트에 넣지 않습니다. 마케팅 광고비는 빌드 때 조회 URL만 넣고 `query-ads` GET으로 읽습니다. `.env.local`은 커밋하지 마세요.

### 1. 회사 계정으로 로그인

브라우저에서 [https://github.com/logout](https://github.com/logout) 후 **회사/조직 계정**으로 로그인합니다.  
PC의 `git`도 같은 계정이어야 푸시가 됩니다. 개인 계정으로 로그인돼 있으면 조직 레포에 권한이 없습니다.

### 2. 조직에 빈 저장소 만들기

1. 회사 Organization 페이지 → **New repository**
2. 이름 예: `channel-dashboard`
3. Private 권장 (내부 도구). Private Pages는 GitHub Team/Enterprise가 필요합니다. Free 조직이면 일단 Public으로만 Pages가 됩니다.
4. README/gitignore는 추가하지 않습니다. 로컬에 이미 있습니다.

### 3. Pages 소스

저장소 → **Settings → Pages**

- Source: **GitHub Actions**

조직에서 Pages가 꺼져 있으면 Org Owner가 **Settings → Member privileges / Pages** 에서 허용해야 합니다.

### 4. 이 PC에서 원격만 연결

조직명과 저장소 이름을 바꿔 실행합니다. 푸시는 확인 후에 하면 됩니다.

```bash
git remote add origin https://github.com/<ORG>/<REPO>.git
git remote -v
```

`main`에 푸시되면 `.github/workflows/deploy-pages.yml`이 빌드해서  
`https://<ORG>.github.io/<REPO>/` 로 배포합니다.

로컬 `npm run dev`는 예전처럼 `http://localhost:5173` 입니다.


## 폴더 구조

- `src/adapters/types.ts` — 채널 공통 타입
- `src/adapters/registry.ts` — 실제로 쓰는 어댑터 목록
- `src/adapters/mock/` — 가상 데이터 구현
- `src/services/dashboardService.ts` — 여러 채널 결과를 합쳐 카드/차트용 데이터 생성
- `src/hooks/useDashboard.ts` — 기간 필터, 선택 채널, 로딩 상태
- `src/components/` — 사이드바, 헤더, 대시보드 위젯
- `src/pages/` — 대시보드와 사이드바 placeholder 화면
- 각 화면 컴포넌트 옆의 `*.css` — 해당 영역 스타일 (`src/index.css` 는 색/폰트 공통)

## 채널 API를 나중에 붙이는 방법

1. `src/adapters/` 아래에 새 파일을 만들고 `ChannelAdapter`를 구현합니다.

```ts
import type { ChannelAdapter } from './types'

export const makeshopAdapter: ChannelAdapter = {
  id: 'makeshop',
  meta: {
    id: 'makeshop',
    kind: 'commerce',
    name: '메이크샵',
    shortName: 'Makeshop',
    ticker: 'MKS',
    letter: 'M',
    badge: '#1FA971',
    accent: '#D8F3E7',
    sparkColor: '#2F9E6B',
  },
  async fetchSummary(range) {
    // 실제 API 호출 후 ChannelSummary 로 변환
    return summary
  },
  async fetchTimeseries(range) {
    // 실제 API 호출 후 TimePoint[] 로 변환
    return points
  },
}
```

2. `[src/adapters/registry.ts](src/adapters/registry.ts)` 에서 mock 대신 새 어댑터를 넣습니다.

```ts
export const channelAdapters: ChannelAdapter[] = [
  makeshopAdapter,
  naverAdapter,
  // ...
]
```

쇼핑 채널은 `commerce`(매출·주문·전환율), SNS 채널은 `sns`(팔로워·도달·참여율) 필드를 채우면 카드와 스냅샷이 자동으로 맞춰집니다.

가상 채널만 늘리려면 `[src/adapters/mock/seeds.ts](src/adapters/mock/seeds.ts)` 에 항목을 추가하면 됩니다.

UI는 `primaryValue`와 `changePct`만 보고, 채널마다 다른 응답 형식은 어댑터 안에서만 정규화하면 됩니다.
