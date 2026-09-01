import { kstDateFromYmd } from './kst'

export const WEEKDAYS_SUN_FIRST = ['일', '월', '화', '수', '목', '금', '토'] as const

function ymdOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 일요일 시작 달력 격자 (한국식). */
export function buildMonthCells(monthStart: string): Array<{ ymd: string; inMonth: boolean }> {
  const year = Number(monthStart.slice(0, 4))
  const month = Number(monthStart.slice(5, 7))
  const first = kstDateFromYmd(monthStart)
  const sundayIndex = first.getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const prevDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate()
  const cells: Array<{ ymd: string; inMonth: boolean }> = []

  for (let i = sundayIndex; i > 0; i -= 1) {
    const day = prevDays - i + 1
    const prev = month === 1 ? ymdOf(year - 1, 12, day) : ymdOf(year, month - 1, day)
    cells.push({ ymd: prev, inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ ymd: ymdOf(year, month, day), inMonth: true })
  }
  let nextDay = 1
  while (cells.length % 7 !== 0) {
    const next = month === 12 ? ymdOf(year + 1, 1, nextDay) : ymdOf(year, month + 1, nextDay)
    cells.push({ ymd: next, inMonth: false })
    nextDay += 1
  }
  return cells
}

export function isSundayYmd(ymd: string): boolean {
  return kstDateFromYmd(ymd).getUTCDay() === 0
}
