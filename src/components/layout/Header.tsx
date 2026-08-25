import { Bell, Search } from 'lucide-react'
import { displayName, ROLE_LABEL, useCurrentUser } from '../../auth'
import type { PageId } from './types'
import './Header.css'

export function Header({ page }: { page?: PageId }) {
  const user = useCurrentUser()
  const subtitle =
    page === 'marketing' ? '광고 SA·DA 성과만 모았습니다' : '오늘 채널 성과를 한눈에 보세요'

  return (
    <header className="header">
      <div className="header__intro">
        <h1>안녕하세요, {displayName(user)}님</h1>
        <p className="header__sub">
          {ROLE_LABEL[user.role]} · {subtitle}
        </p>
      </div>

      <div className="header__actions">
        <label className="header__search">
          <Search className="header__search-icon" />
          <input type="search" placeholder="채널, 상품, 캠페인을 검색하세요" />
        </label>
        <span className="header__role">{ROLE_LABEL[user.role]}</span>
        <button type="button" className="header__bell" aria-label="알림">
          <Bell size={18} />
          <span className="header__dot" />
        </button>
        <div className="header__avatar">
          <span>{user.initials}</span>
        </div>
      </div>
    </header>
  )
}
