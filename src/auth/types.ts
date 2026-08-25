export const ROLES = ['admin', 'master', 'manager'] as const
export type Role = (typeof ROLES)[number]

export type AllowedChannels = 'ALL' | string[]

export type Capability =
  | 'users.manage'
  | 'roles.grant'
  | 'apikeys.manage'
  | 'metrics.sales'
  | 'metrics.orders'
  | 'metrics.trends'
  | 'metrics.adSpend'
  | 'metrics.roi'
  | 'screen.dashboard'
  | 'screen.channels'
  | 'screen.commerce'
  | 'screen.marketing'
  | 'screen.settlement'
  | 'screen.reports'
  | 'screen.tutorial'
  | 'screen.accounts'

export interface AppUser {
  id: string
  loginId: string
  passwordHash: string
  name: string
  nickname?: string
  title: string
  initials: string
  role: Role
  allowedChannels: AllowedChannels
  note?: string
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: '최고관리자',
  master: '총괄 관리자',
  manager: '마케터',
}

export const ROLE_DESCRIPTION: Record<Role, string> = {
  admin: '계정 생성과 권한 부여, 모든 화면·지표',
  master: '모든 채널·매출·광고비·ROI. 계정 생성은 불가',
  manager: '배정 채널의 매출·주문·추이만. 마케팅 메뉴·광고비·ROI 비공개',
}
