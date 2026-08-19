# 채널보드

쇼핑 채널(메이크샵, 스마트스토어, 쿠팡, 11번가)과 SNS 채널(인스타그램, 유튜브, 카카오, 블로그)의 성과를 한 화면에서 보는 대시보드입니다.

지금은 **화면 틀 + 가상 데이터**만 연결되어 있습니다. 실제 API는 아래 어댑터만 바꿔 끼우면 됩니다.

## 실행

Node.js 18 이상이 필요합니다.

```bash
cd "C:\Users\admin\Desktop\김승도 작업\채널대시보드"
npm install
npm run dev
```

브라우저에서 Vite가 안내하는 주소(보통 `http://localhost:5173`)를 엽니다.

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
