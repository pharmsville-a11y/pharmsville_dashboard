import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createAccountRecord, SEED_ACCOUNTS } from './accounts'
import { can } from './permissions'
import type { AllowedChannels, AppUser, Role } from './types'

const SESSION_KEY = 'channelboard.sessionUserId'
const ACCOUNTS_KEY = 'channelboard.accounts'

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
    const byId = new Map(Array.isArray(stored) ? stored.map((account) => [account.id, account]) : [])
    for (const seed of SEED_ACCOUNTS) {
      if (!byId.has(seed.id)) byId.set(seed.id, seed)
    }
    return [...byId.values()]
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
  login: (userId: string) => boolean
  logout: () => void
  createAccount: (input: { name: string; role: Role; allowedChannels: AllowedChannels }) => AppUser
  grantRole: (userId: string, role: Role) => void
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

  const value = useMemo<AuthState>(
    () => ({
      user,
      accounts,
      login(userId: string) {
        const next = accounts.find((account) => account.id === userId)
        if (!next) return false
        setUser(next)
        writeSessionUserId(next.id)
        return true
      },
      logout() {
        setUser(null)
        writeSessionUserId(null)
      },
      createAccount(input) {
        if (!user || !can(user.role, 'users.manage')) {
          throw new Error('계정 생성 권한이 없습니다.')
        }
        const created = createAccountRecord(input)
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
