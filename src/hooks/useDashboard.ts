import { useEffect, useMemo, useRef, useState } from 'react'
import type { DateRangeKey } from '../adapters/types'
import { lookupFromRangeKey, rangeKeyForSpan } from '../adapters/utils'
import { useCurrentUser } from '../auth'
import { usePageLoad } from '../components/layout/PageLoadContext'
import { HOURLY_REFRESH_EVENT } from '../lib/hourlyRefresh'
import { kstYmd } from '../lib/kst'
import {
  getAdsDashboardSnapshot,
  getDashboardSnapshot,
  type DashboardSnapshot,
} from '../services/dashboardService'

export type LoadStatus = 'loading' | 'ready' | 'error'
export type DashboardMode = 'sales' | 'ads'

export function useDashboard(initialRange: DateRangeKey = '1M', mode: DashboardMode = 'sales') {
  const user = useCurrentUser()
  const { begin, complete, fail } = usePageLoad()
  const [range, setRange] = useState<DateRangeKey>(initialRange)
  const initialWindow = lookupFromRangeKey(initialRange)
  const [selectedFrom, setSelectedFrom] = useState(initialWindow.from)
  const [selectedTo, setSelectedTo] = useState(initialWindow.to)
  const [selectedHours, setSelectedHours] = useState<number[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [data, setData] = useState<DashboardSnapshot | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    hasLoadedRef.current = false
    setData(null)
    setSelectedId(null)
    setStatus('loading')
    const window = lookupFromRangeKey(initialRange, kstYmd())
    setSelectedFrom(window.from)
    setSelectedTo(window.to)
    setSelectedHours(null)
    setRange(initialRange)
  }, [initialRange, mode])

  useEffect(() => {
    function onHourlyRefresh() {
      const today = kstYmd()
      setSelectedFrom(today)
      setSelectedTo(today)
      setSelectedHours(null)
      setRange('1D')
      setReloadTick((current) => current + 1)
    }

    window.addEventListener(HOURLY_REFRESH_EVENT, onHourlyRefresh)
    return () => window.removeEventListener(HOURLY_REFRESH_EVENT, onHourlyRefresh)
  }, [])

  useEffect(() => {
    let cancelled = false
    const firstLoad = !hasLoadedRef.current
    if (firstLoad) setStatus('loading')
    else {
      setRefreshing(true)
      begin()
    }
    setErrorMessage(null)

    const loader =
      mode === 'ads'
        ? getAdsDashboardSnapshot(range, user, { from: selectedFrom, to: selectedTo, hours: selectedHours })
        : getDashboardSnapshot(range, user, { from: selectedFrom, to: selectedTo, hours: selectedHours })

    loader
      .then((snapshot) => {
        if (cancelled) return
        hasLoadedRef.current = true
        setData(snapshot)
        setSelectedId((current) =>
          snapshot.channels.some((channel) => channel.id === current)
            ? current
            : snapshot.totals.topChannelId || snapshot.channels[0]?.id || null,
        )
        setStatus('ready')
        setRefreshing(false)
        complete()
      })
      .catch((error) => {
        if (cancelled) return
        setErrorMessage(error instanceof Error ? error.message : '조회에 실패했습니다.')
        if (firstLoad) setStatus('error')
        setRefreshing(false)
        fail()
      })

    return () => {
      cancelled = true
    }
  }, [begin, complete, fail, mode, range, reloadTick, selectedFrom, selectedHours, selectedTo, user])

  const selected = useMemo(
    () => data?.channels.find((channel) => channel.id === selectedId) ?? data?.channels[0],
    [data, selectedId],
  )

  function handleRangeChange(key: DateRangeKey) {
    const window = lookupFromRangeKey(key, kstYmd())
    setRange(key)
    setSelectedFrom(window.from)
    setSelectedTo(window.to)
    setSelectedHours(null)
  }

  function applyLookup(next: { from: string; to: string; hours: number[] | null }) {
    const from = next.from <= next.to ? next.from : next.to
    const to = next.from <= next.to ? next.to : next.from
    setSelectedFrom(from)
    setSelectedTo(to)
    setSelectedHours(next.hours?.length ? next.hours : null)
    setRange(rangeKeyForSpan(from, to))
  }

  return {
    data,
    status,
    errorMessage,
    refreshing,
    range,
    setRange: handleRangeChange,
    selectedFrom,
    selectedTo,
    selectedHours,
    applyLookup,
    selectedId: selected?.id ?? null,
    setSelectedId,
    selected,
  }
}
