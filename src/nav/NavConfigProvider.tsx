import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { defaultNavConfig, type NavConfig } from './catalog'
import { loadNavConfig, saveNavConfig } from './config'

interface NavConfigApi {
  config: NavConfig
  setConfig: (next: NavConfig) => void
  resetConfig: () => void
}

const NavConfigContext = createContext<NavConfigApi | null>(null)

export function NavConfigProvider({ children }: { children: ReactNode }) {
  const [config, setState] = useState<NavConfig>(() =>
    typeof window === 'undefined' ? defaultNavConfig() : loadNavConfig(),
  )

  const setConfig = useCallback((next: NavConfig) => {
    setState(saveNavConfig(next))
  }, [])

  const resetConfig = useCallback(() => {
    setState(saveNavConfig(defaultNavConfig()))
  }, [])

  const value = useMemo(() => ({ config, setConfig, resetConfig }), [config, resetConfig, setConfig])

  return <NavConfigContext.Provider value={value}>{children}</NavConfigContext.Provider>
}

export function useNavConfig(): NavConfigApi {
  const value = useContext(NavConfigContext)
  if (!value) throw new Error('NavConfigProvider 안에서만 사용할 수 있습니다.')
  return value
}
