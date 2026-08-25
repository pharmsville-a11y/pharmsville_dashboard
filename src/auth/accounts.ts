import type { AllowedChannels, AppUser, Role } from './types'

export const SEED_ACCOUNTS: AppUser[] = [
  {
    id: 'super-admin',
    loginId: 'admin',
    passwordHash: 'ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270',
    name: 'Super Admin',
    title: '최고관리자',
    initials: 'SA',
    role: 'admin',
    allowedChannels: 'ALL',
    note: '계정 생성 및 권한 부여. 모든 데이터가 그대로 보입니다.',
  },
  {
    id: 'general-master',
    loginId: 'master',
    passwordHash: '9bc7d305917ebe5a079e78c0e05bbe058192d9739678ec875e791fecd10d4642',
    name: '총괄 관리자',
    title: '대표·총괄',
    initials: 'MA',
    role: 'master',
    allowedChannels: 'ALL',
    note: '모든 화면과 매출·광고비 지표를 봅니다. 계정 관리는 불가합니다.',
  },
  {
    id: 'marketer',
    loginId: 'marketer',
    passwordHash: 'fb04d056b820faff5d876dea7b451c9c9422e17580ca1ecff5ee6e35d1dd2e07',
    name: 'Marketer',
    title: '내부 마케터',
    initials: 'MK',
    role: 'manager',
    allowedChannels: 'ALL',
    note: '마케팅 메뉴·광고비·ROI 마스킹 테스트용. 이 값이 보이면 안 됩니다.',
  },
]

const LOGIN_ID_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/

export function normalizeLoginId(value: string): string {
  return value.trim().toLowerCase()
}

export function assertLoginId(value: string): string {
  const loginId = normalizeLoginId(value)
  if (!LOGIN_ID_PATTERN.test(loginId)) {
    throw new Error('계정 ID는 3~32자의 영문, 숫자, .-_ 만 사용할 수 있습니다.')
  }
  return loginId
}

export function assertPassword(value: string): string {
  if (value.length < 6) {
    throw new Error('비밀번호는 6자 이상이어야 합니다.')
  }
  return value
}

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function passwordsMatch(password: string, passwordHash: string): Promise<boolean> {
  const hashed = await hashPassword(password)
  return hashed === passwordHash
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function displayName(user: Pick<AppUser, 'name' | 'nickname'>): string {
  return user.nickname?.trim() || user.name
}

export function createAccountRecord(input: {
  loginId: string
  passwordHash: string
  name: string
  role: Role
  allowedChannels: AllowedChannels
  nickname?: string
  note?: string
}): AppUser {
  const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const name = input.name.trim()
  const nickname = input.nickname?.trim()
  const note = input.note?.trim()
  return {
    id,
    loginId: input.loginId,
    passwordHash: input.passwordHash,
    name,
    nickname: nickname || undefined,
    title: input.role === 'admin' ? '최고관리자' : input.role === 'master' ? '대표·총괄' : '내부 마케터',
    initials: initialsFromName(nickname || name),
    role: input.role,
    allowedChannels: input.allowedChannels,
    note: note || undefined,
  }
}

export function withSeedCredentials(account: AppUser, seed?: AppUser): AppUser {
  return {
    ...account,
    loginId: account.loginId || seed?.loginId || normalizeLoginId(account.id),
    passwordHash: account.passwordHash || seed?.passwordHash || '',
  }
}
