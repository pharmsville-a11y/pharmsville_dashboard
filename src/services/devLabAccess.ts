import type { PageId } from '../components/layout/types'

/** 로컬 npm run dev 전용 메뉴. 프로덕션 빌드에는 노출되지 않음. */
export const LOCAL_DEV_PAGE_IDS = ['devlab', 'apicheck', 'pagetest'] as const satisfies readonly PageId[]

export type LocalDevPageId = (typeof LOCAL_DEV_PAGE_IDS)[number]

export function isLocalDevOnlyPage(page: PageId): page is LocalDevPageId {
  return (LOCAL_DEV_PAGE_IDS as readonly PageId[]).includes(page)
}

/** @deprecated isLocalDevMenuEnabled 사용 */
export function isDevLabEnabled(): boolean {
  return isLocalDevMenuEnabled()
}

export function isLocalDevMenuEnabled(): boolean {
  return import.meta.env.DEV
}

export function canAccessLocalDevPage(page: PageId, allowed: boolean): boolean {
  return isLocalDevMenuEnabled() && allowed && isLocalDevOnlyPage(page)
}
