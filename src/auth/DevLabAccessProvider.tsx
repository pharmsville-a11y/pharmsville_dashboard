import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { isLocalDevMenuEnabled } from '../services/devLabAccess'
import { useAuth } from './AuthProvider'

export type DevLabAccessResult = {
  allowed: boolean
  ip?: string
}

type DevLabAccessState = DevLabAccessResult & {
  loaded: boolean
}

const DevLabAccessContext = createContext<DevLabAccessState>({
  loaded: true,
  allowed: false,
})

export function DevLabAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const state = useMemo<DevLabAccessState>(() => {
    const allowed = Boolean(user && isLocalDevMenuEnabled())
    return {
      loaded: true,
      allowed,
      ip: allowed ? 'local' : undefined,
    }
  }, [user?.loginId])

  return <DevLabAccessContext.Provider value={state}>{children}</DevLabAccessContext.Provider>
}

export function useDevLabAccess() {
  return useContext(DevLabAccessContext)
}

export {
  canAccessLocalDevPage,
  isLocalDevMenuEnabled,
  isLocalDevOnlyPage,
} from '../services/devLabAccess'

/** @deprecated canAccessLocalDevPage(page, allowed) 사용 */
export function canAccessDevLab(devLabAllowed: boolean): boolean {
  return isLocalDevMenuEnabled() && devLabAllowed
}
