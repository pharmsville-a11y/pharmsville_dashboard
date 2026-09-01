import type { ChannelSummary, SummaryPeriod, TimePoint } from '../adapters/types'
import type { DashboardTotals, PeriodTotalsMap } from '../services/types'
import { filterChannelsByLane, type ChannelLane } from '../components/dashboard/ChannelCarousel'
import { kstYmd } from './kst'

function rankChannelsForPeriod(
  channels: ChannelSummary[],
  seriesByChannel: Record<string, TimePoint[]>,
  period: SummaryPeriod,
  from: Date,
  to: Date,
) {
  const fromYmd = kstYmd(from)
  const toYmd = kstYmd(to)
  return channels
    .map((channel) => {
      const series = seriesByChannel[channel.id] ?? []
      const value =
        period === 'daily'
          ? channel.primaryValue
          : series
              .filter((point) => {
                const day = point.timestamp.slice(0, 10)
                return day >= fromYmd && day <= toYmd
              })
              .reduce((sum, point) => sum + point.value, 0)
      return { id: channel.id, value }
    })
    .sort((left, right) => right.value - left.value)
}

export function periodTotalsForChannels(
  channels: ChannelSummary[],
  seriesByChannel: Record<string, TimePoint[]>,
  base: PeriodTotalsMap,
): PeriodTotalsMap {
  const periods: SummaryPeriod[] = ['daily', 'weekly', 'monthly']
  const entries = periods.map((period) => {
    const prev = base[period]
    const ranked = rankChannelsForPeriod(channels, seriesByChannel, period, prev.from, prev.to)
    const top = ranked[0]
    const sales = ranked.reduce((sum, item) => sum + item.value, 0)
    return [
      period,
      {
        ...prev,
        sales,
        topChannelId: top?.id ?? prev.topChannelId,
        topChannelValue: top?.value ?? 0,
      },
    ] as const
  })
  return Object.fromEntries(entries) as PeriodTotalsMap
}

export function salesTotalsForChannels(channels: ChannelSummary[], base: DashboardTotals): DashboardTotals {
  const commerce = channels.filter((channel) => channel.kind === 'commerce')
  const sales = commerce.reduce((sum, channel) => sum + channel.primaryValue, 0)
  const top = [...commerce].sort((left, right) => right.primaryValue - left.primaryValue)[0]
  return {
    ...base,
    sales,
    topChannelId: top?.id ?? base.topChannelId,
  }
}

export function applySalesLane(
  channels: ChannelSummary[],
  seriesByChannel: Record<string, TimePoint[]>,
  totals: DashboardTotals,
  periodTotals: PeriodTotalsMap,
  lane: ChannelLane,
) {
  const visible = filterChannelsByLane(channels, lane)
  if (lane === 'all') {
    return {
      channels: visible,
      totals,
      periodTotals,
      weeklyTopId: periodTotals.weekly.topChannelId,
      weeklyTopValue: periodTotals.weekly.topChannelValue,
    }
  }

  const nextPeriodTotals = periodTotalsForChannels(visible, seriesByChannel, periodTotals)
  const nextTotals = salesTotalsForChannels(visible, totals)
  return {
    channels: visible,
    totals: nextTotals,
    periodTotals: nextPeriodTotals,
    weeklyTopId: nextPeriodTotals.weekly.topChannelId,
    weeklyTopValue: nextPeriodTotals.weekly.topChannelValue,
  }
}
