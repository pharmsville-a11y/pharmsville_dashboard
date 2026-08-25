import { isChannelAllowed } from '../auth/permissions'
import { presentSnapshot } from '../auth/redact'
import type { AppUser } from '../auth/types'
import { channelAdapters } from '../adapters/registry'
import type { ChannelAdapter, ChannelSummary, DateRangeKey, SummaryPeriod, TimePoint } from '../adapters/types'
import { adsRangeFromLookup, hashString, lookupFromRangeKey } from '../adapters/utils'
import { formatPeriodRange } from '../lib/format'
import { kstIsoAt, kstYmd, parseYmd } from '../lib/kst'
import { buildAdBreakdown, latestAdSnapshotDate, sumAdSpend } from './adSpend'
import { buildLiveSnapshot } from './liveDashboard'
import { fetchAds, fetchAdsOrEmpty, isQueryConfigured } from './querySnapshots'
import type { AdsLookup, DashboardSnapshot, PeriodTotals, PeriodTotalsMap } from './types'

export type { AdsLookup, DashboardSnapshot, DashboardTotals, PeriodTotals, PeriodTotalsMap } from './types'

function mergeSeries(seriesList: TimePoint[][]): TimePoint[] {
  if (seriesList.length === 0) return []
  const first = seriesList[0]
  if (!first) return []

  return first.map((point, index) => ({
    timestamp: point.timestamp,
    value: seriesList.reduce((sum, series) => sum + (series[index]?.value ?? 0), 0),
  }))
}

function averageChange(channels: DashboardSnapshot['channels']): number {
  if (channels.length === 0) return 0
  const total = channels.reduce((sum, channel) => sum + channel.changePct, 0)
  return Number((total / channels.length).toFixed(2))
}

function periodWindow(period: SummaryPeriod): { from: Date; to: Date } {
  const to = new Date()
  const from = new Date(to)

  if (period === 'daily') {
    from.setHours(0, 0, 0, 0)
  } else if (period === 'weekly') {
    const weekday = from.getDay()
    const mondayOffset = weekday === 0 ? 6 : weekday - 1
    from.setDate(from.getDate() - mondayOffset)
    from.setHours(0, 0, 0, 0)
  } else {
    from.setDate(1)
    from.setHours(0, 0, 0, 0)
  }

  return { from, to }
}

function periodFactor(period: SummaryPeriod): number {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  if (period === 'daily') return 1 / daysInMonth
  if (period === 'weekly') return 7 / daysInMonth
  return 1
}

function scaleAmount(base: number, period: SummaryPeriod, salt: string): number {
  const jitter = 0.9 + (hashString(`${salt}:${period}`) % 21) / 100
  return Math.max(0, Math.round(base * periodFactor(period) * jitter))
}

function stripChannelAdSpend(channel: ChannelSummary): ChannelSummary {
  return {
    ...channel,
    commerce: channel.commerce ? { ...channel.commerce, adSpend: undefined } : undefined,
    sns: channel.sns ? { ...channel.sns, adSpend: undefined } : undefined,
  }
}

function buildPeriodTotals(channels: DashboardSnapshot['channels']): PeriodTotalsMap {
  const periods: SummaryPeriod[] = ['daily', 'weekly', 'monthly']

  const entries = periods.map((period) => {
    const { from, to } = periodWindow(period)
    const commerce = channels.filter((channel) => channel.kind === 'commerce')
    const sales = commerce.reduce(
      (sum, channel) => sum + scaleAmount(channel.primaryValue, period, `${channel.id}:sales`),
      0,
    )

    const ranked = commerce
      .map((channel) => ({
        id: channel.id,
        value: scaleAmount(channel.primaryValue, period, `${channel.id}:sales`),
      }))
      .sort((a, b) => b.value - a.value)
    const top = ranked[0]

    const salesChangePct = Number(
      (averageChange(commerce) + ((hashString(`change:${period}`) % 21) - 10) / 10).toFixed(2),
    )

    const totals: PeriodTotals = {
      period,
      from,
      to,
      dateLabel: formatPeriodRange(from, to, period),
      sales,
      salesChangePct,
      adSpend: 0,
      topChannelId: top?.id ?? channels[0]?.id ?? '',
      topChannelValue: top?.value ?? 0,
    }

    return [period, totals] as const
  })

  return Object.fromEntries(entries) as PeriodTotalsMap
}

function applyHoursToSeries(series: TimePoint[], lookup?: AdsLookup): TimePoint[] {
  if (!lookup?.hours?.length || series.length === 0) return series
  const hours = [...lookup.hours].sort((left, right) => left - right)
  const from = lookup.from
  const to = lookup.to
  if (from === to) {
    return hours.map((hour) => {
      const index = Math.round((hour / 23) * (series.length - 1))
      return {
        timestamp: kstIsoAt(from, hour),
        value: series[index]?.value ?? series[series.length - 1]?.value ?? 0,
      }
    })
  }
  const stampHour = hours[hours.length - 1] ?? 12
  return series.map((point) => {
    const day = parseYmd(point.timestamp) ?? kstYmd(new Date(point.timestamp))
    return { ...point, timestamp: kstIsoAt(day, stampHour) }
  })
}

async function buildRawSnapshot(
  rangeKey: DateRangeKey,
  adapters: ChannelAdapter[],
  lookup?: AdsLookup,
): Promise<DashboardSnapshot> {
  const window = lookup ?? lookupFromRangeKey(rangeKey)
  const from = window.from <= window.to ? window.from : window.to
  const to = window.from <= window.to ? window.to : window.from
  const range = adsRangeFromLookup(from, to)
  range.key = rangeKey
  const summaries = await Promise.all(
    adapters.map(async (adapter) => stripChannelAdSpend(await adapter.fetchSummary(range))),
  )
  const seriesList = await Promise.all(
    adapters.map(async (adapter) => ({
      id: adapter.id,
      kind: adapter.meta.kind,
      series: applyHoursToSeries(await adapter.fetchTimeseries(range), { from, to, hours: lookup?.hours ?? null }),
    })),
  )

  const seriesByChannel: Record<string, TimePoint[]> = {}
  for (const item of seriesList) {
    seriesByChannel[item.id] = item.series
  }

  const commerceSeries = mergeSeries(
    seriesList.filter((item) => item.kind === 'commerce').map((item) => item.series),
  )
  const snsSeries = mergeSeries(seriesList.filter((item) => item.kind === 'sns').map((item) => item.series))
  const combinedSeries = mergeSeries(seriesList.map((item) => item.series))

  const sales = summaries
    .filter((channel) => channel.kind === 'commerce')
    .reduce((sum, channel) => sum + channel.primaryValue, 0)
  const topChannel = [...summaries].sort((a, b) => b.changePct - a.changePct)[0]

  return {
    range,
    channels: summaries,
    seriesByChannel,
    combinedSeries,
    commerceSeries,
    snsSeries,
    totals: {
      sales,
      salesChangePct: averageChange(summaries.filter((channel) => channel.kind === 'commerce')),
      adSpend: 0,
      adBreakdown: buildAdBreakdown([]),
      topChannelId: topChannel?.id ?? summaries[0]?.id ?? '',
    },
    periodTotals: buildPeriodTotals(summaries),
    dataSource: 'mock',
    availableHours: Array.from({ length: 24 }, (_, hour) => hour),
    highlightTime:
      lookup?.hours?.length === 1 && from === to ? kstIsoAt(to, lookup.hours[0]!) : undefined,
  }
}

function overlayLiveAdSpend(
  snapshot: DashboardSnapshot,
  rows: Awaited<ReturnType<typeof fetchAdsOrEmpty>>,
): DashboardSnapshot {
  const latest = latestAdSnapshotDate(rows)
  const adSpend = latest ? sumAdSpend(rows, latest, latest) : 0
  const adBreakdown = buildAdBreakdown(rows, latest)

  return {
    ...snapshot,
    totals: {
      ...snapshot.totals,
      adSpend,
      adBreakdown,
    },
    periodTotals: {
      daily: {
        ...snapshot.periodTotals.daily,
        adSpend: sumAdSpend(
          rows,
          kstYmd(snapshot.periodTotals.daily.from),
          kstYmd(snapshot.periodTotals.daily.to),
        ),
      },
      weekly: {
        ...snapshot.periodTotals.weekly,
        adSpend: sumAdSpend(
          rows,
          kstYmd(snapshot.periodTotals.weekly.from),
          kstYmd(snapshot.periodTotals.weekly.to),
        ),
      },
      monthly: {
        ...snapshot.periodTotals.monthly,
        adSpend: sumAdSpend(
          rows,
          kstYmd(snapshot.periodTotals.monthly.from),
          kstYmd(snapshot.periodTotals.monthly.to),
        ),
      },
    },
    latestSnapshotDate: latest ?? snapshot.latestSnapshotDate,
  }
}

export async function getDashboardSnapshot(
  rangeKey: DateRangeKey,
  viewer: AppUser,
  lookup?: AdsLookup,
): Promise<DashboardSnapshot> {
  if (!viewer?.role) {
    throw new Error('인증된 사용자만 대시보드를 조회할 수 있습니다.')
  }

  const adapters = channelAdapters.filter((adapter) => isChannelAllowed(viewer, adapter.id))
  const [raw, rows] = await Promise.all([
    buildRawSnapshot(rangeKey, adapters, lookup),
    fetchAdsOrEmpty(kstYmd(new Date(), -90), kstYmd()),
  ])
  return presentSnapshot(overlayLiveAdSpend(raw, rows), viewer)
}

export async function getAdsDashboardSnapshot(
  rangeKey: DateRangeKey,
  viewer: AppUser,
  lookup?: AdsLookup,
): Promise<DashboardSnapshot> {
  if (!viewer?.role) {
    throw new Error('인증된 사용자만 대시보드를 조회할 수 있습니다.')
  }

  const selectedFrom = lookup?.from ?? lookup?.to ?? kstYmd()
  const selectedTo = lookup?.to ?? kstYmd()
  const start = selectedFrom <= selectedTo ? selectedFrom : selectedTo
  const end = selectedFrom <= selectedTo ? selectedTo : selectedFrom
  const range = adsRangeFromLookup(start, end)
  range.key = rangeKey
  const from = [kstYmd(new Date(), -90), start, kstYmd(range.from)].sort()[0] ?? start
  const rows = isQueryConfigured() ? await fetchAds(from, kstYmd()) : []
  return presentSnapshot(
    buildLiveSnapshot(rows, range, { from: start, to: end, hours: lookup?.hours ?? null }),
    viewer,
  )
}
