import { useEffect, useMemo, useRef, useState } from 'react'
import type { DateRangeKey } from '../adapters/types'
import { useCurrentUser } from '../auth'
import {
  getDashboardSnapshot,
  type DashboardSnapshot,
} from '../services/dashboardService'

export type LoadStatus = 'loading' | 'ready' | 'error'

export function useDashboard(initialRange: DateRangeKey = '1M') {
  const user = useCurrentUser()
  const [range, setRange] = useState<DateRangeKey>(initialRange)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [data, setData] = useState<DashboardSnapshot | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [refreshing, setRefreshing] = useState(false)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const firstLoad = !hasLoadedRef.current
    if (firstLoad) setStatus('loading')
    else setRefreshing(true)

    getDashboardSnapshot(range, user)
      .then((snapshot) => {
        if (cancelled) return
        hasLoadedRef.current = true
        setData(snapshot)
        setSelectedId((current) =>
          snapshot.channels.some((channel) => channel.id === current)
            ? current
            : (snapshot.totals.topChannelId || snapshot.channels[0]?.id || null),
        )
        setStatus('ready')
        setRefreshing(false)
      })
      .catch(() => {
        if (cancelled) return
        if (firstLoad) setStatus('error')
        setRefreshing(false)
      })

    return () => {
      cancelled = true
    }
  }, [range, user])

  const selected = useMemo(
    () => data?.channels.find((channel) => channel.id === selectedId) ?? data?.channels[0],
    [data, selectedId],
  )

  return {
    data,
    status,
    refreshing,
    range,
    setRange,
    selectedId: selected?.id ?? null,
    setSelectedId,
    selected,
  }
}
