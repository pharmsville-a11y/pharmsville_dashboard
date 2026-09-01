import { kstDateFromYmd } from './kst'

export function formatWon(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

export function formatPct(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatCompact(value: number): string {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}억`
  }
  if (value >= 10_000) {
    return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만`
  }
  return formatNumber(value)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

export function formatRank(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '—'
  return value.toFixed(2)
}

export function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function formatAxisDateTime(iso: string): { date: string; time: string } {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return { date: '', time: '' }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return {
    date: `${get('month')}/${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  }
}

export function formatAxisTime(iso: string, _rangeKey?: string): string {
  const { date, time } = formatAxisDateTime(iso)
  if (!date) return ''
  return `${date} ${time}`
}

export function formatTooltipTime(iso: string): string {
  const { date, time } = formatAxisDateTime(iso)
  if (!date) return ''
  return `${date} ${time}`
}

export function formatSabangnetDateTime(value: unknown): { date: string; time: string; raw: string } {
  const raw = String(value ?? '').trim()
  if (!raw) return { date: '', time: '', raw: '' }
  const digits = raw.replace(/\D/g, '')
  if (digits.length >= 14) {
    return {
      date: `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`,
      time: `${digits.slice(8, 10)}:${digits.slice(10, 12)}:${digits.slice(12, 14)}`,
      raw,
    }
  }
  if (digits.length >= 8) {
    const date = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
    const rest = raw.slice(raw.search(/\d{8}/) + 8).trim()
    const timeMatch = rest.match(/(\d{1,2}:\d{2}(?::\d{2})?)/)
    return { date, time: timeMatch?.[1] ?? '', raw }
  }
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/)
  if (iso) return { date: iso[1], time: iso[2], raw }
  return { date: raw, time: '', raw }
}

export function formatHoursLabel(hours: number[] | null | undefined): string {
  if (!hours?.length) return '전체 시간'
  const sorted = [...new Set(hours)].sort((left, right) => left - right)
  if (sorted.length === 1) return `${sorted[0]}시`
  const consecutive = sorted.every((hour, index) => index === 0 || hour === sorted[index - 1]! + 1)
  if (consecutive) return `${sorted[0]}–${sorted[sorted.length - 1]}시`
  if (sorted.length <= 4) return sorted.map((hour) => `${hour}시`).join(', ')
  return `${sorted.length}개 시각`
}

export function hoursFromSpan(fromHour: number, toHour: number): number[] {
  const start = Math.max(0, Math.min(23, Math.min(fromHour, toHour)))
  const end = Math.max(0, Math.min(23, Math.max(fromHour, toHour)))
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

export function isHourSpan(hours: number[]): boolean {
  if (hours.length < 2) return false
  const sorted = [...hours].sort((left, right) => left - right)
  return sorted.every((hour, index) => index === 0 || hour === sorted[index - 1]! + 1)
}

export function formatLookupPeriod(from: string, to: string): string {
  const start = kstDateFromYmd(from)
  const end = kstDateFromYmd(to)
  if (from === to) {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(end)
  }
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Seoul',
    ...(sameYear ? {} : { year: 'numeric' }),
    month: 'numeric',
    day: 'numeric',
  }
  const startLabel = new Intl.DateTimeFormat('ko-KR', options).format(start)
  const endLabel = new Intl.DateTimeFormat('ko-KR', options).format(end)
  return `${startLabel} – ${endLabel}`
}

export function formatPeriodRange(from: Date, to: Date, period: 'daily' | 'weekly' | 'monthly'): string {
  const start = Number.isNaN(from.getTime()) ? new Date() : from
  const end = Number.isNaN(to.getTime()) ? new Date() : to
  if (period === 'daily') {
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(end)
  }
  if (period === 'weekly') {
    const startLabel = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(start)
    const endLabel = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(end)
    return `${startLabel} – ${endLabel}`
  }
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(end)
}
