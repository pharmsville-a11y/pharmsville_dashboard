import type { ChannelSummary, DateRange, SummaryPeriod, TimePoint } from '../adapters/types'
import type { AdPlatform, AdProduct } from '../ads'

export interface AdSpendBreakdown {
  id: string
  platform: AdPlatform
  product: AdProduct
  name: string
  shortName: string
  adSpend: number
  live: boolean
}

export interface DashboardTotals {
  sales: number
  salesChangePct: number
  adSpend?: number
  adBreakdown?: AdSpendBreakdown[]
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
  dataSource?: 'live' | 'mock'
  latestSnapshotDate?: string
  availableHours?: number[]
  highlightTime?: string
}

export interface AdsLookup {
  from: string
  to: string
  hours: number[] | null
}
