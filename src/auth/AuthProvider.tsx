import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  assertLoginId,
  assertPassword,
  createAccountRecord,
  hashPassword,
  initialsFromName,
  passwordsMatch,
  SEED_ACCOUNTS,
  withSeedCredentials,
} from './accounts'
import { can } from './permissions'
import type { AllowedChannels, AppUser, Role } from './types'

const SESSION_KEY = 'channelboard.sessionUserId'
const ACCOUNTS_KEY = 'channelboard.accounts'
const LOGIN_FAILED = '계정 ID 또는 비밀번호가 올바르지 않습니다.'

function readSessionUserId(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function writeSessionUserId(userId: string | null) {
  try {
    if (userId) window.localStorage.setItem(SESSION_KEY, userId)
    else window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore quota / private mode
  }
}

function loadAccounts(): AppUser[] {
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY)
    const stored = raw ? (JSON.parse(raw) as AppUser[]) : []
    const byId = new Map(
      (Array.isArray(stored) ? stored : []).map((account) => [account.id, account] as const),
    )
    for (const seed of SEED_ACCOUNTS) {
      const existing = byId.get(seed.id)
      byId.set(seed.id, withSeedCredentials(existing ?? seed, seed))
    }
    return [...byId.values()].map((account) => {
      const seed = SEED_ACCOUNTS.find((item) => item.id === account.id)
      return withSeedCredentials(account, seed)
    })
  } catch {
    return [...SEED_ACCOUNTS]
  }
}

function saveAccounts(accounts: AppUser[]) {
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  } catch {
    // ignore quota / private mode
  }
}

interface AuthState {
  user: AppUser | null
  accounts: AppUser[]
  login: (loginId: string, password: string) => Promise<void>
  logout: () => void
  createAccount: (input: {
    loginId: string
    password: string
    name: string
    role: Role
    allowedChannels: AllowedChannels
    note?: string
  }) => Promise<AppUser>
  grantRole: (userId: string, role: Role) => void
  updateAccount: (
    userId: string,
    patch: { name?: string; note?: string; password?: string },
  ) => Promise<void>
  deleteAccount: (userId: string) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<AppUser[]>(loadAccounts)
  const [user, setUser] = useState<AppUser | null>(() => {
    const savedId = readSessionUserId()
    return loadAccounts().find((account) => account.id === savedId) ?? null
  })

  useEffect(() => {
    saveAccounts(accounts)
  }, [accounts])

  useEffect(() => {
    setAccounts((current) => {
      let changed = false
      const next = current.map((account) => {
        const seed = SEED_ACCOUNTS.find((item) => item.id === account.id)
        const migrated = withSeedCredentials(account, seed)
        if (migrated.loginId !== account.loginId || migrated.passwordHash !== account.passwordHash) {
          changed = true
          return migrated
        }
        return account
      })
      return changed ? next : current
    })
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      accounts,
      async login(loginId: string, password: string) {
        const normalized = loginId.trim().toLowerCase()
        const next = accounts.find((account) => account.loginId === normalized)
        if (!next?.passwordHash || !(await passwordsMatch(password, next.passwordHash))) {
          throw new Error(LOGIN_FAILED)
        }
        setUser(next)
        writeSessionUserId(next.id)
      },
      logout() {
        setUser(null)
        writeSessionUserId(null)
      },
      async createAccount(input) {
        if (!user || !can(user.role, 'users.manage')) {
          throw new Error('계정 생성 권한이 없습니다.')
        }
        const loginId = assertLoginId(input.loginId)
        if (accounts.some((account) => account.loginId === loginId)) {
          throw new Error('이미 사용 중인 계정 ID입니다.')
        }
        assertPassword(input.password)
        const created = createAccountRecord({
          ...input,
          loginId,
          passwordHash: await hashPassword(input.password),
        })
        setAccounts((current) => [...current, created])
        return created
      },
      grantRole(userId: string, role: Role) {
        if (!user || !can(user.role, 'roles.grant')) {
          throw new Error('권한 부여 권한이 없습니다.')
        }
        if (userId === user.id && role !== 'admin') {
          const otherAdmins = accounts.filter((account) => account.id !== userId && account.role === 'admin')
          if (otherAdmins.length === 0) {
            throw new Error('마지막 최고관리자의 권한은 내릴 수 없습니다.')
          }
        }
        setAccounts((current) =>
          current.map((account) => (account.id === userId ? { ...account, role } : account)),
        )
        setUser((current) => (current?.id === userId ? { ...current, role } : current))
      },
      async updateAccount(userId, patch) {
        if (!user || !can(user.role, 'users.manage')) {
          throw new Error('계정 수정 권한이 없습니다.')
        }
        const passwordHash = patch.password ? await hashPassword(assertPassword(patch.password)) : undefined
        function nextAccount(account: AppUser): AppUser {
          const nextName = patch.name === undefined ? account.name : patch.name.trim()
          const nextNote = patch.note === undefined ? account.note : patch.note.length ? patch.note : undefined
          return {
            ...account,
            name: nextName || account.name,
            note: nextNote,
            passwordHash: passwordHash ?? account.passwordHash,
            initials: initialsFromName(nextName || account.name),
          }
        }
        setAccounts((current) =>
          current.map((account) => (account.id === userId ? nextAccount(account) : account)),
        )
        setUser((current) => (current?.id === userId ? nextAccount(current) : current))
      },
      deleteAccount(userId) {
        if (!user || !can(user.role, 'users.manage')) {
          throw new Error('계정 삭제 권한이 없습니다.')
        }
        if (userId === user.id) {
          throw new Error('로그인한 계정은 삭제할 수 없습니다.')
        }
        const target = accounts.find((account) => account.id === userId)
        if (!target) throw new Error('계정을 찾을 수 없습니다.')
        if (target.role === 'admin') {
          const otherAdmins = accounts.filter((account) => account.id !== userId && account.role === 'admin')
          if (otherAdmins.length === 0) {
            throw new Error('마지막 최고관리자는 삭제할 수 없습니다.')
          }
        }
        setAccounts((current) => current.filter((account) => account.id !== userId))
      },
    }),
    [accounts, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider 안에서만 사용할 수 있습니다.')
  return context
}

export function useCurrentUser(): AppUser {
  const { user } = useAuth()
  if (!user) throw new Error('로그인이 필요합니다.')
  return user
}
