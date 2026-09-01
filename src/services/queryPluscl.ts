import { shareInflight } from '../lib/shareInflight'
import { formatKstYmd, remainingDaysFromExpire } from '../lib/kst'

export type PlusclCount = {
  lines: number
  qty: number
  amount: number
}

export interface PlusclSnapshot {
  from: string
  to: string
  capturedAt: string | null
  stockAsOf: { date: string; hour: number } | null
  summary: {
    orders: PlusclCount
    shipped: PlusclCount
    cancelled: PlusclCount
    exchanged: PlusclCount
    returned: PlusclCount
    unshipped: PlusclCount
    stockSku: number
    stockQty: number
    stockExpire: {
      within6m: PlusclCount
      within1y: PlusclCount
      unknown: PlusclCount
    }
    flow: { in_plan: number; out_plan: number; in_doc: number; out_doc: number }
  }
  channels: Array<{ name: string; lines: number; qty: number; amount: number }>
  channelDaily: Array<{ date: string; name: string; lines: number; qty: number; amount: number }>
  base: Array<{ kind: string; code: string; name: string; extra?: Record<string, unknown> }>
  orders: PlusclOrderLine[]
  stock: PlusclStockRow[]
  stockTrend?: Array<{ date: string; qty: number; lines: number }>
}

export interface PlusclOrderLine {
  reportType: string
  ordInnerSeq: number
  itemSeq: number
  ordDate: string
  ordCompCode: string
  ordCompName: string
  ordNo1: string
  itemCode: string
  itemName: string
  optionName: string
  qty: number
  amount: number
  farePrice: number
  invoiceNo: string
  eventAt: string | null
}

export interface PlusclStockRow {
  itemCode: string
  itemName: string
  optionName: string
  category1: string
  category2: string
  warehouse: string
  lotNo: string
  manufacturedOn: string | null
  expireDate: string | null
  remainingDays: number | null
  shelfLife: number
  shelfLifeUnit: string
  qty: number
  locations: number
}

function envValue(value: string | undefined): string {
  return (value ?? '').trim().replace(/^['"]|['"]$/g, '')
}

export function plusclQueryUrl(): string {
  const explicit = envValue(import.meta.env.VITE_PLUSCL_URL)
  if (explicit) return explicit
  const ads = envValue(import.meta.env.VITE_QUERY_URL)
  if (ads.includes('query-ads')) return ads.replace('query-ads', 'query-pluscl')
  return ''
}

export function isPlusclConfigured(): boolean {
  return Boolean(plusclQueryUrl())
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function countOf(raw: unknown): PlusclCount {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return { lines: num(row.lines), qty: num(row.qty), amount: num(row.amount) }
}

export async function fetchPlusclSnapshot(from: string, to: string): Promise<PlusclSnapshot> {
  const base = plusclQueryUrl()
  if (!base) throw new Error('PlusCL 조회 URL이 설정되지 않았습니다.')

  const url = new URL(base, window.location.origin)
  url.searchParams.set('from', from)
  url.searchParams.set('to', to)

  const secret = envValue(import.meta.env.VITE_QUERY_SECRET)
  const headers: Record<string, string> = {}
  if (secret) {
    headers['x-query-secret'] = secret
    headers['x-collect-secret'] = secret
  }

  return shareInflight(`pluscl:${url.toString()}`, async () => {
    const response = await fetch(url, { method: 'GET', headers })
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (!response.ok || !body?.ok) {
      throw new Error(text(body?.error) || `조회 실패 (${response.status})`)
    }

  const summary = (body.summary ?? {}) as Record<string, unknown>
  const flow = (summary.flow ?? {}) as Record<string, unknown>
  const stockExpire = (summary.stock_expire ?? {}) as Record<string, unknown>
  const stockAsOf = body.stock_as_of as { date?: string; hour?: number } | null

  return {
    from: text(body.from) || from,
    to: text(body.to) || to,
    capturedAt: body.captured_at ? text(body.captured_at) : null,
    stockAsOf: stockAsOf?.date
      ? { date: text(stockAsOf.date), hour: num(stockAsOf.hour) }
      : null,
    summary: {
      orders: countOf(summary.orders),
      shipped: countOf(summary.shipped),
      cancelled: countOf(summary.cancelled),
      exchanged: countOf(summary.exchanged),
      returned: countOf(summary.returned),
      unshipped: countOf(summary.unshipped),
      stockSku: num(summary.stock_sku),
      stockQty: num(summary.stock_qty),
      stockExpire: {
        within6m: countOf(stockExpire.within_6m),
        within1y: countOf(stockExpire.within_1y),
        unknown: countOf(stockExpire.unknown),
      },
      flow: {
        in_plan: num(flow.in_plan),
        out_plan: num(flow.out_plan),
        in_doc: num(flow.in_doc),
        out_doc: num(flow.out_doc),
      },
    },
    channels: Array.isArray(body.channels)
      ? body.channels.map((row) => {
          const item = (row ?? {}) as Record<string, unknown>
          return {
            name: text(item.name) || '기타',
            lines: num(item.lines),
            qty: num(item.qty),
            amount: num(item.amount),
          }
        })
      : [],
    channelDaily: Array.isArray(body.channel_daily)
      ? body.channel_daily.map((row) => {
          const item = (row ?? {}) as Record<string, unknown>
          return {
            date: text(item.date),
            name: text(item.name) || '기타',
            lines: num(item.lines),
            qty: num(item.qty),
            amount: num(item.amount),
          }
        })
      : [],
    base: Array.isArray(body.base)
      ? body.base.map((row) => {
          const item = (row ?? {}) as Record<string, unknown>
          return {
            kind: text(item.kind),
            code: text(item.code),
            name: text(item.name),
            extra: item.extra && typeof item.extra === 'object' ? (item.extra as Record<string, unknown>) : {},
          }
        })
      : [],
    orders: Array.isArray(body.orders)
      ? body.orders.map((row) => {
          const item = (row ?? {}) as Record<string, unknown>
          return {
            reportType: text(item.report_type),
            ordInnerSeq: num(item.ord_inner_seq),
            itemSeq: num(item.item_seq),
            ordDate: text(item.ord_date),
            ordCompCode: text(item.ord_comp_code),
            ordCompName: text(item.ord_comp_name),
            ordNo1: text(item.ord_no1),
            itemCode: text(item.item_code),
            itemName: text(item.item_name),
            optionName: text(item.option_name),
            qty: num(item.qty),
            amount: num(item.amount),
            farePrice: num(item.fare_price),
            invoiceNo: text(item.invoice_no),
            eventAt: item.event_at ? text(item.event_at) : null,
          }
        })
      : [],
    stock: Array.isArray(body.stock)
      ? body.stock.map((row) => {
          const item = (row ?? {}) as Record<string, unknown>
          const expireDate = item.expire_date ? formatKstYmd(item.expire_date) || null : null
          return {
            itemCode: text(item.item_code),
            itemName: text(item.item_name),
            optionName: text(item.option_name),
            category1: text(item.category_name1),
            category2: text(item.category_name2),
            warehouse: text(item.warehouse_code),
            lotNo: text(item.lot_no),
            manufacturedOn: item.manufactured_on ? formatKstYmd(item.manufactured_on) || null : null,
            expireDate,
            remainingDays: remainingDaysFromExpire(expireDate),
            shelfLife: num(item.shelf_life),
            shelfLifeUnit: text(item.shelf_life_unit),
            qty: num(item.qty),
            locations: num(item.locations),
          }
        })
      : [],
    stockTrend: Array.isArray(body.stock_trend)
      ? body.stock_trend.map((row) => {
          const item = (row ?? {}) as Record<string, unknown>
          return {
            date: text(item.date),
            qty: num(item.qty),
            lines: num(item.lines),
          }
        })
      : [],
  }
  })
}

export async function fetchPlusclOrEmpty(from: string, to: string): Promise<PlusclSnapshot | null> {
  if (!isPlusclConfigured()) return null
  try {
    return await fetchPlusclSnapshot(from, to)
  } catch {
    return null
  }
}

export function plusclCollectUrl(): string {
  const explicit = envValue(import.meta.env.VITE_PLUSCL_COLLECT_URL)
  if (explicit) return explicit
  const query = plusclQueryUrl()
  if (query.includes('query-pluscl')) return query.replace('query-pluscl', 'collect-pluscl')
  return '/functions/v1/collect-pluscl'
}

export interface PlusclCollectResult {
  ok: boolean
  notes: string[]
  error?: string
  [key: string]: unknown
}

export async function triggerPlusclCollect(stage = 'full'): Promise<PlusclCollectResult> {
  const base = plusclCollectUrl()
  if (!base) throw new Error('PlusCL 수집 URL이 설정되지 않았습니다.')

  const url = new URL(base, window.location.origin)
  url.searchParams.set('stage', stage)

  const secret = envValue(import.meta.env.VITE_QUERY_SECRET)
  const headers: Record<string, string> = {}
  if (secret) {
    headers['x-query-secret'] = secret
    headers['x-collect-secret'] = secret
  }

  const response = await fetch(url, { method: 'GET', headers })
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) throw new Error(`수집 실패 (${response.status})`)
  if (response.status === 401) {
    throw new Error(
      '수집 인증 실패(401). .env.local 의 COLLECT_SECRET 이 EC2 /opt/channelboard/.env 와 같은지 확인한 뒤 dev 서버를 재시작하세요.',
    )
  }
  if (!response.ok || body.error) {
    throw new Error(text(body.error) || `수집 실패 (${response.status})`)
  }

  const notes = Array.isArray(body.notes) ? body.notes.map((item) => text(item)).filter(Boolean) : []
  return {
    ...body,
    ok: body.ok !== false,
    notes,
  }
}
