export type SabangnetOrderTimeSource = 'ORDER_DT' | 'SHOP_ORD_NO' | 'COLLECT_DT'

export type SabangnetOrderTime = {
  ymd: string
  hour: number
  minute: number
  second: number
  source: SabangnetOrderTimeSource
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function validHms(hour: number, minute: number, second: number): boolean {
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59
}

function partsFromDigits(digits: string): Omit<SabangnetOrderTime, 'source'> | null {
  if (digits.length < 8) return null
  const ymd = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  if (digits.length < 10) return { ymd, hour: 0, minute: 0, second: 0 }
  const hour = Number(digits.slice(8, 10))
  const minute = digits.length >= 12 ? Number(digits.slice(10, 12)) : 0
  const second = digits.length >= 14 ? Number(digits.slice(12, 14)) : 0
  if (!validHms(hour, minute, second)) return null
  return { ymd, hour, minute, second }
}

function partsFromField(value: unknown): Omit<SabangnetOrderTime, 'source'> | null {
  const raw = text(value)
  if (!raw) return null
  return partsFromDigits(raw.replace(/\D/g, ''))
}

function isOrderDtTimeBlank(value: unknown): boolean {
  const digits = text(value).replace(/\D/g, '')
  if (digits.length < 10) return true
  if (digits.length >= 14) return digits.slice(8, 14) === '000000'
  return Number(digits.slice(8, 10)) === 0
}

function inferFrom14DigitPrefix(prefix: string): Omit<SabangnetOrderTime, 'source'> | null {
  return partsFromDigits(prefix.slice(0, 14))
}

function inferFromSamsungShopOrdNo(shopOrdNo: string): Omit<SabangnetOrderTime, 'source'> | null {
  const match = shopOrdNo.match(/^BA(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/i)
  if (!match) return null
  const [, yy, month, day, hour, minute, second] = match
  return partsFromDigits(`20${yy}${month}${day}${hour}${minute}${second}`)
}

export function inferSabangnetTimeFromShopOrdNo(
  shopNm: string,
  shopOrdNo: string,
): Omit<SabangnetOrderTime, 'source'> | null {
  const shop = text(shopNm).toLowerCase()
  const no = text(shopOrdNo)
  if (!shop || !no) return null

  if (shop.includes('cj온스타일') || shop.includes('cjonstyle')) {
    const prefix = no.match(/^(\d{14})/)?.[1]
    if (prefix) return inferFrom14DigitPrefix(prefix)
  }

  if (shop.includes('삼성카드') || shop.includes('samsungcard')) {
    return inferFromSamsungShopOrdNo(no)
  }

  if (shop.includes('makeshop') || shop.includes('메이크샵')) {
    const prefix = no.match(/^(\d{14})-/)?.[1]
    if (prefix) return inferFrom14DigitPrefix(prefix)
  }

  return null
}

export function resolveSabangnetOrderTime(row: Record<string, unknown>): SabangnetOrderTime | null {
  const fromOrder = partsFromField(row.ORDER_DT)

  if (fromOrder && !isOrderDtTimeBlank(row.ORDER_DT)) {
    return { ...fromOrder, source: 'ORDER_DT' }
  }

  const inferred = inferSabangnetTimeFromShopOrdNo(text(row.SHOP_NM), text(row.SHOP_ORD_NO))
  if (inferred) {
    const orderYmd = fromOrder?.ymd ?? partsFromField(row.ORDER_DT)?.ymd
    if (!orderYmd || inferred.ymd === orderYmd) {
      return { ...inferred, source: 'SHOP_ORD_NO' }
    }
  }

  if (fromOrder) return { ...fromOrder, source: 'ORDER_DT' }

  const fromCollect = partsFromField(row.COLLECT_DT)
  if (fromCollect) return { ...fromCollect, source: 'COLLECT_DT' }

  return null
}

export function formatSabangnetDateTimeValue(value: unknown): string {
  const parts = partsFromField(value)
  if (!parts) return text(value) || '—'
  const hh = String(parts.hour).padStart(2, '0')
  const mm = String(parts.minute).padStart(2, '0')
  const ss = String(parts.second).padStart(2, '0')
  return `${parts.ymd} ${hh}:${mm}:${ss}`
}

export function formatSabangnetOrderDt(row: Record<string, unknown>): string {
  return formatSabangnetDateTimeValue(row.ORDER_DT)
}

export function formatSabangnetInferredOrderTime(row: Record<string, unknown>): string {
  const resolved = resolveSabangnetOrderTime(row)
  if (!resolved || resolved.source !== 'SHOP_ORD_NO') return '—'
  const hh = String(resolved.hour).padStart(2, '0')
  const mm = String(resolved.minute).padStart(2, '0')
  const ss = String(resolved.second).padStart(2, '0')
  return `${resolved.ymd} ${hh}:${mm}:${ss}`
}

export function formatSabangnetOrderTime(row: Record<string, unknown>): string {
  const resolved = resolveSabangnetOrderTime(row)
  if (!resolved) return text(row.ORDER_DT) || text(row.COLLECT_DT) || '—'
  const hh = String(resolved.hour).padStart(2, '0')
  const mm = String(resolved.minute).padStart(2, '0')
  const ss = String(resolved.second).padStart(2, '0')
  return `${resolved.ymd} ${hh}:${mm}:${ss}`
}

export function sabangnetOrderTimeSourceLabel(source: SabangnetOrderTimeSource): string {
  if (source === 'SHOP_ORD_NO') return 'SHOP_ORD_NO 추정'
  if (source === 'COLLECT_DT') return 'COLLECT_DT'
  return 'ORDER_DT'
}
