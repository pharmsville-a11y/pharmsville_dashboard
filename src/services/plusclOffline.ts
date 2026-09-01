import type { PlusclOrderLine, PlusclSnapshot } from './queryPluscl'

const EXCLUDE_NEEDLES = ['사방넷_apple6', '사방넷apple6', 'cj직배', '자사주문']
const HIDE_NEEDLES = ['샘플_팜스빌']

function matchesNeedles(name: string, code: string, needles: string[]): boolean {
  const hay = `${name} ${code}`.replace(/\s+/g, '').toLowerCase()
  return needles.some((needle) => hay.includes(needle.replace(/_/g, '')) || hay.includes(needle))
}

export function isHiddenPlusclCompany(name: string, code = ''): boolean {
  return matchesNeedles(name, code, HIDE_NEEDLES)
}

export function isExcludedPlusclCompany(name: string, code = ''): boolean {
  return isHiddenPlusclCompany(name, code) || matchesNeedles(name, code, EXCLUDE_NEEDLES)
}

export function plusclChannelId(name: string): string {
  const slug = name.trim().replace(/\s+/g, '_') || 'offline'
  return `pluscl_${slug}`
}

const TICKER_ALIASES: Array<[string, string]> = [
  ['코스트코', 'COSTCO'],
  ['메가마트', 'MEGA'],
  ['와몰', 'WA'],
  ['더블유쇼핑', 'WSHOP'],
  ['현대홈쇼핑', 'HSH'],
  ['이메딕팜넷', 'EMEDIC'],
  ['이김엔터', 'EGIM'],
  ['개성상인', 'GAESEONG'],
  ['수양버들', 'SUYANG'],
  ['쿨시스템', 'COOL'],
  ['비브로', 'VIVRO'],
  ['보건소', 'PHARM'],
  ['농협', 'NH'],
  ['한진', 'HANJIN'],
  ['계룡스파', 'SPA'],
  ['계룡대', 'KMA'],
  ['상무대', 'SANGMU'],
  ['창원대', 'CWNU'],
]

const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
const JUNG = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i',
]
const JONG = [
  '', 'k', 'k', 'ks', 'n', 'nj', 'nh', 't', 'l', 'lk', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'p', 'ps', 't', 't', 'ng', 't', 't', 't',
]

function romanizeHangul(input: string): string {
  let out = ''
  for (const char of input) {
    const code = char.codePointAt(0) ?? 0
    if (code >= 0xac00 && code <= 0xd7a3) {
      const syllable = code - 0xac00
      out += CHO[Math.floor(syllable / 588)] + JUNG[Math.floor((syllable % 588) / 28)] + JONG[syllable % 28]
      continue
    }
    if (/[a-zA-Z0-9]/.test(char)) out += char
  }
  return out
}

export function plusclTicker(name: string): string {
  const compact = name.replace(/\(주\)/g, '').replace(/\s+/g, '')
  for (const [needle, ticker] of TICKER_ALIASES) {
    if (compact.includes(needle)) return ticker
  }
  const roman = romanizeHangul(compact).toUpperCase()
  if (roman.length >= 3) return roman.slice(0, 6)
  const latin = compact.replace(/[^A-Za-z0-9]/g, '')
  if (latin) return latin.slice(0, 6).toUpperCase()
  return 'OFFL'
}

export function plusclSalesOrders(orders: PlusclOrderLine[]): PlusclOrderLine[] {
  return orders.filter(
    (row) => row.reportType === 'order' && !isExcludedPlusclCompany(row.ordCompName, row.ordCompCode),
  )
}

export function plusclOrderToSalesRow(row: PlusclOrderLine): Record<string, unknown> {
  return {
    ORDER_DT: row.eventAt || `${row.ordDate} 00:00:00`,
    ORDER_STATUS: '오프라인',
    SHOP_NM: row.ordCompName || row.ordCompCode || '오프라인',
    SB_ORD_NO: '',
    SHOP_ORD_NO: row.ordNo1,
    GOODS_NM: row.itemName || row.itemCode,
    ITEM_NM: row.optionName,
    ORD_CNT: row.qty,
    PAY_TOT_AMT: row.amount,
    SOURCE: 'pluscl',
  }
}

export function mergeSabangnetWithPluscl(
  sabangnet: {
    orderRows: number
    amount: number
    shops: Array<{ name: string; loginId: string; shmaId: string; count: number; amount: number }>
    rows: Record<string, unknown>[]
  } | null,
  pluscl: PlusclSnapshot | null,
) {
  const plusclRows = pluscl ? plusclSalesOrders(pluscl.orders).map(plusclOrderToSalesRow) : []
  const plusclAmount = plusclRows.reduce((sum, row) => sum + Number(row.PAY_TOT_AMT ?? 0), 0)
  const byShop = new Map<string, { name: string; loginId: string; shmaId: string; count: number; amount: number }>()

  for (const shop of sabangnet?.shops ?? []) {
    byShop.set(shop.name, { ...shop })
  }
  for (const row of plusclRows) {
    const name = String(row.SHOP_NM ?? '오프라인')
    const amount = Number(row.PAY_TOT_AMT ?? 0)
    const current = byShop.get(name) ?? { name, loginId: 'pluscl', shmaId: '', count: 0, amount: 0 }
    current.count += 1
    current.amount += Number.isFinite(amount) ? amount : 0
    byShop.set(name, current)
  }

  const shops = [...byShop.values()].sort((left, right) => right.amount - left.amount || right.count - left.count)
  const rows = [...(sabangnet?.rows ?? []), ...plusclRows]
  return {
    orderRows: (sabangnet?.orderRows ?? 0) + plusclRows.length,
    amount: (sabangnet?.amount ?? 0) + plusclAmount,
    shops,
    rows,
    plusclRows: plusclRows.length,
  }
}
