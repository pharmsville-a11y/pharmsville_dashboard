import type { DateRange, DateRangeKey } from './types'
import { kstDateFromYmd, kstDaysBetween, kstYmd } from '../lib/kst'

export const RANGE_KEYS: DateRangeKey[] = ['1D', '7D', '1M', '6M', '1Y', 'ALL']

export const RANGE_LABELS: Record<DateRangeKey, string> = {
  '1D': '1일',
  '7D': '7일',
  '1M': '1달',
  '6M': '6달',
  '1Y': '1년',
  ALL: '전체',
}

export function toDateRange(key: DateRangeKey): DateRange {
  const to = new Date()
  const from = new Date(to)

  switch (key) {
    case '1D':
      from.setDate(from.getDate() - 1)
      break
    case '7D':
      from.setDate(from.getDate() - 6)
      break
    case '1M':
      from.setMonth(from.getMonth() - 1)
      break
    case '6M':
      from.setMonth(from.getMonth() - 6)
      break
    case '1Y':
      from.setFullYear(from.getFullYear() - 1)
      break
    case 'ALL':
      from.setFullYear(from.getFullYear() - 3)
      break
  }

  return { key, from, to }
}

export function rangeKeyForSpan(from: string, to: string): DateRangeKey {
  const days = Math.abs(kstDaysBetween(from, to)) + 1
  if (days <= 1) return '1D'
  if (days <= 10) return '7D'
  if (days <= 45) return '1M'
  if (days <= 200) return '6M'
  if (days <= 400) return '1Y'
  return 'ALL'
}

export function lookupFromRangeKey(key: DateRangeKey, end = kstYmd()): { from: string; to: string } {
  const daysBack =
    key === '1D' ? 0 : key === '7D' ? 6 : key === '1M' ? 30 : key === '6M' ? 180 : key === '1Y' ? 365 : 365 * 3
  return { from: kstYmd(kstDateFromYmd(end), -daysBack), to: end }
}

export function toAdsDateRange(key: DateRangeKey, selectedDate: string): DateRange {
  if (key === '1D') {
    const day = kstDateFromYmd(selectedDate)
    return { key, from: day, to: day }
  }
  return toDateRange(key)
}

export function adsRangeFromLookup(from: string, to: string): DateRange {
  const start = from <= to ? from : to
  const end = from <= to ? to : from
  return {
    key: rangeKeyForSpan(start, end),
    from: kstDateFromYmd(start),
    to: kstDateFromYmd(end),
  }
}

export function pointCount(key: DateRangeKey): number {
  switch (key) {
    case '1D':
      return 24
    case '7D':
      return 7
    case '1M':
      return 30
    case '6M':
      return 26
    case '1Y':
      return 12
    case 'ALL':
      return 24
  }
}

export function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export async function withLatency<T>(value: T, ms = 90): Promise<T> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
  return value
}
