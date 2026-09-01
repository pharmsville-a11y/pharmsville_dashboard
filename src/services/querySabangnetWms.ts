import { shareInflight } from '../lib/shareInflight'
import { formatKstYmd, remainingDaysFromExpire } from '../lib/kst'
import { sabangnetQueryUrl } from './querySabangnet'

export interface SabangnetWmsLocation {
  id: string
  name: string
  locType: string
  locTypeName: string
  temperature: string
  status: string
  cbm: number
}

export interface SabangnetWmsProduct {
  id: string
  code: string
  name: string
  upc: string
  status: string
  statusName: string
  useExpireDate: boolean
  locationId: string
  locationQuantity: number
}

export interface SabangnetWmsSalesProduct {
  id: string
  code: string
  name: string
  status: string
  statusName: string
  linked: boolean
}

export interface SabangnetWmsStock {
  id: string
  code: string
  name: string
  locationId: string
  locationName: string
  expireDate: string | null
  remainingDays: number | null
  qty: number
  total: number
  available: number
  receiving: number
  ordered: number
  shipping: number
  damaged: number
  returned: number
  keeping: number
}

export interface SabangnetWmsFlow {
  kind: string
  id: string
  code: string
  name: string
  status: string
  date: string | null
  qty: number
}

export interface SabangnetWmsSnapshot {
  capturedAt: string | null
  from: string | null
  to: string | null
  summary: {
    locations: number
    products: number
    salesProducts: number
    sku: number
    qty: number
    available: number
    receiving: number
    damaged: number
    returned: number
    orders: number
    receivingPlans: number
    receivingWorks: number
    releases: number
    returns: number
  }
  locations: SabangnetWmsLocation[]
  products: SabangnetWmsProduct[]
  salesProducts: SabangnetWmsSalesProduct[]
  stock: SabangnetWmsStock[]
  flow: SabangnetWmsFlow[]
  notes: string[]
  error: string | null
}

function envValue(value: string | undefined): string {
  return (value ?? '').trim().replace(/^['"]|['"]$/g, '')
}

export function sabangnetWmsQueryUrl(): string {
  const sabang = sabangnetQueryUrl()
  if (sabang.includes('query-sabangnet')) return sabang.replace('query-sabangnet', 'query-sabangnet-wms')
  const ads = envValue(import.meta.env.VITE_QUERY_URL)
  if (ads.includes('query-ads')) return ads.replace('query-ads', 'query-sabangnet-wms')
  return ''
}

export function isSabangnetWmsConfigured(): boolean {
  return Boolean(sabangnetWmsQueryUrl())
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

export async function fetchSabangnetWmsSnapshot(from?: string, to?: string): Promise<SabangnetWmsSnapshot> {
  const base = sabangnetWmsQueryUrl()
  if (!base) throw new Error('사방넷 창고 조회 URL이 설정되지 않았습니다.')

  const url = new URL(base, window.location.origin)
  if (from) url.searchParams.set('from', from)
  if (to) url.searchParams.set('to', to)
  const secret = envValue(import.meta.env.VITE_QUERY_SECRET)
  const headers: Record<string, string> = {}
  if (secret) {
    headers['x-query-secret'] = secret
    headers['x-collect-secret'] = secret
  }

  return shareInflight(`sabangnet-wms:${url.toString()}`, async () => {
    const response = await fetch(url, { method: 'GET', headers })
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) throw new Error(`조회 실패 (${response.status})`)

    const summaryRaw = (body.summary ?? {}) as Record<string, unknown>
    const notesRaw = Array.isArray(body.notes) ? body.notes : []
    const locationsRaw = Array.isArray(body.locations) ? body.locations : []
    const productsRaw = Array.isArray(body.products) ? body.products : []
    const salesRaw = Array.isArray(body.sales_products) ? body.sales_products : []
    const stockRaw = Array.isArray(body.stock) ? body.stock : []
    const flowRaw = Array.isArray(body.flow) ? body.flow : []
    const shippingCodes = new Set(productsRaw.map((row) => text((row as Record<string, unknown>).code)))

    return {
      capturedAt: body.captured_at ? text(body.captured_at) : null,
      from: body.from ? text(body.from) : from ?? null,
      to: body.to ? text(body.to) : to ?? null,
      summary: {
        locations: num(summaryRaw.locations),
        products: num(summaryRaw.products),
        salesProducts: num(summaryRaw.salesProducts),
        sku: num(summaryRaw.sku),
        qty: num(summaryRaw.qty),
        available: num(summaryRaw.available),
        receiving: num(summaryRaw.receiving),
        damaged: num(summaryRaw.damaged),
        returned: num(summaryRaw.returned),
        orders: num(summaryRaw.orders),
        receivingPlans: num(summaryRaw.receivingPlans),
        receivingWorks: num(summaryRaw.receivingWorks),
        releases: num(summaryRaw.releases),
        returns: num(summaryRaw.returns),
      },
      locations: locationsRaw.map((row) => {
        const item = (row ?? {}) as Record<string, unknown>
        return {
          id: text(item.id),
          name: text(item.name) || text(item.id) || '—',
          locType: text(item.locType),
          locTypeName: text(item.locTypeName) || '—',
          temperature: text(item.temperature),
          status: text(item.status),
          cbm: num(item.cbm),
        }
      }),
      products: productsRaw.map((row) => {
        const item = (row ?? {}) as Record<string, unknown>
        return {
          id: text(item.id),
          code: text(item.code),
          name: text(item.name) || text(item.code) || '—',
          upc: text(item.upc),
          status: text(item.status),
          statusName: text(item.statusName) || '—',
          useExpireDate: Boolean(item.useExpireDate),
          locationId: text(item.locationId),
          locationQuantity: num(item.locationQuantity),
        }
      }),
      salesProducts: salesRaw.map((row) => {
        const item = (row ?? {}) as Record<string, unknown>
        const code = text(item.code)
        return {
          id: text(item.id),
          code,
          name: text(item.name) || code || '—',
          status: text(item.status),
          statusName: text(item.statusName) || '—',
          linked: shippingCodes.has(code),
        }
      }),
      stock: stockRaw.map((row) => {
        const item = (row ?? {}) as Record<string, unknown>
        const expireDate = item.expireDate ? formatKstYmd(item.expireDate) || null : null
        return {
          id: text(item.id),
          code: text(item.code),
          name: text(item.name) || text(item.code) || '—',
          locationId: text(item.locationId),
          locationName: text(item.locationName),
          expireDate,
          remainingDays: remainingDaysFromExpire(expireDate),
          qty: num(item.qty),
          total: num(item.total),
          available: num(item.available),
          receiving: num(item.receiving),
          ordered: num(item.ordered),
          shipping: num(item.shipping),
          damaged: num(item.damaged),
          returned: num(item.returned),
          keeping: num(item.keeping),
        }
      }),
      flow: flowRaw.map((row) => {
        const item = (row ?? {}) as Record<string, unknown>
        return {
          kind: text(item.kind) || '기타',
          id: text(item.id),
          code: text(item.code),
          name: text(item.name),
          status: text(item.status),
          date: item.date ? text(item.date) : null,
          qty: num(item.qty),
        }
      }),
      notes: notesRaw.map((item) => text(item)).filter(Boolean),
      error: body.error ? text(body.error) : body.ok === false ? text(body.message) || '조회 실패' : null,
    }
  })
}
