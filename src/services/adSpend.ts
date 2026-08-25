import { AD_CATALOG, AD_PLATFORM_LABEL, type AdPlatform, type AdProduct } from '../ads'
import { parseYmd } from '../lib/kst'
import type { AdSnapshotRow } from './querySnapshots'
import type { AdSpendBreakdown } from './types'

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function ymd(value: unknown): string {
  return parseYmd(value) ?? ''
}

function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to
}

export function snapshotHourOf(row: AdSnapshotRow): number {
  const parsed = Number(row.snapshot_hour)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(23, Math.max(0, Math.round(parsed)))
}

export function lastSnapshotPerDay(rows: AdSnapshotRow[]): AdSnapshotRow[] {
  const best = new Map<string, AdSnapshotRow>()
  for (const row of rows) {
    const date = ymd(row.snapshot_date)
    if (!date) continue
    const key = `${row.channel_id}|${date}`
    const previous = best.get(key)
    if (!previous || snapshotHourOf(row) >= snapshotHourOf(previous)) best.set(key, row)
  }
  return [...best.values()]
}

export function hoursOnDate(rows: AdSnapshotRow[], date: string): number[] {
  return hoursInRange(rows, date, date)
}

export function hoursInRange(rows: AdSnapshotRow[], from: string, to: string): number[] {
  const hours = new Set<number>()
  for (const row of rows) {
    const date = ymd(row.snapshot_date)
    if (!date || !inRange(date, from, to)) continue
    hours.add(snapshotHourOf(row))
  }
  return [...hours].sort((left, right) => left - right)
}

export function latestAdSnapshotDate(rows: AdSnapshotRow[]): string | undefined {
  return rows
    .map((row) => ymd(row.snapshot_date))
    .filter(Boolean)
    .sort()
    .at(-1)
}

export function sumAdSpend(rows: AdSnapshotRow[], from: string, to: string): number {
  return lastSnapshotPerDay(rows)
    .filter((row) => {
      const date = ymd(row.snapshot_date)
      return Boolean(date) && inRange(date, from, to)
    })
    .reduce((total, row) => total + num(row.ad_spend), 0)
}

export function sumAdSpendByProduct(
  rows: AdSnapshotRow[],
  from: string,
  to: string,
): Record<AdProduct, number> {
  const totals: Record<AdProduct, number> = { sa: 0, da: 0 }
  for (const row of lastSnapshotPerDay(rows)) {
    const date = ymd(row.snapshot_date)
    if (!date || !inRange(date, from, to)) continue
    totals[row.product] += num(row.ad_spend)
  }
  return totals
}

export function buildAdBreakdown(
  rows: AdSnapshotRow[],
  date?: string,
  hours?: number[] | null,
): AdSpendBreakdown[] {
  const latest = date ?? latestAdSnapshotDate(rows)
  const dayRows = latest ? rows.filter((row) => ymd(row.snapshot_date) === latest) : []
  const allowed = hours?.length ? new Set(hours) : null
  const chosen = lastSnapshotPerDay(
    allowed ? dayRows.filter((row) => allowed.has(snapshotHourOf(row))) : dayRows,
  )

  const byId = new Map(chosen.map((row) => [row.channel_id, row]))

  return AD_CATALOG.map((seed) => {
    const row = byId.get(seed.id)
    return {
      id: seed.id,
      platform: seed.platform,
      product: seed.product,
      name: seed.name,
      shortName: `${AD_PLATFORM_LABEL[seed.platform]} ${seed.product.toUpperCase()}`,
      adSpend: row ? num(row.ad_spend) : 0,
      live: Boolean(row) && seed.collector !== 'none',
    }
  })
}

export function groupedAdBreakdown(items: AdSpendBreakdown[]) {
  const order: AdPlatform[] = ['naver', 'coupang', 'google']
  return order.map((platform) => ({
    platform,
    label: AD_PLATFORM_LABEL[platform],
    sa: items.find((item) => item.platform === platform && item.product === 'sa'),
    da: items.find((item) => item.platform === platform && item.product === 'da'),
  }))
}
