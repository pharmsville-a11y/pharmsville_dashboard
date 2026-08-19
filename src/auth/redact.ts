import type { ChannelSummary } from '../adapters/types'
import type { DashboardSnapshot, PeriodTotals, PeriodTotalsMap } from '../services/types'
import { can, isChannelAllowed } from './permissions'
import type { AppUser } from './types'

function omitAdSpend<T extends { adSpend?: number }>(metrics: T): Omit<T, 'adSpend'> {
  const { adSpend: _hidden, ...rest } = metrics
  return rest
}

function redactChannel(channel: ChannelSummary): ChannelSummary {
  return {
    ...channel,
    commerce: channel.commerce ? omitAdSpend(channel.commerce) : undefined,
    sns: channel.sns ? omitAdSpend(channel.sns) : undefined,
  }
}

function redactPeriod(period: PeriodTotals): PeriodTotals {
  const { adSpend: _hidden, ...rest } = period
  return rest
}

function redactPeriodMap(map: PeriodTotalsMap): PeriodTotalsMap {
  return {
    daily: redactPeriod(map.daily),
    weekly: redactPeriod(map.weekly),
    monthly: redactPeriod(map.monthly),
  }
}

export function presentSnapshot(snapshot: DashboardSnapshot, viewer: AppUser): DashboardSnapshot {
  const channels = snapshot.channels
    .filter((channel) => isChannelAllowed(viewer, channel.id))
    .map((channel) => (can(viewer.role, 'metrics.adSpend') ? channel : redactChannel(channel)))

  const allowedIds = new Set(channels.map((channel) => channel.id))
  const seriesByChannel = Object.fromEntries(
    Object.entries(snapshot.seriesByChannel).filter(([id]) => allowedIds.has(id)),
  )

  const totals = can(viewer.role, 'metrics.adSpend')
    ? snapshot.totals
    : (() => {
        const { adSpend: _hidden, ...rest } = snapshot.totals
        return rest
      })()

  const periodTotals = can(viewer.role, 'metrics.adSpend')
    ? snapshot.periodTotals
    : redactPeriodMap(snapshot.periodTotals)

  return {
    ...snapshot,
    channels,
    seriesByChannel,
    totals,
    periodTotals,
  }
}
