import type { ChannelSummary, DateRange, SummaryPeriod, TimePoint } from '../adapters/types'

export interface DashboardTotals {
  sales: number
  salesChangePct: number
  adSpend?: number
  topChannelId: string
}

export interface PeriodTotals {
  period: SummaryPeriod
  from: Date
  to: Date
  dateLabel: string
  sales: number
  salesChangePct: number
  adSpend?: number
  topChannelId: string
  topChannelValue: number
}

export type PeriodTotalsMap = Record<SummaryPeriod, PeriodTotals>

export interface DashboardSnapshot {
  range: DateRange
  channels: ChannelSummary[]
  seriesByChannel: Record<string, TimePoint[]>
  combinedSeries: TimePoint[]
  commerceSeries: TimePoint[]
  snsSeries: TimePoint[]
  totals: DashboardTotals
  periodTotals: PeriodTotalsMap
}
