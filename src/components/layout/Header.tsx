import { Bell, Search } from 'lucide-react'
import { ROLE_LABEL, useCurrentUser } from '../../auth'
import './Header.css'

export function Header() {
  const user = useCurrentUser()

  return (
    <header className="header">
      <div className="header__intro">
        <h1>안녕하세요, {user.name}님</h1>
        <p className="header__sub">
          {ROLE_LABEL[user.role]} · 오늘 채널 성과를 한눈에 보세요
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
