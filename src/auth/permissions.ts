import type { PageId } from '../components/layout/types'
import { ADMIN_LOCKED_PAGES, type NavConfig } from '../nav/catalog'
import { loadNavConfig } from '../nav/config'
import type { AppUser, Capability, Role } from './types'

/**
 * 권한은 역할 이름이 아니라 capability 로만 판정한다.
 * `role !== 'manager'` 같은 역방향 체크는 새 등급이 생기면 원가가 새어 나간다.
 * 기본값은 거부. 목록에 있는 것만 허용.
 */
const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  admin: new Set([
    'users.manage',
    'roles.grant',
    'apikeys.manage',
    'metrics.sales',
    'metrics.orders',
    'metrics.trends',
    'metrics.adSpend',
    'metrics.roi',
    'screen.dashboard',
    'screen.channels',
    'screen.commerce',
    'screen.stock',
    'screen.marketing',
    'screen.settlement',
    'screen.reports',
    'screen.tutorial',
    'screen.accounts',
    'screen.menu',
  ]),
  master: new Set([
    'apikeys.manage',
    'metrics.sales',
    'metrics.orders',
    'metrics.trends',
    'metrics.adSpend',
    'metrics.roi',
    'screen.dashboard',
    'screen.channels',
    'screen.commerce',
    'screen.stock',
    'screen.marketing',
    'screen.settlement',
    'screen.reports',
    'screen.tutorial',
  ]),
  manager: new Set([
    'metrics.sales',
    'metrics.orders',
    'metrics.trends',
    'screen.dashboard',
    'screen.channels',
    'screen.commerce',
    'screen.stock',
    'screen.reports',
    'screen.tutorial',
  ]),
}

const SENSITIVE_METRICS = ['metrics.adSpend', 'metrics.roi'] as const

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.has(capability) === true
}

export function canViewSensitiveMetrics(role: Role): boolean {
  return SENSITIVE_METRICS.every((capability) => can(role, capability))
}

export function canAccessPage(role: Role, page: PageId, config: NavConfig = loadNavConfig()): boolean {
  if (page === 'menu') return role === 'admin'
  if (role === 'admin' && ADMIN_LOCKED_PAGES.has(page)) return true
  return config.roles[page]?.[role] === true
}

export function isChannelAllowed(user: AppUser, channelId: string): boolean {
  if (user.allowedChannels === 'ALL') return true
  return user.allowedChannels.includes(channelId)
}

export function visibleNavItems<T extends { id: PageId }>(
  role: Role,
  items: T[],
  config: NavConfig = loadNavConfig(),
): T[] {
  const rank = new Map(config.order.map((id, index) => [id, index]))
  return items
    .filter((item) => canAccessPage(role, item.id, config))
    .sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999))
}
