import type { TimePoint } from '../adapters/types'
import { kstIsoAt } from '../lib/kst'
import type { ChannelSnapshotRow } from './querySnapshots'

function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to
}

export function channelSnapshotHourOf(row: ChannelSnapshotRow): number {
  const parsed = Number(row.snapshot_hour)
  if (Number.isFinite(parsed)) return Math.min(23, Math.max(0, Math.round(parsed)))
  return 0
}

export function sortChannelRows(rows: ChannelSnapshotRow[]): ChannelSnapshotRow[] {
  return [...rows].sort((left, right) => {
    const date = left.snapshot_date.localeCompare(right.snapshot_date)
    if (date) return date
    return channelSnapshotHourOf(left) - channelSnapshotHourOf(right)
  })
}

export function lastChannelSnapshotPerDay(rows: ChannelSnapshotRow[]): ChannelSnapshotRow[] {
  const best = new Map<string, ChannelSnapshotRow>()
  for (const row of rows) {
    const key = `${row.channel_id}|${row.snapshot_date}`
    const previous = best.get(key)
    if (!previous || channelSnapshotHourOf(row) >= channelSnapshotHourOf(previous)) {
      best.set(key, row)
    }
  }
  return [...best.values()]
}

export function commerceHoursInRange(rows: ChannelSnapshotRow[], from: string, to: string): number[] {
  const hours = new Set<number>()
  for (const row of rows) {
    if (!inRange(row.snapshot_date, from, to)) continue
    hours.add(channelSnapshotHourOf(row))
  }
  return [...hours].sort((left, right) => left - right)
}

export function pickCommerceAsOf(
  rows: ChannelSnapshotRow[],
  date: string,
  hours: number[] | null,
): ChannelSnapshotRow | undefined {
  const sorted = sortChannelRows(rows)
  const allowed = hours?.length ? new Set(hours) : null
  if (allowed) {
    for (let index = sorted.length - 1; index >= 0; index -= 1) {
      const row = sorted[index]
      if (row.snapshot_date === date && allowed.has(channelSnapshotHourOf(row))) return row
    }
  }
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const row = sorted[index]
    if (row.snapshot_date === date) return row
  }
  return sorted.at(-1)
}

export function commerceSeriesFromRows(
  rows: ChannelSnapshotRow[],
  from: string,
  to: string,
  hourly: boolean,
  hours: number[] | null,
): TimePoint[] {
  const allowed = hours?.length ? new Set(hours) : null
  const inWindow = rows.filter((row) => {
    if (!inRange(row.snapshot_date, from, to)) return false
    if (allowed && !allowed.has(channelSnapshotHourOf(row))) return false
    return true
  })
  const points = hourly ? sortChannelRows(inWindow) : sortChannelRows(lastChannelSnapshotPerDay(inWindow))
  return points.map((row) => ({
    timestamp: kstIsoAt(row.snapshot_date, channelSnapshotHourOf(row)),
    value: row.sales,
  }))
}
