import type { PageId } from '../components/layout/types'
import type { Role } from '../auth/types'
import {
  ADMIN_LOCKED_PAGES,
  DEFAULT_NAV_ROLES,
  PAGE_IDS,
  PAGE_LABEL,
  defaultNavConfig,
  sanitizeNavLabel,
  withSettingsOrder,
  type NavConfig,
  type NavRoleFlags,
} from './catalog'

const STORAGE_KEY = 'channelboard.navConfig'

function isPageId(value: unknown): value is PageId {
  return typeof value === 'string' && (PAGE_IDS as string[]).includes(value)
}

function flagsOf(value: unknown, fallback: NavRoleFlags): NavRoleFlags {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    admin: typeof row.admin === 'boolean' ? row.admin : fallback.admin,
    master: typeof row.master === 'boolean' ? row.master : fallback.master,
    manager: typeof row.manager === 'boolean' ? row.manager : fallback.manager,
  }
}

export function mergeNavConfig(raw: unknown): NavConfig {
  const base = defaultNavConfig()
  const parsed = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const incomingOrder = Array.isArray(parsed.order) ? parsed.order.filter(isPageId) : []
  const order = [...incomingOrder, ...PAGE_IDS.filter((id) => !incomingOrder.includes(id))]
  const incomingRoles =
    parsed.roles && typeof parsed.roles === 'object' ? (parsed.roles as Record<string, unknown>) : {}
  const roles = { ...base.roles }
  for (const id of PAGE_IDS) {
    roles[id] = flagsOf(incomingRoles[id], DEFAULT_NAV_ROLES[id])
    if (ADMIN_LOCKED_PAGES.has(id)) roles[id].admin = true
  }
  roles.menu = { admin: true, master: false, manager: false }

  const incomingLabels =
    parsed.labels && typeof parsed.labels === 'object' ? (parsed.labels as Record<string, unknown>) : {}
  const labels = { ...PAGE_LABEL }
  for (const id of PAGE_IDS) {
    const labelRaw = incomingLabels[id]
    if (typeof labelRaw === 'string') labels[id] = sanitizeNavLabel(labelRaw, PAGE_LABEL[id])
  }

  return { order: withSettingsOrder(order), roles, labels }
}

export function loadNavConfig(): NavConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultNavConfig()
    return mergeNavConfig(JSON.parse(raw) as unknown)
  } catch {
    return defaultNavConfig()
  }
}

export function saveNavConfig(config: NavConfig) {
  const next = mergeNavConfig(config)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore quota / private mode
  }
  return next
}

export function isNavLocked(role: Role, page: PageId): boolean {
  if (page === 'menu') return true
  return role === 'admin' && ADMIN_LOCKED_PAGES.has(page)
}
