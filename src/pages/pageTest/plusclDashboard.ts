import { kstDateFromYmd, kstYmd } from '../../lib/kst'
import { isExcludedPlusclCompany, plusclChannelId, plusclSalesOrders } from '../../services/plusclOffline'
import type { PlusclSnapshot, PlusclStockRow } from '../../services/queryPluscl'
import { filterVisibleStock, isHiddenStockRow } from '../../stock/hiddenStock'
import { resolveStockBrand } from '../../stock/brands'
import { buildPageTestGridRows, type PageTestGridRow } from './gridRows'

export type AlertLevel = 'warning' | 'caution'

export type AlertIssue = {
  id: string
  level: AlertLevel
  text: string
  at: string
  detail: string
}

export type InventoryTrendRow = {
  date: string
  amount: number
  qty: number
}

export type SalesCategory = {
  id: string
  name: string
  sales: number
  share: number
  color: string
}

export type SalesDrillRow = {
  sku: string
  name: string
  sales: number
  qty: number
  share: number
}

export type InventoryKpi = {
  title: string
  achievementPct: number
  sellThroughDays: number
  remainingDays: number
  tone: 'danger' | 'warn'
}

export type PageTestDashboard = {
  sales: {
    amount: number
    momPct: number
    dodPct: number
    sparkline: number[]
  }
  inventory6m: InventoryKpi
  inventory12m: InventoryKpi
  alerts: {
    warningCount: number
    cautionCount: number
    issues: AlertIssue[]
  }
  inventoryTrend: InventoryTrendRow[]
  salesTop5: SalesCategory[]
  salesDrilldown: Record<string, SalesDrillRow[]>
  gridRows: PageTestGridRow[]
  capturedAt: string | null
}

const CHART_COLORS = ['#6c5ce7', '#00b894', '#0984e3', '#fdcb6e', '#e17055', '#a29bfe', '#55efc4']

function visibleStock(stock: PlusclStockRow[]): PlusclStockRow[] {
  return filterVisibleStock(stock)
}

function pctChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0
  return Number((((current - previous) / previous) * 100).toFixed(2))
}

function sumDailyAmount(snapshot: PlusclSnapshot, from: string, to: string): number {
  let total = 0
  for (const row of snapshot.channelDaily) {
    if (row.date < from || row.date > to) continue
    if (isExcludedPlusclCompany(row.name)) continue
    total += row.amount
  }
  return total
}

function dailyTotals(snapshot: PlusclSnapshot, days: string[]): number[] {
  return days.map((day) => sumDailyAmount(snapshot, day, day))
}

function avgUnitPrice(snapshot: PlusclSnapshot): number {
  const orders = plusclSalesOrders(snapshot.orders)
  let amount = 0
  let qty = 0
  for (const row of orders) {
    amount += row.amount
    qty += row.qty
  }
  return qty > 0 ? amount / qty : 0
}

function buildSalesKpi(snapshot: PlusclSnapshot): PageTestDashboard['sales'] {
  const today = kstYmd()
  const yesterday = kstYmd(undefined, -1)
  const sparkDays = Array.from({ length: 7 }, (_, index) => kstYmd(undefined, -(6 - index)))

  const amount = sumDailyAmount(snapshot, today, today)
  const dodPct = pctChange(amount, sumDailyAmount(snapshot, yesterday, yesterday))

  const monthStart = `${today.slice(0, 8)}01`
  const prevMonthEnd = kstYmd(kstDateFromYmd(monthStart), -1)
  const prevMonthStart = `${prevMonthEnd.slice(0, 8)}01`
  const dayOfMonth = Number(today.slice(8, 10))
  const prevMonthSameDay = `${prevMonthEnd.slice(0, 8)}${String(Math.min(dayOfMonth, Number(prevMonthEnd.slice(8, 10)))).padStart(2, '0')}`

  const mtd = sumDailyAmount(snapshot, monthStart, today)
  const prevMtd = sumDailyAmount(snapshot, prevMonthStart, prevMonthSameDay)
  const momPct = pctChange(mtd, prevMtd)

  return {
    amount,
    momPct,
    dodPct,
    sparkline: dailyTotals(snapshot, sparkDays),
  }
}

function buildInventoryKpi(
  stock: PlusclStockRow[],
  thresholdDays: number,
  title: string,
  tone: 'danger' | 'warn',
): InventoryKpi {
  const rows = visibleStock(stock)
  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0)
  const bucket = rows.filter((row) => row.remainingDays != null && row.remainingDays <= thresholdDays)
  const bucketQty = bucket.reduce((sum, row) => sum + row.qty, 0)
  const achievementPct =
    totalQty > 0 ? Math.round(Math.max(0, Math.min(100, 100 - (bucketQty / totalQty) * 100))) : 100

  const remainingDays =
    bucketQty > 0
      ? Math.round(bucket.reduce((sum, row) => sum + (row.remainingDays ?? 0) * row.qty, 0) / bucketQty)
      : thresholdDays

  return {
    title,
    achievementPct,
    sellThroughDays: thresholdDays,
    remainingDays,
    tone,
  }
}

function formatAlertAt(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`
}

function buildAlerts(stock: PlusclStockRow[], snapshot: PlusclSnapshot): PageTestDashboard['alerts'] {
  const issues: AlertIssue[] = []
  const rows = visibleStock(stock)
    .filter((row) => row.remainingDays != null)
    .sort((left, right) => (left.remainingDays ?? 999) - (right.remainingDays ?? 999))

  for (const row of rows) {
    const days = row.remainingDays ?? 999
    if (days > 30) continue
    const level: AlertLevel = days <= 7 ? 'warning' : 'caution'
    const brand = resolveStockBrand(row).name
    const text =
      days <= 0
        ? `[${brand}] ${row.itemName} 유통기한 만료 (${row.qty}개)`
        : `[${brand}] ${row.itemName} 유통기한 ${days}일 남음 (${row.qty}개)`
    issues.push({
      id: `${row.itemCode}-${row.lotNo}-${row.expireDate ?? 'na'}`,
      level,
      text,
      at: formatAlertAt(snapshot.capturedAt),
      detail: `${row.itemName} ${row.optionName || ''} · LOT ${row.lotNo || '—'} · 유통기한 ${row.expireDate || '—'} · 재고 ${row.qty}개 · 창고 ${row.warehouse || '—'}`,
    })
  }

  const unshipped = snapshot.summary.unshipped
  if (unshipped.lines > 0) {
    issues.unshift({
      id: 'unshipped',
      level: unshipped.lines >= 50 ? 'warning' : 'caution',
      text: `미출고 주문 ${unshipped.lines}건 · ${unshipped.qty}개 · ${Math.round(unshipped.amount).toLocaleString('ko-KR')}원`,
      at: formatAlertAt(snapshot.capturedAt),
      detail: `PlusCL 미출고(noout) ${unshipped.lines}건, 수량 ${unshipped.qty}개, 금액 ${Math.round(unshipped.amount).toLocaleString('ko-KR')}원입니다.`,
    })
  }

  const warningCount = issues.filter((issue) => issue.level === 'warning').length
  const cautionCount = issues.filter((issue) => issue.level === 'caution').length

  return {
    warningCount,
    cautionCount,
    issues: issues.slice(0, 12),
  }
}

function buildInventoryTrend(snapshot: PlusclSnapshot, unitPrice: number): InventoryTrendRow[] {
  const trend = snapshot.stockTrend ?? []
  if (trend.length > 0) {
    return trend.map((row) => ({
      date: row.date.slice(5),
      amount: Math.round(row.qty * unitPrice),
      qty: row.qty,
    }))
  }

  const qty = visibleStock(snapshot.stock).reduce((sum, row) => sum + row.qty, 0)
  const amount = Math.round(qty * unitPrice)
  const today = kstYmd()
  return Array.from({ length: 7 }, (_, index) => {
    const date = kstYmd(undefined, -(6 - index))
    return { date: date.slice(5), amount, qty }
  }).filter((row) => row.date <= today.slice(5))
}

function buildSalesTop(snapshot: PlusclSnapshot): {
  salesTop5: SalesCategory[]
  salesDrilldown: Record<string, SalesDrillRow[]>
} {
  const from = kstYmd(undefined, -29)
  const to = kstYmd()
  const byChannel = new Map<string, number>()

  for (const row of snapshot.channelDaily) {
    if (row.date < from || row.date > to) continue
    if (isExcludedPlusclCompany(row.name)) continue
    byChannel.set(row.name, (byChannel.get(row.name) ?? 0) + row.amount)
  }

  const total = [...byChannel.values()].reduce((sum, value) => sum + value, 0)
  const top = [...byChannel.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)

  const salesTop5: SalesCategory[] = top.map(([name, sales], index) => ({
    id: plusclChannelId(name),
    name,
    sales,
    share: total > 0 ? (sales / total) * 100 : 0,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }))

  const salesDrilldown: Record<string, SalesDrillRow[]> = {}
  const orders = plusclSalesOrders(snapshot.orders)
    .filter((row) => row.ordDate >= from && row.ordDate <= to)
    .filter((row) => !isHiddenStockRow({ itemCode: row.itemCode, itemName: row.itemName, optionName: row.optionName }))

  for (const category of salesTop5) {
    const channelOrders = orders.filter((row) => plusclChannelId(row.ordCompName || row.ordCompCode) === category.id)
    const bySku = new Map<string, SalesDrillRow>()
    for (const row of channelOrders) {
      const key = row.itemCode || row.itemName
      const current = bySku.get(key) ?? {
        sku: row.itemCode || '—',
        name: row.itemName || row.itemCode,
        sales: 0,
        qty: 0,
        share: 0,
      }
      current.sales += row.amount
      current.qty += row.qty
      bySku.set(key, current)
    }
    const rows = [...bySku.values()].sort((left, right) => right.sales - left.sales).slice(0, 10)
    const channelTotal = rows.reduce((sum, row) => sum + row.sales, 0)
    salesDrilldown[category.id] = rows.map((row) => ({
      ...row,
      share: channelTotal > 0 ? (row.sales / channelTotal) * 100 : 0,
    }))
  }

  return { salesTop5, salesDrilldown }
}

export function buildPageTestDashboard(snapshot: PlusclSnapshot): PageTestDashboard {
  const stock = visibleStock(snapshot.stock)
  const unitPrice = avgUnitPrice(snapshot)
  const { salesTop5, salesDrilldown } = buildSalesTop(snapshot)

  return {
    sales: buildSalesKpi(snapshot),
    inventory6m: buildInventoryKpi(stock, 183, '6개월 이하 악성재고', 'danger'),
    inventory12m: buildInventoryKpi(stock, 365, '12개월 이하 악성재고', 'warn'),
    alerts: buildAlerts(snapshot.stock, snapshot),
    inventoryTrend: buildInventoryTrend(snapshot, unitPrice),
    salesTop5,
    salesDrilldown,
    gridRows: buildPageTestGridRows(snapshot),
    capturedAt: snapshot.capturedAt,
  }
}

export function pageTestFetchRange(): { from: string; to: string } {
  const to = kstYmd()
  const from = kstYmd(undefined, -62)
  return { from, to }
}
