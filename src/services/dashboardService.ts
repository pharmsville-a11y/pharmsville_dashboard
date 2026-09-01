import { isChannelAllowed } from '../auth/permissions'
import { presentSnapshot } from '../auth/redact'
import type { AppUser } from '../auth/types'
import type { ChannelSummary, DateRangeKey, SummaryPeriod, TimePoint } from '../adapters/types'
import { adsRangeFromLookup, lookupFromRangeKey } from '../adapters/utils'
import { canonicalChannelId, definitionForChannel, type ChannelDefinition } from '../channels/catalog'
import { formatPeriodRange } from '../lib/format'
import { kstHour, kstIsoAt, kstYmd } from '../lib/kst'
import { buildAdBreakdown, latestAdSnapshotDate, sumAdSpend } from './adSpend'
import {
  channelSnapshotHourOf,
  commerceHoursInRange,
  commerceSeriesFromRows,
  pickCommerceAsOf,
  sortChannelRows,
} from './commerceSnapshots'
import { buildLiveSnapshot } from './liveDashboard'
import { fetchAdsOrEmpty, fetchChannelSnapshotsOrEmpty, type ChannelSnapshotRow } from './querySnapshots'
import { fetchPlusclOrEmpty, type PlusclOrderLine, type PlusclSnapshot } from './queryPluscl'
import { isExcludedPlusclCompany, plusclChannelId, plusclSalesOrders, plusclTicker } from './plusclOffline'
import type { AdsLookup, DashboardSnapshot, PeriodTotals, PeriodTotalsMap } from './types'

export type { AdsLookup, DashboardSnapshot, DashboardTotals, PeriodTotals, PeriodTotalsMap } from './types'

function mergeSeriesByTime(seriesList: TimePoint[][]): TimePoint[] {
  const byTime = new Map<string, number>()
  for (const series of seriesList) {
    for (const point of series) {
      byTime.set(point.timestamp, (byTime.get(point.timestamp) ?? 0) + point.value)
    }
  }
  return [...byTime.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([timestamp, value]) => ({ timestamp, value }))
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

function emptyChannel(def: ChannelDefinition, asOf: Date): ChannelSummary {
  return {
    id: def.id,
    kind: def.kind,
    name: def.name,
    shortName: def.shortName,
    ticker: def.ticker,
    letter: def.letter,
    badge: def.badge,
    accent: def.accent,
    sparkColor: def.sparkColor,
    primaryValue: 0,
    primaryLabel: def.kind === 'commerce' ? '매출' : '팔로워',
    changePct: 0,
    sparkline: [],
    commerce: def.kind === 'commerce' ? { sales: 0, orders: 0 } : undefined,
    sns: def.kind === 'sns' ? { followers: 0, reach: 0, engagementRate: 0 } : undefined,
    dayLow: 0,
    dayHigh: 0,
    yearLow: 0,
    yearHigh: 0,
    prevClose: 0,
    open: 0,
    tradeTime: formatTradeTime(asOf),
    tradeDate: formatTradeDate(asOf),
    source: def.id.startsWith('pluscl_') ? 'pluscl' : def.collector === 'sabangnet' ? 'sabangnet' : undefined,
    sourceLive: false,
  }
}

function rebuildPeriodTotals(
  channels: DashboardSnapshot['channels'],
  seriesByChannel: Record<string, TimePoint[]>,
  previous: PeriodTotalsMap,
): PeriodTotalsMap {
  const commerce = channels.filter((channel) => channel.kind === 'commerce')
  const periods: SummaryPeriod[] = ['daily', 'weekly', 'monthly']
  const entries = periods.map((period) => {
    const { from, to } = periodWindow(period)
    const fromYmd = kstYmd(from)
    const toYmd = kstYmd(to)
    const ranked = commerce.map((channel) => {
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
    ranked.sort((left, right) => right.value - left.value)
    const top = ranked[0]
    const sales = ranked.reduce((sum, item) => sum + item.value, 0)
    const prev = previous[period]
    return [
      period,
      {
        ...prev,
        sales,
        salesChangePct: averageChange(commerce),
        topChannelId: top?.id ?? prev.topChannelId,
        topChannelValue: top?.value ?? 0,
      },
    ] as const
  })
  return Object.fromEntries(entries) as PeriodTotalsMap
}

function buildPeriodTotals(channels: DashboardSnapshot['channels']): PeriodTotalsMap {
  const periods: SummaryPeriod[] = ['daily', 'weekly', 'monthly']

  const entries = periods.map((period) => {
    const { from, to } = periodWindow(period)
    const commerce = channels.filter((channel) => channel.kind === 'commerce')
    const sales = commerce.reduce((sum, channel) => sum + channel.primaryValue, 0)

    const ranked = commerce
      .map((channel) => ({
        id: channel.id,
        value: channel.primaryValue,
      }))
      .sort((a, b) => b.value - a.value)
    const top = ranked[0]

    const salesChangePct = averageChange(commerce)

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

function buildCommerceSnapshot(
  rangeKey: DateRangeKey,
  defs: ChannelDefinition[],
  lookup?: AdsLookup,
): DashboardSnapshot {
  const window = lookup ?? lookupFromRangeKey(rangeKey)
  const from = window.from <= window.to ? window.from : window.to
  const to = window.from <= window.to ? window.to : window.from
  const range = adsRangeFromLookup(from, to)
  range.key = rangeKey
  const asOf = new Date()
  const summaries = defs.map((def) => emptyChannel(def, asOf))
  const seriesByChannel: Record<string, TimePoint[]> = {}
  for (const def of defs) seriesByChannel[def.id] = []

  return {
    range,
    channels: summaries,
    seriesByChannel,
    combinedSeries: [],
    commerceSeries: [],
    snsSeries: [],
    totals: {
      sales: 0,
      salesChangePct: 0,
      adSpend: 0,
      adBreakdown: buildAdBreakdown([]),
      topChannelId: summaries[0]?.id ?? '',
    },
    periodTotals: buildPeriodTotals(summaries),
    dataSource: 'live',
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

function overlayLiveCommerce(
  snapshot: DashboardSnapshot,
  rows: ChannelSnapshotRow[],
  lookup?: AdsLookup,
): DashboardSnapshot {
  if (rows.length === 0) return snapshot

  const byChannel = new Map<string, ChannelSnapshotRow[]>()
  for (const row of rows) {
    const list = byChannel.get(row.channel_id) ?? []
    list.push(row)
    byChannel.set(row.channel_id, list)
  }
  if (byChannel.size === 0) return snapshot

  const from = kstYmd(snapshot.range.from)
  const to = kstYmd(snapshot.range.to)
  const hourly = from === to
  const lookupHours = lookup?.hours ?? null

  const channels = snapshot.channels.map((channel) => {
    const list = sortChannelRows(byChannel.get(channel.id) ?? [])
    if (list.length === 0) return channel
    const inRange = list.filter((row) => row.snapshot_date >= from && row.snapshot_date <= to)
    if (inRange.length === 0) {
      return {
        ...channel,
        source: 'sabangnet',
        sourceLive: true,
      }
    }

    const asOf = pickCommerceAsOf(inRange, to, lookupHours) ?? inRange.at(-1)!
    const sorted = sortChannelRows(inRange)
    const asOfIndex = sorted.findIndex(
      (row) =>
        row.snapshot_date === asOf.snapshot_date &&
        channelSnapshotHourOf(row) === channelSnapshotHourOf(asOf),
    )
    const prev = asOfIndex > 0 ? sorted[asOfIndex - 1] : null
    const chart = commerceSeriesFromRows(list, from, to, hourly, lookupHours)
    const values = chart.map((point) => point.value)

    return {
      ...channel,
      primaryValue: asOf.sales,
      primaryLabel: '매출',
      changePct:
        prev && prev.sales > 0
          ? Number((((asOf.sales - prev.sales) / prev.sales) * 100).toFixed(2))
          : 0,
      sparkline: values.slice(-12),
      dayLow: values.length ? Math.min(...values) : asOf.sales,
      dayHigh: values.length ? Math.max(...values) : asOf.sales,
      yearLow: values.length ? Math.min(...values) : asOf.sales,
      yearHigh: values.length ? Math.max(...values) : asOf.sales,
      prevClose: prev?.sales ?? asOf.sales,
      open: values[0] ?? asOf.sales,
      commerce: {
        sales: asOf.sales,
        orders: asOf.orders,
        conversionRate: channel.commerce?.conversionRate,
        adSpend: channel.commerce?.adSpend,
      },
      source: asOf.source === 'pluscl' ? 'pluscl' : 'sabangnet',
      sourceLive: true,
    }
  })

  const seriesByChannel = { ...snapshot.seriesByChannel }
  for (const [id, list] of byChannel) {
    seriesByChannel[id] = commerceSeriesFromRows(list, from, to, hourly, lookupHours)
  }

  const commerceSeries = mergeSeriesByTime(
    channels.filter((channel) => channel.kind === 'commerce').map((channel) => seriesByChannel[channel.id] ?? []),
  )
  const sales = channels
    .filter((channel) => channel.kind === 'commerce' && channel.sourceLive)
    .reduce((sum, channel) => sum + channel.primaryValue, 0)

  return {
    ...snapshot,
    channels,
    seriesByChannel,
    commerceSeries,
    combinedSeries: commerceSeries,
    totals: {
      ...snapshot.totals,
      sales,
    },
    periodTotals: rebuildPeriodTotals(channels, seriesByChannel, snapshot.periodTotals),
    dataSource: 'live',
    availableHours: commerceHoursInRange(rows, from, to),
  }
}

function shopNameFromRows(id: string, rows: ChannelSnapshotRow[]): string | undefined {
  for (const row of rows) {
    if (canonicalChannelId(row.channel_id) !== id) continue
    const shops = row.extra?.shops
    if (!Array.isArray(shops)) continue
    for (const shop of shops) {
      if (!shop || typeof shop !== 'object' || !('name' in shop)) continue
      const name = String((shop as { name?: unknown }).name ?? '').trim()
      if (name) return name
    }
  }
  return undefined
}

function plusclOfflineDefs(pluscl: PlusclSnapshot | null): ChannelDefinition[] {
  if (!pluscl) return []
  const names = new Set<string>()
  for (const row of pluscl.channelDaily) {
    if (!row.name || isExcludedPlusclCompany(row.name)) continue
    if (row.amount > 0 || row.lines > 0) names.add(row.name)
  }
  return [...names].map((name) => {
    const def = definitionForChannel(plusclChannelId(name), name)
    return {
      ...def,
      ticker: plusclTicker(name),
      collector: 'none',
      description: `${name}. PlusCL 오프라인.`,
    }
  })
}

function sortChannelsByAmount(snapshot: DashboardSnapshot): DashboardSnapshot {
  const ranked = [...snapshot.channels].sort(
    (left, right) => right.primaryValue - left.primaryValue || left.name.localeCompare(right.name, 'ko'),
  )
  return {
    ...snapshot,
    channels: ranked,
    totals: {
      ...snapshot.totals,
      topChannelId: ranked[0]?.id ?? snapshot.totals.topChannelId,
    },
  }
}

function plusclEventHourKst(eventAt: string | null): number {
  if (!eventAt) return 0
  const trimmed = eventAt.trim()
  const compact = trimmed.replace(/\D/g, '')
  if (compact.length >= 10) {
    const hour = Number(compact.slice(8, 10))
    if (Number.isFinite(hour)) return Math.min(23, Math.max(0, hour))
  }
  const match = trimmed.match(/(?:T|\s)(\d{2}):/)
  if (match) {
    const hour = Number(match[1])
    if (Number.isFinite(hour)) return Math.min(23, Math.max(0, hour))
  }
  return 0
}

function plusclHourlySeries(
  orders: PlusclOrderLine[],
  date: string,
  channelId: string,
  hours: number[] | null,
): TimePoint[] {
  const allowed = hours?.length ? new Set(hours) : null
  const lastHour = allowed ? Math.max(...hours!) : kstHour()
  const points: TimePoint[] = []
  for (let hour = 0; hour <= lastHour; hour += 1) {
    if (allowed && !allowed.has(hour)) continue
    let sales = 0
    for (const row of plusclSalesOrders(orders)) {
      if (row.ordDate.slice(0, 10) !== date) continue
      const id = plusclChannelId(row.ordCompName || row.ordCompCode || '기타')
      if (id !== channelId) continue
      if (plusclEventHourKst(row.eventAt) > hour) continue
      sales += row.amount
    }
    points.push({ timestamp: kstIsoAt(date, hour), value: sales })
  }
  return points
}

function overlayPlusclOffline(
  snapshot: DashboardSnapshot,
  pluscl: PlusclSnapshot | null,
  lookup?: AdsLookup,
): DashboardSnapshot {
  if (!pluscl) return sortChannelsByAmount(snapshot)
  const from = lookup?.from && lookup?.to
    ? lookup.from <= lookup.to
      ? lookup.from
      : lookup.to
    : kstYmd(snapshot.range.from)
  const to = lookup?.from && lookup?.to
    ? lookup.from <= lookup.to
      ? lookup.to
      : lookup.from
    : kstYmd(snapshot.range.to)
  const hourly = from === to
  const preservedHourly = new Set<string>()
  if (hourly) {
    for (const channel of snapshot.channels) {
      if (!channel.id.startsWith('pluscl_')) continue
      const series = snapshot.seriesByChannel[channel.id] ?? []
      if (series.length > 0) preservedHourly.add(channel.id)
    }
  }
  const byChannel = new Map<string, Array<{ date: string; sales: number; orders: number }>>()

  const daily =
    pluscl.channelDaily.length > 0
      ? pluscl.channelDaily
      : pluscl.orders
          .filter((row) => row.reportType === 'order' && !isExcludedPlusclCompany(row.ordCompName, row.ordCompCode))
          .reduce((list, row) => {
            const date = row.ordDate.slice(0, 10)
            const name = row.ordCompName || row.ordCompCode || '기타'
            const existing = list.find((item) => item.date === date && item.name === name)
            if (existing) {
              existing.lines += 1
              existing.qty += row.qty
              existing.amount += row.amount
              return list
            }
            list.push({ date, name, lines: 1, qty: row.qty, amount: row.amount })
            return list
          }, [] as PlusclSnapshot['channelDaily'])

  for (const row of daily) {
    if (!row.date || isExcludedPlusclCompany(row.name)) continue
    const id = plusclChannelId(row.name)
    const list = byChannel.get(id) ?? []
    list.push({ date: row.date, sales: row.amount, orders: row.lines })
    byChannel.set(id, list)
  }
  if (byChannel.size === 0) return sortChannelsByAmount(snapshot)

  const channels = snapshot.channels.map((channel) => {
    if (hourly && preservedHourly.has(channel.id)) return channel
    if (hourly && channel.id.startsWith('pluscl_')) {
      const series = plusclHourlySeries(pluscl.orders, from, channel.id, lookup?.hours ?? null)
      if (series.length === 0) return channel
      const latest = series.at(-1)!
      const prev = series.length >= 2 ? series[series.length - 2]! : null
      const values = series.map((point) => point.value)
      const changePct =
        prev && prev.value > 0 ? Number((((latest.value - prev.value) / prev.value) * 100).toFixed(2)) : 0
      return {
        ...channel,
        primaryValue: latest.value,
        primaryLabel: '매출',
        changePct,
        sparkline: values.slice(-12),
        dayLow: values.length ? Math.min(...values) : latest.value,
        dayHigh: values.length ? Math.max(...values) : latest.value,
        yearLow: values.length ? Math.min(...values) : latest.value,
        yearHigh: values.length ? Math.max(...values) : latest.value,
        prevClose: prev?.value ?? latest.value,
        open: values[0] ?? latest.value,
        commerce: { sales: latest.value, orders: channel.commerce?.orders ?? 0 },
        source: 'pluscl',
        sourceLive: true,
      }
    }
    const list = [...(byChannel.get(channel.id) ?? [])].sort((left, right) => left.date.localeCompare(right.date))
    if (list.length === 0) return channel
    const inRange = list.filter((row) => row.date >= from && row.date <= to)
    const latest = inRange.at(-1)
    if (!latest) {
      return { ...channel, source: 'pluscl', sourceLive: false }
    }
    const prev = inRange.length >= 2 ? inRange[inRange.length - 2] : null
    const spark = inRange.map((row) => row.sales)
    const changePct =
      prev && prev.sales > 0 ? Number((((latest.sales - prev.sales) / prev.sales) * 100).toFixed(2)) : 0
    return {
      ...channel,
      primaryValue: latest.sales,
      primaryLabel: '매출',
      changePct,
      sparkline: spark.slice(-12),
      dayLow: spark.length ? Math.min(...spark) : 0,
      dayHigh: spark.length ? Math.max(...spark) : 0,
      yearLow: spark.length ? Math.min(...spark) : 0,
      yearHigh: spark.length ? Math.max(...spark) : 0,
      prevClose: prev?.sales ?? latest.sales,
      open: inRange[0]?.sales ?? latest.sales,
      commerce: { sales: latest.sales, orders: latest.orders },
      source: 'pluscl',
      sourceLive: false,
    }
  })

  const seriesByChannel = { ...snapshot.seriesByChannel }
  for (const [id, list] of byChannel) {
    if (hourly && preservedHourly.has(id)) continue
    const inRange = [...list]
      .sort((left, right) => left.date.localeCompare(right.date))
      .filter((row) => row.date >= from && row.date <= to)
    if (inRange.length === 0) continue
    if (hourly) {
      seriesByChannel[id] = plusclHourlySeries(pluscl.orders, from, id, lookup?.hours ?? null)
      continue
    }
    seriesByChannel[id] = inRange.map((row) => ({
      timestamp: kstIsoAt(row.date, 12),
      value: row.sales,
    }))
  }

  const ranked = [...channels].sort(
    (left, right) => right.primaryValue - left.primaryValue || left.name.localeCompare(right.name, 'ko'),
  )
  const seriesOf = (match: (channel: (typeof ranked)[number]) => boolean) =>
    mergeSeriesByTime(ranked.filter(match).map((channel) => seriesByChannel[channel.id] ?? []))
  const combinedSeries = seriesOf((channel) => channel.kind === 'commerce')
  const commerceSeries = seriesOf((channel) => channel.kind === 'commerce' && channel.source !== 'pluscl')
  const snsSeries = seriesOf((channel) => channel.source === 'pluscl')
  const sales = ranked
    .filter((channel) => channel.kind === 'commerce')
    .reduce((sum, channel) => sum + channel.primaryValue, 0)

  return {
    ...snapshot,
    channels: ranked,
    seriesByChannel,
    commerceSeries,
    snsSeries,
    combinedSeries,
    totals: {
      ...snapshot.totals,
      sales,
      topChannelId: ranked[0]?.id ?? snapshot.totals.topChannelId,
    },
    periodTotals: rebuildPeriodTotals(ranked, seriesByChannel, snapshot.periodTotals),
  }
}

function sabangnetCommerceDefs(rows: ChannelSnapshotRow[], viewer: AppUser): ChannelDefinition[] {
  const ids = new Set<string>(['naver'])
  for (const row of rows) {
    const id = canonicalChannelId(row.channel_id)
    if (id && (row.sales > 0 || row.orders > 0)) ids.add(id)
  }

  return [...ids]
    .filter((id) => isChannelAllowed(viewer, id))
    .map((id) => definitionForChannel(id, shopNameFromRows(id, rows)))
    .sort((left, right) => {
      if (left.id === 'naver') return -1
      if (right.id === 'naver') return 1
      return left.name.localeCompare(right.name, 'ko')
    })
}

export async function getDashboardSnapshot(
  rangeKey: DateRangeKey,
  viewer: AppUser,
  lookup?: AdsLookup,
): Promise<DashboardSnapshot> {
  if (!viewer?.role) {
    throw new Error('인증된 사용자만 대시보드를 조회할 수 있습니다.')
  }

  const [ads, commerceRows, pluscl] = await Promise.all([
    fetchAdsOrEmpty(kstYmd(new Date(), -90), kstYmd()),
    fetchChannelSnapshotsOrEmpty(kstYmd(new Date(), -180), kstYmd(), []),
    fetchPlusclOrEmpty(kstYmd(new Date(), -180), kstYmd()),
  ])
  const sabangDefs = sabangnetCommerceDefs(commerceRows, viewer)
  const offlineDefs = plusclOfflineDefs(pluscl).filter((def) => isChannelAllowed(viewer, def.id))
  const known = new Set(sabangDefs.map((def) => def.id))
  const defs = [...sabangDefs, ...offlineDefs.filter((def) => !known.has(def.id))]
  const snapshot = overlayPlusclOffline(
    overlayLiveCommerce(buildCommerceSnapshot(rangeKey, defs, lookup), commerceRows, lookup),
    pluscl,
    lookup,
  )
  return presentSnapshot(overlayLiveAdSpend(snapshot, ads), viewer)
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
  const rows = await fetchAdsOrEmpty(from, kstYmd())
  return presentSnapshot(
    buildLiveSnapshot(rows, range, { from: start, to: end, hours: lookup?.hours ?? null }),
    viewer,
  )
}
