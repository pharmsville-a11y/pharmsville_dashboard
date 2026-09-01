import { isPlusclConfigured, fetchPlusclSnapshot } from './queryPluscl'
import {
  fetchAdsOrEmpty,
  fetchChannelSnapshotsOrEmpty,
  isQueryConfigured,
  snapshotsQueryUrl,
  type AdSnapshotRow,
  type ChannelSnapshotRow,
} from './querySnapshots'
import { kstIsoAt, kstYmd, parseYmd } from '../lib/kst'

export type CollectState = 'ok' | 'late' | 'idle' | 'error'

export type CollectStatus = {
  state: CollectState
  capturedAt: Date | null
  parts: string[]
}

const STALE_MS = 2 * 60 * 60 * 1000

function parseStamp(value: string | null | undefined): Date | null {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const date = new Date(iso)
  if (!Number.isNaN(date.getTime())) return date
  const patched = iso.replace(/([+-]\d{2})$/, '$1:00')
  const retry = new Date(patched)
  return Number.isNaN(retry.getTime()) ? null : retry
}

function later(current: Date | null, next: Date | null): Date | null {
  if (!next) return current
  if (!current || next.getTime() > current.getTime()) return next
  return current
}

function fromHour(date: string, hour: number): Date | null {
  const ymd = parseYmd(date)
  if (!ymd) return null
  return parseStamp(kstIsoAt(ymd, hour))
}

function hourOf(row: AdSnapshotRow): number {
  const parsed = Number(row.snapshot_hour)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(23, Math.max(0, Math.round(parsed)))
}

function latestAdStamp(rows: AdSnapshotRow[]): Date | null {
  let latest: Date | null = null
  for (const row of rows) {
    latest = later(latest, parseStamp(row.captured_at))
    latest = later(latest, fromHour(row.snapshot_date, hourOf(row)))
  }
  return latest
}

function latestSnapshotStamp(rows: ChannelSnapshotRow[]): Date | null {
  let latest: Date | null = null
  for (const row of rows) {
    latest = later(latest, parseStamp(row.captured_at))
  }
  return latest
}

function plusclStamp(snapshot: {
  capturedAt: string | null
  stockAsOf: { date: string; hour: number } | null
}): Date | null {
  const hourStamp = snapshot.stockAsOf
    ? fromHour(snapshot.stockAsOf.date, snapshot.stockAsOf.hour)
    : null
  const captured = parseStamp(snapshot.capturedAt)
  return later(hourStamp, captured)
}

export async function fetchCollectStatus(): Promise<CollectStatus> {
  const today = kstYmd()
  const yesterday = kstYmd(new Date(), -1)
  const parts: string[] = []
  let adsAt: Date | null = null
  let plusclAt: Date | null = null
  let salesAt: Date | null = null
  const commerceIds: string[] = []

  try {
    const jobs: Array<Promise<void>> = []

    if (isQueryConfigured()) {
      jobs.push(
        fetchAdsOrEmpty(yesterday, today).then((rows) => {
          adsAt = latestAdStamp(rows)
          if (adsAt) parts.push('광고')
        }),
      )
    }

    if (snapshotsQueryUrl()) {
      jobs.push(
        fetchChannelSnapshotsOrEmpty(yesterday, today, commerceIds).then((rows) => {
          salesAt = latestSnapshotStamp(rows)
          if (salesAt) parts.push('매출')
        }),
      )
    }

    if (isPlusclConfigured()) {
      jobs.push(
        fetchPlusclSnapshot(today, today)
          .then((snapshot) => {
            plusclAt = plusclStamp(snapshot)
            if (plusclAt) parts.push('물류')
          })
          .catch(() => {
            // 물류만 실패해도 광고·매출 시각은 보여 준다.
          }),
      )
    }

    if (jobs.length === 0) {
      return { state: 'idle', capturedAt: null, parts: [] }
    }

    await Promise.all(jobs)
    const capturedAt = later(later(adsAt, plusclAt), salesAt)
    if (!capturedAt) return { state: 'idle', capturedAt: null, parts }
    const stale = Date.now() - capturedAt.getTime() > STALE_MS
    return { state: stale ? 'late' : 'ok', capturedAt, parts }
  } catch {
    return { state: 'error', capturedAt: null, parts }
  }
}
