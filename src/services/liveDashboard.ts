import { AD_CATALOG, AD_PRODUCT_LABEL, getAd, type AdDefinition } from '../ads'
import type { ChannelSummary, DateRange, LiveAdCampaign, LiveAdMetrics, SummaryPeriod, TimePoint } from '../adapters/types'
import { kstDateFromYmd, kstDaysBetween, kstIsoAt, kstYmd, parseYmd, startOfKstMonth, startOfKstWeek } from '../lib/kst'
import { formatPeriodRange } from '../lib/format'
import { buildAdBreakdown, hoursInRange, lastSnapshotPerDay, latestAdSnapshotDate, snapshotHourOf, sumAdSpend } from './adSpend'
import type { AdsLookup, DashboardSnapshot, PeriodTotals, PeriodTotalsMap } from './types'
import type { AdSnapshotRow } from './querySnapshots'

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function ymd(value: unknown): string {
  return parseYmd(value) ?? ''
}

function validDate(value: Date): Date {
  return Number.isNaN(value.getTime()) ? new Date() : value
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(validDate(value))
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(validDate(value))
}

function pctChange(current: number, previous: number): number {
  if (!previous) return 0
  return Number((((current - previous) / previous) * 100).toFixed(2))
}

function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to
}

function extraRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function nullableNum(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function campaignListOf(value: unknown): LiveAdCampaign[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = extraRecord(item)
    const id = String(row.id ?? '')
    if (!id) return []
    return [{
      id,
      name: String(row.name ?? id),
      campaignTp: String(row.campaignTp ?? ''),
      adSpend: num(row.salesAmt ?? row.adSpend),
      impressions: num(row.impCnt ?? row.impressions),
      clicks: num(row.clkCnt ?? row.clicks),
      conversions: num(row.ccnt ?? row.conversions),
      convAmt: num(row.convAmt ?? row.conv_amt),
    }]
  })
}

function liveAdOf(row: AdSnapshotRow): LiveAdMetrics {
  const extra = extraRecord(row.extra)
  const stats = extraRecord(extra.stats)
  const impressions = num(row.impressions)
  const clicks = num(row.clicks)
  const conversions = num(row.conversions)
  const convAmt = num(row.conv_amt)
  const spend = num(row.ad_spend)
  return {
    impressions,
    clicks,
    conversions,
    convAmt,
    viewCnt: num(stats.viewCnt),
    ctr: num(stats.ctr) || (impressions ? (clicks / impressions) * 100 : 0),
    cpc: num(stats.cpc) || (clicks ? spend / clicks : 0),
    crto: num(stats.crto) || (clicks ? (conversions / clicks) * 100 : 0),
    ror: num(stats.ror) || (spend ? (convAmt / spend) * 100 : 0),
    cpConv: num(stats.cpConv) || (conversions ? spend / conversions : 0),
    avgRnk: nullableNum(stats.avgRnk),
    pcNxAvgRnk: nullableNum(stats.pcNxAvgRnk),
    mblNxAvgRnk: nullableNum(stats.mblNxAvgRnk),
    recentAvgRnk: nullableNum(stats.recentAvgRnk),
    recentAvgCpc: nullableNum(stats.recentAvgCpc),
    campaignCount: num(extra.campaign_count),
    campaigns: campaignListOf(extra.campaigns),
  }
}

function sortRows(rows: AdSnapshotRow[]): AdSnapshotRow[] {
  return [...rows].sort((left, right) => {
    const date = ymd(left.snapshot_date).localeCompare(ymd(right.snapshot_date))
    if (date) return date
    return snapshotHourOf(left) - snapshotHourOf(right)
  })
}

function pickAsOf(rows: AdSnapshotRow[], date: string, hours: number[] | null): AdSnapshotRow | undefined {
  const sorted = sortRows(rows)
  const allowed = hours?.length ? new Set(hours) : null
  if (allowed) {
    for (let index = sorted.length - 1; index >= 0; index -= 1) {
      const row = sorted[index]
      if (row && ymd(row.snapshot_date) === date && allowed.has(snapshotHourOf(row))) return row
    }
  }
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const row = sorted[index]
    if (row && ymd(row.snapshot_date) === date) return row
  }
  return sorted.at(-1)
}

function seriesFromRows(
  rows: AdSnapshotRow[],
  range: DateRange,
  hourly: boolean,
  hours: number[] | null = null,
): TimePoint[] {
  const from = kstYmd(range.from)
  const to = kstYmd(range.to)
  const allowed = hours?.length ? new Set(hours) : null
  const inWindow = rows.filter((row) => {
    const date = ymd(row.snapshot_date)
    if (!date || !inRange(date, from, to)) return false
    if (allowed && !allowed.has(snapshotHourOf(row))) return false
    return true
  })
  const points = hourly ? sortRows(inWindow) : sortRows(lastSnapshotPerDay(inWindow))
  return points.map((row) => ({
    timestamp: kstIsoAt(ymd(row.snapshot_date), snapshotHourOf(row)),
    value: num(row.ad_spend),
  }))
}

function mergeSeries(seriesList: TimePoint[][]): TimePoint[] {
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

function topAd(rows: AdSnapshotRow[], from: string, to: string) {
  const valueById = new Map<string, number>()
  for (const row of lastSnapshotPerDay(rows)) {
    if (!ymd(row.snapshot_date) || !inRange(ymd(row.snapshot_date), from, to)) continue
    valueById.set(row.channel_id, (valueById.get(row.channel_id) ?? 0) + num(row.ad_spend))
  }
  const ranked = [...valueById.entries()].sort((left, right) => right[1] - left[1])
  return ranked[0] ?? ['', 0]
}

function periodDates(latest: string, period: SummaryPeriod): { from: string; to: string } {
  if (period === 'daily') return { from: latest, to: latest }
  if (period === 'weekly') return { from: startOfKstWeek(latest), to: latest }
  return { from: startOfKstMonth(latest), to: latest }
}

function previousWindow(latest: string, period: SummaryPeriod): { from: string; to: string } | null {
  const current = periodDates(latest, period)
  if (period === 'daily') {
    const prev = kstYmd(kstDateFromYmd(latest), -1)
    return { from: prev, to: prev }
  }
  if (period === 'weekly') {
    const prevEnd = kstYmd(kstDateFromYmd(current.from), -1)
    return { from: startOfKstWeek(prevEnd), to: prevEnd }
  }
  const monthStart = kstDateFromYmd(current.from)
  const prevMonthEnd = kstYmd(monthStart, -1)
  return { from: startOfKstMonth(prevMonthEnd), to: prevMonthEnd }
}

function buildPeriodTotals(rows: AdSnapshotRow[], latest: string): PeriodTotalsMap {
  const periods: SummaryPeriod[] = ['daily', 'weekly', 'monthly']
  const entries = periods.map((period) => {
    const { from, to } = periodDates(latest, period)
    const prev = previousWindow(latest, period)
    const adSpend = sumAdSpend(rows, from, to)
    const prevAd = prev ? sumAdSpend(rows, prev.from, prev.to) : 0
    const [topChannelId, topChannelValue] = topAd(rows, from, to)
    const totals: PeriodTotals = {
      period,
      from: kstDateFromYmd(from),
      to: kstDateFromYmd(to),
      dateLabel: formatPeriodRange(validDate(kstDateFromYmd(from)), validDate(kstDateFromYmd(to)), period),
      sales: 0,
      salesChangePct: pctChange(adSpend, prevAd),
      adSpend,
      topChannelId,
      topChannelValue,
    }
    return [period, totals] as const
  })
  return Object.fromEntries(entries) as PeriodTotalsMap
}

function waitingSummary(seed: AdDefinition): ChannelSummary {
  return {
    id: seed.id,
    kind: 'ads',
    name: seed.name,
    shortName: seed.shortName,
    ticker: seed.ticker,
    letter: seed.letter,
    badge: seed.badge,
    accent: seed.accent,
    sparkColor: seed.sparkColor,
    primaryValue: 0,
    primaryLabel: `${AD_PRODUCT_LABEL[seed.product]} 광고비`,
    changePct: 0,
    sparkline: [],
    dayLow: 0,
    dayHigh: 0,
    yearLow: 0,
    yearHigh: 0,
    prevClose: 0,
    open: 0,
    tradeTime: '—',
    tradeDate: '대기',
    source: seed.collector === 'none' ? 'pending' : seed.collector,
    sourceLive: false,
    platform: seed.platform,
    product: seed.product,
    liveAd: {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      convAmt: 0,
      viewCnt: 0,
      ctr: 0,
      cpc: 0,
      crto: 0,
      ror: 0,
      cpConv: 0,
      avgRnk: null,
      pcNxAvgRnk: null,
      mblNxAvgRnk: null,
      recentAvgRnk: null,
      recentAvgCpc: null,
      campaignCount: 0,
      campaigns: [],
    },
    commerce: { adSpend: 0 },
  }
}

function toSummary(
  seed: AdDefinition,
  rows: AdSnapshotRow[],
  range: DateRange,
  lookup: AdsLookup,
  hourly: boolean,
): ChannelSummary {
  if (rows.length === 0) return waitingSummary(seed)
  const asOf = pickAsOf(rows, lookup.to, lookup.hours)
  if (!asOf) return waitingSummary(seed)

  const snapshotDay = ymd(asOf.snapshot_date)
  if (!snapshotDay) return waitingSummary(seed)

  const sorted = sortRows(rows)
  const asOfIndex = sorted.findIndex(
    (row) => ymd(row.snapshot_date) === snapshotDay && snapshotHourOf(row) === snapshotHourOf(asOf),
  )
  const prev = asOfIndex > 0 ? sorted[asOfIndex - 1] : undefined
  const chart = seriesFromRows(rows, range, hourly, lookup.hours)
  const values = chart.map((point) => point.value)
  const primary = num(asOf.ad_spend)
  const min = values.length ? Math.min(...values) : primary
  const max = values.length ? Math.max(...values) : primary
  const capturedRaw = asOf.captured_at ? new Date(asOf.captured_at) : new Date(kstIsoAt(snapshotDay, snapshotHourOf(asOf)))
  const captured = validDate(capturedRaw)
  const liveAd = liveAdOf(asOf)

  return {
    id: seed.id,
    kind: 'ads',
    name: seed.name,
    shortName: seed.shortName,
    ticker: seed.ticker,
    letter: seed.letter,
    badge: seed.badge,
    accent: seed.accent,
    sparkColor: seed.sparkColor,
    primaryValue: primary,
    primaryLabel: AD_PRODUCT_LABEL[seed.product] + ' 광고비',
    changePct: pctChange(primary, prev ? num(prev.ad_spend) : primary),
    sparkline: values.slice(-12),
    dayLow: min,
    dayHigh: max,
    yearLow: min,
    yearHigh: max,
    prevClose: prev ? num(prev.ad_spend) : primary,
    open: values[0] ?? primary,
    tradeTime: formatTime(captured),
    tradeDate: formatDate(kstDateFromYmd(snapshotDay)),
    source: asOf.source,
    sourceLive: true,
    platform: seed.platform,
    product: seed.product,
    liveAd,
    commerce: { adSpend: primary },
  }
}

export function buildLiveSnapshot(
  rows: AdSnapshotRow[],
  range: DateRange,
  lookup: AdsLookup = { from: kstYmd(), to: kstYmd(), hours: null },
): DashboardSnapshot {
  const liveRows = rows.filter((row) => Boolean(getAd(row.channel_id)))
  const from = lookup.from <= lookup.to ? lookup.from : lookup.to
  const to = lookup.from <= lookup.to ? lookup.to : lookup.from
  const hourly = from === to
  const grouped = new Map<string, AdSnapshotRow[]>()
  for (const row of liveRows) {
    const list = grouped.get(row.channel_id) ?? []
    list.push(row)
    grouped.set(row.channel_id, list)
  }

  const resolved = { ...lookup, from, to }
  const channels = AD_CATALOG.map((seed) =>
    toSummary(seed, grouped.get(seed.id) ?? [], range, resolved, hourly),
  )

  const seriesByChannel: Record<string, TimePoint[]> = {}
  for (const channel of channels) {
    seriesByChannel[channel.id] = seriesFromRows(grouped.get(channel.id) ?? [], range, hourly, resolved.hours)
  }

  const commerceSeries = mergeSeries(
    channels.filter((channel) => channel.product === 'sa').map((channel) => seriesByChannel[channel.id] ?? []),
  )
  const snsSeries = mergeSeries(
    channels.filter((channel) => channel.product === 'da').map((channel) => seriesByChannel[channel.id] ?? []),
  )
  const combinedSeries = mergeSeries(Object.values(seriesByChannel))
  const asOfDate = to || latestAdSnapshotDate(liveRows) || kstYmd()
  const allowed = resolved.hours?.length ? new Set(resolved.hours) : null
  const scoped = allowed ? liveRows.filter((row) => allowed.has(snapshotHourOf(row))) : liveRows
  const adSpend = sumAdSpend(scoped, from, to)
  const dayCount = Math.max(1, Math.abs(kstDaysBetween(from, to)) + 1)
  const prevTo = kstYmd(kstDateFromYmd(from), -1)
  const prevFrom = kstYmd(kstDateFromYmd(prevTo), -(dayCount - 1))
  const prevAd = sumAdSpend(liveRows, prevFrom, prevTo)
  const top = [...channels].sort((left, right) => right.primaryValue - left.primaryValue)[0]
  const highlightHour = resolved.hours?.length === 1 ? resolved.hours[0] : undefined
  const highlightTime = highlightHour == null || !hourly ? undefined : kstIsoAt(asOfDate, highlightHour)

  return {
    range,
    channels,
    seriesByChannel,
    combinedSeries,
    commerceSeries,
    snsSeries,
    totals: {
      sales: 0,
      salesChangePct: pctChange(adSpend, prevAd),
      adSpend,
      adBreakdown: buildAdBreakdown(liveRows, asOfDate, resolved.hours),
      topChannelId: top?.id ?? channels[0]?.id ?? '',
    },
    periodTotals: buildPeriodTotals(liveRows, asOfDate),
    dataSource: liveRows.length > 0 ? 'live' : 'mock',
    latestSnapshotDate: asOfDate,
    availableHours: hoursInRange(liveRows, from, to),
    highlightTime,
  }
}
