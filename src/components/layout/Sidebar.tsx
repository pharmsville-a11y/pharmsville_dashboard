import { useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  PlugZap,
  Radio,
  Settings2,
  ShoppingBag,
  Sparkles,
  UserCog,
  Wallet,
  Warehouse,
} from 'lucide-react'
import { canAccessPage, isLocalDevOnlyPage, useAuth, visibleNavItems, useDevLabAccess } from '../../auth'
import { PAGE_LABEL, isSettingsPage, pageLabel } from '../../nav/catalog'
import { useNavConfig } from '../../nav/NavConfigProvider'
import type { PageId } from './types'
import { CollectStatusWidget } from './CollectStatus'
import { cx } from '../../lib/cx'
import { formatKstClock, formatKstDate, formatKstWeekday } from '../../lib/kst'
import './Sidebar.css'

const COLLAPSED_KEY = 'channelboard.sidebarCollapsed'
const BANNER_MS = 480

function bannerDurationMs() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : BANNER_MS
  } catch {
    return BANNER_MS
  }
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    // ignore quota / private mode
  }
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return now
}

const NAV = [
  { id: 'dashboard' as const, icon: LayoutDashboard },
  { id: 'channels' as const, icon: Radio },
  { id: 'commerce' as const, icon: ShoppingBag },
  { id: 'stock' as const, icon: Warehouse },
  { id: 'marketing' as const, icon: Megaphone },
  { id: 'settlement' as const, icon: Wallet },
  { id: 'reports' as const, icon: BarChart3 },
  { id: 'tutorial' as const, icon: BookOpen },
]

const LOCAL_DEV_NAV = [
  { id: 'pagetest' as const, icon: FlaskConical },
  { id: 'devlab' as const, icon: Sparkles },
  { id: 'apicheck' as const, icon: PlugZap },
]

const SETTINGS_NAV = [
  { id: 'accounts' as const, icon: UserCog },
  { id: 'menu' as const, icon: Settings2 },
]

export function Sidebar({
  page,
  onNavigate,
}: {
  page: PageId
  onNavigate: (id: PageId) => void
}) {
  const { user, logout } = useAuth()
  const { config } = useNavConfig()
  const { allowed: localDevAllowed } = useDevLabAccess()
  const now = useNow()
  const baseItems = user ? visibleNavItems(user.role, NAV, config) : []
  const items = localDevAllowed ? [...baseItems, ...LOCAL_DEV_NAV] : baseItems
  const isAdmin = user?.role === 'admin'
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [bannerLeaving, setBannerLeaving] = useState(false)
  const [bannerMotion, setBannerMotion] = useState<'none' | 'in' | 'out'>('none')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [menuHeight, setMenuHeight] = useState<number | null>(null)
  const settingsRef = useRef<HTMLDivElement>(null)
  const clockRef = useRef<HTMLTimeElement>(null)
  const leaveTimer = useRef(0)
  const collapsedRef = useRef(collapsed)
  collapsedRef.current = collapsed

  useEffect(() => {
    if (!isAdmin) setSettingsOpen(false)
  }, [isAdmin])

  useEffect(() => {
    if (!settingsOpen) return
    const clock = clockRef.current
    if (clock && !collapsed) setMenuHeight(clock.offsetHeight)
    else setMenuHeight(null)

    function handlePointerDown(event: PointerEvent) {
      if (settingsRef.current?.contains(event.target as Node)) return
      setSettingsOpen(false)
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setSettingsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [collapsed, settingsOpen])

  useEffect(() => {
    return () => window.clearTimeout(leaveTimer.current)
  }, [])

  function toggleCollapsed() {
    const next = !collapsedRef.current
    collapsedRef.current = next
    writeCollapsed(next)
    setCollapsed(next)
    window.clearTimeout(leaveTimer.current)
    if (next) {
      setBannerLeaving(false)
      setBannerMotion('in')
      setSettingsOpen(false)
      return
    }
    setBannerMotion('out')
    setBannerLeaving(true)
    leaveTimer.current = window.setTimeout(() => {
      setBannerLeaving(false)
      setBannerMotion('none')
    }, bannerDurationMs())
  }

  return (
    <aside
      className={cx(
        'sidebar',
        collapsed && 'is-collapsed',
        bannerLeaving && 'is-banner-leaving',
      )}
      data-banner-motion={bannerMotion}
    >
      <div className="sidebar__logo">
        <span className="sidebar__mark">C</span>
        <span className="sidebar__name">채널보드</span>
      </div>
      <button
        type="button"
        className="sidebar__toggle"
        aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        aria-expanded={!collapsed}
        onClick={toggleCollapsed}
      >
        {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
      </button>

      <nav className="sidebar__nav">
        {items.map((item) => {
          const Icon = item.icon
          const label = pageLabel(config, item.id)
          return (
            <button
              key={item.id}
              type="button"
              aria-label={label}
              onClick={() => {
                if (!user) return
                if (isLocalDevOnlyPage(item.id)) {
                  if (!localDevAllowed) return
                  onNavigate(item.id)
                  return
                }
                if (!canAccessPage(user.role, item.id, config)) return
                onNavigate(item.id)
              }}
              className={cx('sidebar__item', item.id === page && 'is-active')}
            >
              <Icon size={18} />
              <span className="sidebar__label">{label}</span>
              <span className="sidebar__tip" aria-hidden>
                {label}
              </span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar__widgets">
        <time
          ref={clockRef}
          className="sidebar__clock"
          dateTime={now.toISOString()}
          aria-label={`${formatKstWeekday(now)} ${formatKstDate(now)} ${formatKstClock(now)}`}
        >
          <span className="sidebar__clock-head">
            <span className="sidebar__clock-icon" aria-hidden>
              <CalendarClock size={16} strokeWidth={2.2} />
            </span>
            <span className="sidebar__clock-weekday">{formatKstWeekday(now)}</span>
            <span className="sidebar__clock-live">
              <span className="sidebar__clock-dot" aria-hidden />
              KST
            </span>
          </span>
          <span className="sidebar__clock-time sidebar__clock-time--full">{formatKstClock(now)}</span>
          <span className="sidebar__clock-time sidebar__clock-time--compact">
            {new Intl.DateTimeFormat('en-GB', {
              timeZone: 'Asia/Seoul',
              hour: '2-digit',
              minute: '2-digit',
              hourCycle: 'h23',
            }).format(now)}
          </span>
          <span className="sidebar__clock-date">{formatKstDate(now)}</span>
        </time>

        <CollectStatusWidget />
      </div>

      <div className="sidebar__footer" ref={settingsRef}>
        {isAdmin ? (
          <div className="sidebar__settings">
            <button
              type="button"
              className={cx(
                'sidebar__footer-btn',
                (settingsOpen || isSettingsPage(page)) && 'is-active',
              )}
              aria-label="설정"
              aria-haspopup="menu"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <Settings2 size={16} />
              <span className="sidebar__label">설정</span>
              <span className="sidebar__tip" aria-hidden>
                설정
              </span>
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="sidebar__footer-btn"
          aria-label="로그아웃"
          onClick={logout}
        >
          <LogOut size={16} />
          <span className="sidebar__label">Logout</span>
          <span className="sidebar__tip" aria-hidden>
            로그아웃
          </span>
        </button>
        {isAdmin && settingsOpen ? (
          <div
            className="sidebar__settings-menu"
            role="menu"
            style={!collapsed && menuHeight ? { height: menuHeight } : undefined}
          >
            {SETTINGS_NAV.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={cx('sidebar__settings-item', item.id === page && 'is-active')}
                  onClick={() => {
                    onNavigate(item.id)
                    setSettingsOpen(false)
                  }}
                >
                  <Icon size={16} />
                  {PAGE_LABEL[item.id]}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </aside>
  )
}
