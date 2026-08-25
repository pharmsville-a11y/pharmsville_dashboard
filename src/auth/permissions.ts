import type { PageId } from '../components/layout/types'
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
    'screen.marketing',
    'screen.settlement',
    'screen.reports',
    'screen.tutorial',
    'screen.accounts',
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
    'screen.reports',
    'screen.tutorial',
  ]),
}

const PAGE_CAPABILITY: Record<PageId, Capability> = {
  dashboard: 'screen.dashboard',
  channels: 'screen.channels',
  commerce: 'screen.commerce',
  marketing: 'screen.marketing',
  settlement: 'screen.settlement',
  reports: 'screen.reports',
  tutorial: 'screen.tutorial',
  accounts: 'screen.accounts',
}

const SENSITIVE_METRICS = ['metrics.adSpend', 'metrics.roi'] as const

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.has(capability) === true
}

export function canViewSensitiveMetrics(role: Role): boolean {
  return SENSITIVE_METRICS.every((capability) => can(role, capability))
}

export function canAccessPage(role: Role, page: PageId): boolean {
  const capability = PAGE_CAPABILITY[page]
  if (!capability) return false
  return can(role, capability)
}

export function isChannelAllowed(user: AppUser, channelId: string): boolean {
  if (user.allowedChannels === 'ALL') return true
  return user.allowedChannels.includes(channelId)
}

export function visibleNavItems<T extends { id: PageId }>(role: Role, items: T[]): T[] {
  return items.filter((item) => canAccessPage(role, item.id))
}
