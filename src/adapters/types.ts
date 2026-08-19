export type ChannelKind = 'commerce' | 'sns'

export type DateRangeKey = '1D' | '5D' | '1M' | '6M' | '1Y' | 'ALL'

export type SummaryPeriod = 'daily' | 'weekly' | 'monthly'

export interface DateRange {
  key: DateRangeKey
  from: Date
  to: Date
}

export interface TimePoint {
  timestamp: string
  value: number
}

export interface CommerceMetrics {
  sales: number
  orders: number
  conversionRate: number
  adSpend?: number
}

export interface SnsMetrics {
  followers: number
  reach: number
  engagementRate: number
  adSpend?: number
}

export interface ChannelSummary {
  id: string
  kind: ChannelKind
  name: string
  shortName: string
  ticker: string
  letter: string
  badge: string
  accent: string
  sparkColor: string
  primaryValue: number
  primaryLabel: string
  changePct: number
  sparkline: number[]
  commerce?: CommerceMetrics
  sns?: SnsMetrics
  dayLow: number
  dayHigh: number
  yearLow: number
  yearHigh: number
  prevClose: number
  open: number
  tradeTime: string
  tradeDate: string
}

export interface ChannelMeta {
  id: string
  kind: ChannelKind
  name: string
  shortName: string
  ticker: string
  letter: string
  badge: string
  accent: string
  sparkColor: string
}

export interface ChannelAdapter {
  id: string
  meta: ChannelMeta
  fetchSummary(range: DateRange): Promise<ChannelSummary>
  fetchTimeseries(range: DateRange): Promise<TimePoint[]>
}
