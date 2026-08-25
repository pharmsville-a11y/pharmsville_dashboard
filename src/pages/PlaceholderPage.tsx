import { can, useCurrentUser } from '../auth'
import type { PageId } from '../components/layout/types'
import { usePageReady } from '../hooks/usePageReady'
import './PlaceholderPage.css'

export type PlaceholderPageId = Exclude<PageId, 'dashboard' | 'accounts' | 'marketing'>

const COPY: Record<PlaceholderPageId, { title: string; body: string }> = {
  channels: {
    title: '채널 현황',
    body: '채널별 상세 지표와 연결 상태는 다음 단계에서 붙입니다.',
  },
  commerce: {
    title: '매출·주문',
    body: '쇼핑 채널 주문/매출 리포트 자리를 마련해 두었습니다.',
  },
  settlement: {
    title: '정산',
    body: '채널별 정산 내역 API를 나중에 이 페이지에 연결하세요.',
  },
  reports: {
    title: '리포트',
    body: '기간별 다운로드/공유 리포트는 이후 추가합니다.',
  },
  tutorial: {
    title: '튜토리얼',
    body: '새 채널 어댑터를 등록하는 방법은 README를 참고하세요.',
  },
}

export function PlaceholderPage({ page }: { page: PlaceholderPageId }) {
  const user = useCurrentUser()
  const content = COPY[page]
  const hideCost = !can(user.role, 'metrics.adSpend')
  usePageReady(page)

  return (
    <section className="placeholder is-enter">
      <h2>{content.title}</h2>
      <p>{content.body}</p>
      {hideCost ? (
        <p className="placeholder__hint">이 등급에서는 광고비·ROI·원가 지표가 제공되지 않습니다</p>
      ) : (
        <p className="placeholder__hint">준비 중 · 레이아웃만 연결된 화면입니다</p>
      )}
    </section>
  )
}
