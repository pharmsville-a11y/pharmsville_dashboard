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

/** 날짜를 한국 기준 YYYY-MM-DD 로. Date/ISO/영문 시각 문자열도 처리. */
export function formatKstYmd(value: unknown): string {
  if (value == null || value === '') return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value)
  }
  const raw = String(value).trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const extracted = parseYmd(raw)
  if (extracted) return extracted
  const compact = raw.replace(/\D/g, '')
  if (/^\d{8}$/.test(compact) && !/[A-Za-z]/.test(raw)) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
  }
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed)
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

/** 유통기한까지 남은 일수. 오늘 기준 KST. 만료 시 음수. */
export function remainingDaysFromExpire(expire: string | null | undefined, today = kstYmd()): number | null {
  const ymd = expire ? parseYmd(expire) ?? (formatKstYmd(expire) || null) : null
  if (!ymd) return null
  return kstDaysBetween(today, ymd)
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

/** 매시 collect 완료 시각(:02 daily, :05 pluscl) 이후까지 남은 ms. */
export function msUntilNextKstCollect(
  date = new Date(),
  minute = 5,
  extraMs = 0,
): number {
  const kst = kstWallClock(date)
  const next = new Date(kst.getTime())
  next.setSeconds(0, 0)
  next.setMinutes(minute)
  let target = next.getTime() + extraMs
  if (kst.getTime() >= target) {
    next.setHours(next.getHours() + 1)
    target = next.getTime() + extraMs
  }
  return Math.max(250, target - kst.getTime())
}

/** 이번 시 수집(:05 + grace)이 끝났는지. */
export function isPastKstCollect(
  date = new Date(),
  minute = 5,
  graceMs = 0,
): boolean {
  const kst = kstWallClock(date)
  const elapsed =
    kst.getMinutes() * 60_000 + kst.getSeconds() * 1000 + kst.getMilliseconds()
  return elapsed >= minute * 60_000 + graceMs
}

export function kstIsoAt(ymd: string, hour: number): string {
  const normalized = parseYmd(ymd)
  const safeHour = Math.min(23, Math.max(0, Math.round(hour)))
  if (!normalized) return new Date().toISOString()
  const date = new Date(`${normalized}T${String(safeHour).padStart(2, '0')}:00:00+09:00`)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}
