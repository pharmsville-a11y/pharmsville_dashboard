import { shareInflight } from '../lib/shareInflight'

export interface SabangnetShop {
  name: string
  loginId: string
  shmaId: string
  count: number
  amount: number
}

export interface SabangnetProbe {
  kind?: string
  condition?: number
  path?: string
  method?: string
  http?: number
  error?: string | null
  count?: number
  hasNext?: boolean
  row_keys?: string[]
  keys?: string[]
  sample_status?: string | null
  sample_shop?: string | null
  code?: unknown
  message?: unknown
}

export interface SabangnetSnapshot {
  from: string
  to: string
  condition: number
  orderRows: number
  returnedRows: number
  amount: number
  fieldKeys: string[]
  statusCounts: Record<string, number>
  shops: SabangnetShop[]
  notes: string[]
  error: string | null
  rows: Record<string, unknown>[]
  probes: SabangnetProbe[]
}

function envValue(value: string | undefined): string {
  return (value ?? '').trim().replace(/^['"]|['"]$/g, '')
}

export function sabangnetQueryUrl(): string {
  const explicit = envValue(import.meta.env.VITE_SABANGNET_URL)
  if (explicit) return explicit
  const ads = envValue(import.meta.env.VITE_QUERY_URL)
  if (ads.includes('query-ads')) return ads.replace('query-ads', 'query-sabangnet')
  if (ads) return ads.replace(/query-ads\/?$/, 'query-sabangnet')
  return '/functions/v1/query-sabangnet'
}

export function isSabangnetConfigured(): boolean {
  return Boolean(sabangnetQueryUrl())
}

export function sabangnetCollectUrl(): string {
  const explicit = envValue(import.meta.env.VITE_SABANGNET_COLLECT_URL)
  if (explicit) return explicit
  const query = sabangnetQueryUrl()
  if (query.includes('query-sabangnet')) return query.replace('query-sabangnet', 'collect-sabangnet')
  return '/functions/v1/collect-sabangnet'
}

function authHeaders(): Record<string, string> {
  const secret = envValue(import.meta.env.VITE_QUERY_SECRET)
  const headers: Record<string, string> = {}
  if (secret) {
    headers['x-query-secret'] = secret
    headers['x-collect-secret'] = secret
  }
  return headers
}

export interface SabangnetCollectResult {
  ok: boolean
  snapshot_date: string
  rows: number
  order_rows: number
  notes: string[]
  error?: string
}

export async function triggerSabangnetCollect(date: string): Promise<SabangnetCollectResult> {
  const base = sabangnetCollectUrl()
  if (!base) throw new Error('사방넷 수집 URL이 설정되지 않았습니다.')

  const url = new URL(base, window.location.origin)
  url.searchParams.set('date', date)

  const response = await fetch(url, { method: 'GET', headers: authHeaders() })
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

  const notesRaw = Array.isArray(body.notes) ? body.notes : []
  return {
    ok: body.ok === true,
    snapshot_date: text(body.snapshot_date) || date,
    rows: num(body.rows),
    order_rows: num(body.order_rows),
    notes: notesRaw.map((item) => text(item)).filter(Boolean),
  }
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

export async function fetchSabangnetSnapshot(
  from: string,
  to: string,
  condition = 2,
  probe = false,
): Promise<SabangnetSnapshot> {
  const base = sabangnetQueryUrl()
  if (!base) throw new Error('사방넷 조회 URL이 설정되지 않았습니다.')

  const url = new URL(base, window.location.origin)
  url.searchParams.set('from', from)
  url.searchParams.set('to', to)
  url.searchParams.set('condition', String(condition))
  if (probe) url.searchParams.set('probe', '1')

  return shareInflight(`sabangnet:${url.toString()}`, async () => {
    const response = await fetch(url, { method: 'GET', headers: authHeaders() })
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) throw new Error(`조회 실패 (${response.status})`)

    const shopsRaw = Array.isArray(body.shops) ? body.shops : []
    const rowsRaw = Array.isArray(body.rows) ? body.rows : []
    const probesRaw = Array.isArray(body.probes) ? body.probes : []
    const notesRaw = Array.isArray(body.notes) ? body.notes : []
    const keysRaw = Array.isArray(body.field_keys) ? body.field_keys : []
    const statusRaw =
      body.status_counts && typeof body.status_counts === 'object'
        ? (body.status_counts as Record<string, unknown>)
        : {}

    const statusCounts: Record<string, number> = {}
    for (const [key, value] of Object.entries(statusRaw)) statusCounts[key] = num(value)

    return {
      from: text(body.from) || from,
      to: text(body.to) || to,
      condition: num(body.condition) || condition,
      orderRows: num(body.order_rows),
      returnedRows: num(body.returned_rows),
      amount: num(body.amount),
      fieldKeys: keysRaw.map((item) => text(item)).filter(Boolean),
      statusCounts,
      shops: shopsRaw.map((row) => {
        const item = (row ?? {}) as Record<string, unknown>
        return {
          name: text(item.name) || '(쇼핑몰명 없음)',
          loginId: text(item.loginId),
          shmaId: text(item.shmaId),
          count: num(item.count),
          amount: num(item.amount),
        }
      }),
      notes: notesRaw.map((item) => text(item)).filter(Boolean),
      error: body.error ? text(body.error) : null,
      rows: rowsRaw.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object'),
      probes: probesRaw.map((row) => (row ?? {}) as SabangnetProbe),
    }
  })
}
