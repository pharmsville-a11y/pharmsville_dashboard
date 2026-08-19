import type { AllowedChannels, AppUser, Role } from './types'

export const SEED_ACCOUNTS: AppUser[] = [
  {
    id: 'super-admin',
    name: 'Super Admin',
    title: '최고관리자',
    initials: 'SA',
    role: 'admin',
    allowedChannels: 'ALL',
    note: '계정 생성 및 권한 부여. 모든 데이터가 그대로 보입니다.',
  },
  {
    id: 'general-master',
    name: '총괄 관리자',
    title: '대표·총괄',
    initials: 'MA',
    role: 'master',
    allowedChannels: 'ALL',
    note: '모든 화면과 매출·광고비 지표를 봅니다. 계정 관리는 불가합니다.',
  },
  {
    id: 'marketer',
    name: 'Marketer',
    title: '내부 마케터',
    initials: 'MK',
    role: 'manager',
    allowedChannels: 'ALL',
    note: '원가·광고비·ROI 마스킹 테스트용. 이 값이 보이면 안 됩니다.',
  },
]

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function createAccountRecord(input: {
  name: string
  role: Role
  allowedChannels: AllowedChannels
}): AppUser {
  const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  return {
    id,
    name: input.name.trim(),
    title: input.role === 'admin' ? '최고관리자' : input.role === 'master' ? '대표·총괄' : '내부 마케터',
    initials: initialsFromName(input.name),
    role: input.role,
    allowedChannels: input.allowedChannels,
  }
}
