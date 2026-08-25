import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

interface PageLoadApi {
  visible: boolean
  percent: number
  begin: () => void
  complete: () => void
  fail: () => void
}

const PageLoadContext = createContext<PageLoadApi | null>(null)

export function PageLoadProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [percent, setPercent] = useState(0)
  const generation = useRef(0)
  const inFlight = useRef(false)
  const trickleTimer = useRef<number | null>(null)
  const hideTimer = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (trickleTimer.current !== null) {
      window.clearInterval(trickleTimer.current)
      trickleTimer.current = null
    }
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const begin = useCallback(() => {
    generation.current += 1
    inFlight.current = true
    clearTimers()
    setVisible(true)
    setPercent(12)
    trickleTimer.current = window.setInterval(() => {
      setPercent((current) => current + (90 - current) * 0.12)
    }, 180)
  }, [clearTimers])

  const complete = useCallback(() => {
    if (!inFlight.current) return
    inFlight.current = false
    const token = generation.current
    if (trickleTimer.current !== null) {
      window.clearInterval(trickleTimer.current)
      trickleTimer.current = null
    }
    setVisible(true)
    setPercent(100)
    hideTimer.current = window.setTimeout(() => {
      if (generation.current !== token) return
      setVisible(false)
      setPercent(0)
    }, 280)
  }, [])

  const fail = useCallback(() => {
    if (!inFlight.current) return
    inFlight.current = false
    const token = generation.current
    clearTimers()
    hideTimer.current = window.setTimeout(() => {
      if (generation.current !== token) return
      setVisible(false)
      setPercent(0)
    }, 0)
  }, [clearTimers])

  const api = useMemo(
    () => ({ visible, percent, begin, complete, fail }),
    [begin, complete, fail, percent, visible],
  )

  return <PageLoadContext.Provider value={api}>{children}</PageLoadContext.Provider>
}

export function usePageLoad(): PageLoadApi {
  const value = useContext(PageLoadContext)
  if (!value) {
    throw new Error('PageLoadProvider 안에서만 사용할 수 있습니다.')
  }
  return value
}
