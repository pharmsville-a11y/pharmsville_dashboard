import { displayName, ROLE_LABEL, useCurrentUser } from '../../auth'
import type { PageId } from './types'
import './Header.css'

export function Header({ page }: { page?: PageId }) {
  const user = useCurrentUser()
  const subtitle =
    page === 'marketing'
      ? '광고 SA·DA 성과를 보여줍니다'
      : page === 'stock'
        ? 'PlusCL 현재고를 브랜드별로 보여줍니다'
        : page === 'pagetest'
          ? '메뉴 설정 변경 사항을 확인하는 테스트 화면입니다'
          : page === 'devlab'
            ? '로컬 전용 개인 테스트 공간입니다'
            : page === 'apicheck'
              ? '사방넷 API 수집 데이터를 확인합니다'
              : page === 'menu'
          ? '메뉴 이름·순서·노출을 변경할 수 있습니다'
          : page === 'accounts'
            ? '로그인 계정과 권한을 관리합니다'
            : page === 'commerce'
              ? '주문·출고 현황을 봅니다'
              : '오늘 채널 성과를 한눈에 보세요'

  return (
    <header className="header">
      <div className="header__intro">
        <h1>안녕하세요, {displayName(user)}님</h1>
        <p className="header__sub">
          {ROLE_LABEL[user.role]} · {subtitle}
        </p>
      </div>
    </header>
  )
}
