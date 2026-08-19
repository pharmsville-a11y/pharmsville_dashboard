import { isChannelAllowed } from '../auth/permissions'
import { presentSnapshot } from '../auth/redact'
import type { AppUser } from '../auth/types'
import { channelAdapters } from '../adapters/registry'
import type { ChannelAdapter, DateRangeKey, SummaryPeriod, TimePoint } from '../adapters/types'
import { hashString, toDateRange } from '../adapters/utils'
import { formatPeriodRange } from '../lib/format'
import type { DashboardSnapshot, PeriodTotals, PeriodTotalsMap } from './types'

export type { DashboardSnapshot, DashboardTotals, PeriodTotals, PeriodTotalsMap } from './types'

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

function buildPeriodTotals(channels: DashboardSnapshot['channels']): PeriodTotalsMap {
  const periods: SummaryPeriod[] = ['daily', 'weekly', 'monthly']

  const entries = periods.map((period) => {
    const { from, to } = periodWindow(period)
    const commerce = channels.filter((channel) => channel.kind === 'commerce')
    const sales = commerce.reduce(
      (sum, channel) => sum + scaleAmount(channel.primaryValue, period, `${channel.id}:sales`),
      0,
    )
    const adSpend = channels.reduce((sum, channel) => {
      const monthly = channel.commerce?.adSpend ?? channel.sns?.adSpend ?? 0
      return sum + scaleAmount(monthly, period, `${channel.id}:ad`)
    }, 0)

    const ranked = commerce
      .map((channel) => ({
        id: channel.id,
        value: scaleAmount(channel.primaryValue, period, `${channel.id}:sales`),
      }))
      .sort((a, b) => b.value - a.value)
    const top = ranked[0]

    const salesChangePct = Number(
      (
        averageChange(commerce) +
        ((hashString(`change:${period}`) % 21) - 10) / 10
      ).toFixed(2),
    )

    const totals: PeriodTotals = {
      period,
      from,
      to,
      dateLabel: formatPeriodRange(from, to, period),
      sales,
      salesChangePct,
      adSpend,
      topChannelId: top?.id ?? channels[0]?.id ?? '',
      topChannelValue: top?.value ?? 0,
    }

    return [period, totals] as const
  })

  return Object.fromEntries(entries) as PeriodTotalsMap
}

async function buildRawSnapshot(
  rangeKey: DateRangeKey,
  adapters: ChannelAdapter[],
): Promise<DashboardSnapshot> {
  const range = toDateRange(rangeKey)
  const channels = await Promise.all(adapters.map((adapter) => adapter.fetchSummary(range)))
  const seriesList = await Promise.all(
    adapters.map(async (adapter) => ({
      id: adapter.id,
      kind: adapter.meta.kind,
      series: await adapter.fetchTimeseries(range),
    })),
  )

  const seriesByChannel: Record<string, TimePoint[]> = {}
  for (const item of seriesList) {
    seriesByChannel[item.id] = item.series
  }

  const commerceSeries = mergeSeries(
    seriesList.filter((item) => item.kind === 'commerce').map((item) => item.series),
  )
  const snsSeries = mergeSeries(
    seriesList.filter((item) => item.kind === 'sns').map((item) => item.series),
  )
  const combinedSeries = mergeSeries(seriesList.map((item) => item.series))

  const sales = channels
    .filter((channel) => channel.kind === 'commerce')
    .reduce((sum, channel) => sum + channel.primaryValue, 0)
  const adSpend = channels.reduce((sum, channel) => {
    return sum + (channel.commerce?.adSpend ?? channel.sns?.adSpend ?? 0)
  }, 0)
  const topChannel = [...channels].sort((a, b) => b.changePct - a.changePct)[0]

  return {
    range,
    channels,
    seriesByChannel,
    combinedSeries,
    commerceSeries,
    snsSeries,
    totals: {
      sales,
      salesChangePct: averageChange(channels.filter((channel) => channel.kind === 'commerce')),
      adSpend,
      topChannelId: topChannel?.id ?? channels[0]?.id ?? '',
    },
    periodTotals: buildPeriodTotals(channels),
  }
}

export async function getDashboardSnapshot(
  rangeKey: DateRangeKey,
  viewer: AppUser,
): Promise<DashboardSnapshot> {
  if (!viewer?.role) {
    throw new Error('인증된 사용자만 대시보드를 조회할 수 있습니다.')
  }

  const adapters = channelAdapters.filter((adapter) => isChannelAllowed(viewer, adapter.id))
  const raw = await buildRawSnapshot(rangeKey, adapters)
  return presentSnapshot(raw, viewer)
}
