/** 한국 공휴일 (양력 고정 + 연도별 음력·대체). 달력 표시용. */
const FIXED: Array<{ mmdd: string; name: string }> = [
  { mmdd: '01-01', name: '신정' },
  { mmdd: '03-01', name: '삼일절' },
  { mmdd: '05-05', name: '어린이날' },
  { mmdd: '06-06', name: '현충일' },
  { mmdd: '08-15', name: '광복절' },
  { mmdd: '10-03', name: '개천절' },
  { mmdd: '10-09', name: '한글날' },
  { mmdd: '12-25', name: '성탄절' },
]

/** 연도별 설·추석·부처님오신날·대체공휴일 */
const BY_YEAR: Record<string, Array<{ ymd: string; name: string }>> = {
  '2024': [
    { ymd: '2024-02-09', name: '설날 연휴' },
    { ymd: '2024-02-10', name: '설날' },
    { ymd: '2024-02-11', name: '설날 연휴' },
    { ymd: '2024-02-12', name: '대체공휴일' },
    { ymd: '2024-05-15', name: '부처님오신날' },
    { ymd: '2024-09-16', name: '추석 연휴' },
    { ymd: '2024-09-17', name: '추석' },
    { ymd: '2024-09-18', name: '추석 연휴' },
  ],
  '2025': [
    { ymd: '2025-01-28', name: '설날 연휴' },
    { ymd: '2025-01-29', name: '설날' },
    { ymd: '2025-01-30', name: '설날 연휴' },
    { ymd: '2025-03-03', name: '대체공휴일' },
    { ymd: '2025-05-05', name: '어린이날·부처님오신날' },
    { ymd: '2025-05-06', name: '대체공휴일' },
    { ymd: '2025-10-05', name: '추석 연휴' },
    { ymd: '2025-10-06', name: '추석' },
    { ymd: '2025-10-07', name: '추석 연휴' },
    { ymd: '2025-10-08', name: '대체공휴일' },
  ],
  '2026': [
    { ymd: '2026-02-16', name: '설날 연휴' },
    { ymd: '2026-02-17', name: '설날' },
    { ymd: '2026-02-18', name: '설날 연휴' },
    { ymd: '2026-05-24', name: '부처님오신날' },
    { ymd: '2026-09-24', name: '추석 연휴' },
    { ymd: '2026-09-25', name: '추석' },
    { ymd: '2026-09-26', name: '추석 연휴' },
  ],
  '2027': [
    { ymd: '2027-02-06', name: '설날 연휴' },
    { ymd: '2027-02-07', name: '설날' },
    { ymd: '2027-02-08', name: '설날 연휴' },
    { ymd: '2027-02-09', name: '대체공휴일' },
    { ymd: '2027-05-13', name: '부처님오신날' },
    { ymd: '2027-09-14', name: '추석 연휴' },
    { ymd: '2027-09-15', name: '추석' },
    { ymd: '2027-09-16', name: '추석 연휴' },
  ],
  '2028': [
    { ymd: '2028-01-26', name: '설날 연휴' },
    { ymd: '2028-01-27', name: '설날' },
    { ymd: '2028-01-28', name: '설날 연휴' },
    { ymd: '2028-05-02', name: '부처님오신날' },
    { ymd: '2028-10-02', name: '추석 연휴' },
    { ymd: '2028-10-03', name: '추석' },
    { ymd: '2028-10-04', name: '추석 연휴' },
    { ymd: '2028-10-05', name: '대체공휴일' },
  ],
}

const holidayMap = new Map<string, string>()

for (const year of Object.keys(BY_YEAR)) {
  for (const { ymd, name } of BY_YEAR[year] ?? []) {
    holidayMap.set(ymd, name)
  }
}

for (let year = 2020; year <= 2032; year += 1) {
  for (const { mmdd, name } of FIXED) {
    const ymd = `${year}-${mmdd}`
    if (!holidayMap.has(ymd)) holidayMap.set(ymd, name)
  }
}

export function krPublicHolidayName(ymd: string): string | null {
  return holidayMap.get(ymd) ?? null
}

export function isKrPublicHoliday(ymd: string): boolean {
  return holidayMap.has(ymd)
}
