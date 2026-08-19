import { useEffect, useMemo, useState } from 'react'
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

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setData(null)

    getDashboardSnapshot(range, user)
      .then((snapshot) => {
        if (cancelled) return
        setData(snapshot)
        setSelectedId((current) =>
          snapshot.channels.some((channel) => channel.id === current)
            ? current
            : (snapshot.totals.topChannelId || snapshot.channels[0]?.id || null),
        )
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
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
    range,
    setRange,
    selectedId: selected?.id ?? null,
    setSelectedId,
    selected,
  }
}
