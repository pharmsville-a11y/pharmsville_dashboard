import type { PageId } from '../components/layout/types'
import type { Role } from '../auth/types'
import { isLocalDevOnlyPage } from '../services/devLabAccess'

export const PAGE_IDS: PageId[] = [
  'dashboard',
  'channels',
  'commerce',
  'stock',
  'marketing',
  'settlement',
  'reports',
  'accounts',
  'menu',
  'tutorial',
  'pagetest',
  'devlab',
  'apicheck',
]

export const PAGE_LABEL: Record<PageId, string> = {
  dashboard: '대시보드',
  channels: '채널 현황',
  commerce: '매출·주문',
  stock: '재고',
  marketing: '마케팅',
  settlement: '정산',
  reports: '리포트',
  accounts: '계정 관리',
  menu: '메뉴 설정',
  tutorial: '튜토리얼',
  pagetest: '페이지 테스트',
  devlab: '개인 실험실',
  apicheck: 'API체크',
}

/** 최고관리자 본인에게는 끌 수 없는 메뉴 */
export const ADMIN_LOCKED_PAGES: ReadonlySet<PageId> = new Set(['dashboard', 'accounts', 'menu'])

/** 사이드바가 아니라 설정에서만 여는 화면 */
export const SETTINGS_PAGE_IDS: PageId[] = ['accounts', 'menu']

export const SETTINGS_PAGE_ID_SET: ReadonlySet<PageId> = new Set(SETTINGS_PAGE_IDS)

export function isSettingsPage(page: PageId): boolean {
  return SETTINGS_PAGE_ID_SET.has(page)
}

export const NAV_LABEL_MAX = 16

export type NavRoleFlags = Record<Role, boolean>

export type NavConfig = {
  order: PageId[]
  roles: Record<PageId, NavRoleFlags>
  labels: Record<PageId, string>
}

export const DEFAULT_NAV_ROLES: Record<PageId, NavRoleFlags> = {
  dashboard: { admin: true, master: true, manager: true },
  channels: { admin: true, master: true, manager: true },
  commerce: { admin: true, master: true, manager: true },
  stock: { admin: true, master: true, manager: true },
  marketing: { admin: true, master: true, manager: false },
  settlement: { admin: true, master: true, manager: false },
  reports: { admin: true, master: true, manager: true },
  accounts: { admin: true, master: false, manager: false },
  menu: { admin: true, master: false, manager: false },
  tutorial: { admin: true, master: true, manager: true },
  pagetest: { admin: false, master: false, manager: false },
  devlab: { admin: false, master: false, manager: false },
  apicheck: { admin: false, master: false, manager: false },
}

export function defaultNavConfig(): NavConfig {
  return {
    order: [...PAGE_IDS.filter((id) => !SETTINGS_PAGE_ID_SET.has(id)), ...SETTINGS_PAGE_IDS],
    roles: structuredClone(DEFAULT_NAV_ROLES),
    labels: { ...PAGE_LABEL },
  }
}

export function pageLabel(config: NavConfig, id: PageId): string {
  const custom = config.labels[id]?.trim()
  return custom || PAGE_LABEL[id]
}

export function sidebarOrder(order: PageId[]): PageId[] {
  return order.filter((id) => !isSettingsPage(id) && !isLocalDevOnlyPage(id))
}

export function withSettingsOrder(order: PageId[]): PageId[] {
  return [...sidebarOrder(order), ...SETTINGS_PAGE_IDS]
}

export function sanitizeNavLabel(value: string, fallback: string): string {
  const next = value.replace(/\s+/g, ' ').trim().slice(0, NAV_LABEL_MAX)
  return next || fallback
}
