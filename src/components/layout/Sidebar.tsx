import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Radio,
  ShoppingBag,
  UserCog,
  Wallet,
} from 'lucide-react'
import { canAccessPage, useAuth, visibleNavItems } from '../../auth'
import type { PageId } from './types'
import { cx } from '../../lib/cx'
import './Sidebar.css'

const NAV = [
  { id: 'dashboard' as const, label: '대시보드', icon: LayoutDashboard },
  { id: 'channels' as const, label: '채널 현황', icon: Radio },
  { id: 'commerce' as const, label: '매출·주문', icon: ShoppingBag },
  { id: 'marketing' as const, label: '마케팅', icon: Megaphone },
  { id: 'settlement' as const, label: '정산', icon: Wallet },
  { id: 'reports' as const, label: '리포트', icon: BarChart3 },
  { id: 'accounts' as const, label: '계정 관리', icon: UserCog },
  { id: 'tutorial' as const, label: '튜토리얼', icon: BookOpen },
]

export function Sidebar({
  page,
  onNavigate,
}: {
  page: PageId
  onNavigate: (id: PageId) => void
}) {
  const { user, logout } = useAuth()
  const items = user ? visibleNavItems(user.role, NAV) : []

  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <span className="sidebar__mark">C</span>
        <span className="sidebar__name">채널보드</span>
      </div>

      <nav className="sidebar__nav">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (!user || !canAccessPage(user.role, item.id)) return
                onNavigate(item.id)
              }}
              className={cx('sidebar__item', item.id === page && 'is-active')}
            >
              <Icon size={18} />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="sidebar__thought">
        <p className="sidebar__thought-title">Thought Time</p>
        <p>로그인한 등급에 맞는 지표만 표시됩니다.</p>
      </div>

      <button type="button" className="sidebar__logout" onClick={logout}>
        <LogOut size={16} />
        Logout
      </button>
    </aside>
  )
}
