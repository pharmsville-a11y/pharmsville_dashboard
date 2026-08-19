import type { DateRange, DateRangeKey } from './types'

export const RANGE_KEYS: DateRangeKey[] = ['1D', '5D', '1M', '6M', '1Y', 'ALL']

export function toDateRange(key: DateRangeKey): DateRange {
  const to = new Date()
  const from = new Date(to)

  switch (key) {
    case '1D':
      from.setDate(from.getDate() - 1)
      break
    case '5D':
      from.setDate(from.getDate() - 5)
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

export function pointCount(key: DateRangeKey): number {
  switch (key) {
    case '1D':
      return 24
    case '5D':
      return 40
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
