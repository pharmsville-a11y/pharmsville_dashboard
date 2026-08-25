export function kstYmd(date = new Date(), offsetDays = 0): string {
  const time = date.getTime()
  if (Number.isNaN(time)) return kstYmd(new Date(), offsetDays)

  const utc = time + date.getTimezoneOffset() * 60_000
  const kst = new Date(utc + 9 * 60 * 60 * 1000)
  kst.setDate(kst.getDate() + offsetDays)
  const year = kst.getFullYear()
  const month = String(kst.getMonth() + 1).padStart(2, '0')
  const day = String(kst.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseYmd(value: unknown): string | null {
  const match = String(value ?? '').match(/(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? null
}

export function kstDateFromYmd(ymd: string): Date {
  const normalized = parseYmd(ymd)
  if (!normalized) return new Date()
  const date = new Date(`${normalized}T12:00:00+09:00`)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

export function startOfKstWeek(ymd: string): string {
  const date = kstDateFromYmd(ymd)
  const weekday = date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1
  return kstYmd(date, -weekday)
}

export function startOfKstMonth(ymd: string): string {
  return ymdMonthStart(ymd)
}

export function ymdMonthStart(ymd: string): string {
  const normalized = parseYmd(ymd)
  if (!normalized) return `${kstYmd().slice(0, 7)}-01`
  return `${normalized.slice(0, 7)}-01`
}

export function shiftYmdMonth(ymd: string, delta: number): string {
  const start = ymdMonthStart(ymd)
  const year = Number(start.slice(0, 4))
  const month = Number(start.slice(5, 7))
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  const nextYear = date.getUTCFullYear()
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${nextYear}-${nextMonth}-01`
}

export function kstDaysBetween(from: string, to: string): number {
  const start = kstDateFromYmd(from).getTime()
  const end = kstDateFromYmd(to).getTime()
  return Math.round((end - start) / 86_400_000)
}

const KST: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Seoul' }

export function formatKstWeekday(date = new Date()): string {
  return new Intl.DateTimeFormat('ko-KR', {
    ...KST,
    weekday: 'long',
  }).format(date)
}

export function formatKstDate(date = new Date()): string {
  return new Intl.DateTimeFormat('ko-KR', {
    ...KST,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function formatKstClock(date = new Date()): string {
  return new Intl.DateTimeFormat('ko-KR', {
    ...KST,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function kstWallClock(date = new Date()): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60_000
  return new Date(utc + 9 * 60 * 60 * 1000)
}

export function kstHour(date = new Date()): number {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      ...KST,
      hour: '2-digit',
      hour12: false,
    }).format(date),
  )
  if (!Number.isFinite(hour)) return 0
  return Math.min(23, Math.max(0, hour === 24 ? 0 : hour))
}

export function kstHourStamp(date = new Date()): string {
  return `${kstYmd(date)}-${String(kstHour(date)).padStart(2, '0')}`
}

export function msUntilNextKstHour(date = new Date(), extraMs = 0): number {
  const kst = kstWallClock(date)
  const next = new Date(kst.getTime())
  next.setMinutes(0, 0, 0)
  next.setHours(next.getHours() + 1)
  return Math.max(250, next.getTime() - kst.getTime() + extraMs)
}

export function kstIsoAt(ymd: string, hour: number): string {
  const normalized = parseYmd(ymd)
  const safeHour = Math.min(23, Math.max(0, Math.round(hour)))
  if (!normalized) return new Date().toISOString()
  const date = new Date(`${normalized}T${String(safeHour).padStart(2, '0')}:00:00+09:00`)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}
