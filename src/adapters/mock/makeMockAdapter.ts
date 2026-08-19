import type {
  ChannelAdapter,
  ChannelSummary,
  DateRange,
  TimePoint,
} from '../types'
import { hashString, pointCount, withLatency } from '../utils'
import type { MockChannelSeed } from './seeds'

function seriesFor(seed: MockChannelSeed, range: DateRange): number[] {
  const count = pointCount(range.key)
  const hash = hashString(`${seed.id}:${range.key}`)
  const base = seed.kind === 'commerce' ? (seed.sales ?? 0) : (seed.followers ?? 0)
  const volatility = base * 0.035
  const values: number[] = []
  let current = base * (0.82 + (hash % 17) / 100)

  for (let i = 0; i < count; i += 1) {
    const wave = Math.sin((hash / 1000 + i) * 0.42) * volatility
    const noise = (((hash >> (i % 12)) & 15) - 7) * volatility * 0.08
    current = Math.max(base * 0.55, current + wave * 0.15 + noise)
    values.push(Math.round(current))
  }

  const last = values[values.length - 1] ?? base
  const scale = last === 0 ? 1 : (base * (1 + seed.changePct / 100)) / last
  return values.map((value) => Math.round(value * scale))
}

function timestamps(range: DateRange, count: number): string[] {
  const start = range.from.getTime()
  const end = range.to.getTime()
  const step = count <= 1 ? 0 : (end - start) / (count - 1)
  return Array.from({ length: count }, (_, index) =>
    new Date(start + step * index).toISOString(),
  )
}

function formatTradeDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatTradeTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

export function makeMockAdapter(seed: MockChannelSeed): ChannelAdapter {
  const meta = {
    id: seed.id,
    kind: seed.kind,
    name: seed.name,
    shortName: seed.shortName,
    ticker: seed.ticker,
    letter: seed.letter,
    badge: seed.badge,
    accent: seed.accent,
    sparkColor: seed.sparkColor,
  }

  function buildSeries(range: DateRange): TimePoint[] {
    const values = seriesFor(seed, range)
    const stamps = timestamps(range, values.length)
    return values.map((value, index) => ({
      timestamp: stamps[index] ?? range.to.toISOString(),
      value,
    }))
  }

  return {
    id: seed.id,
    meta,
    async fetchSummary(range) {
      const points = buildSeries(range)
      const values = points.map((point) => point.value)
      const latest = values[values.length - 1] ?? 0
      const prev = values[values.length - 2] ?? latest
      const min = Math.min(...values)
      const max = Math.max(...values)
      const yearLow = Math.round(min * 0.82)
      const yearHigh = Math.round(max * 1.12)
      const isCommerce = seed.kind === 'commerce'

      const summary: ChannelSummary = {
        ...meta,
        primaryValue: latest,
        primaryLabel: isCommerce ? '매출' : '팔로워',
        changePct: seed.changePct,
        sparkline: values.slice(-12),
        dayLow: min,
        dayHigh: max,
        yearLow,
        yearHigh,
        prevClose: prev,
        open: values[0] ?? latest,
        tradeTime: formatTradeTime(range.to),
        tradeDate: formatTradeDate(range.to),
        commerce: isCommerce
          ? {
              sales: latest,
              orders: seed.orders ?? 0,
              conversionRate: seed.conversionRate ?? 0,
              adSpend: seed.adSpend,
            }
          : undefined,
        sns: !isCommerce
          ? {
              followers: latest,
              reach: seed.reach ?? 0,
              engagementRate: seed.engagementRate ?? 0,
              adSpend: seed.adSpend,
            }
          : undefined,
      }

      return withLatency(summary)
    },
    async fetchTimeseries(range) {
      return withLatency(buildSeries(range))
    },
  }
}
