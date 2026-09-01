import { shareInflight } from '../lib/shareInflight'
import { canonicalChannelId } from '../channels/catalog'

export interface AdSnapshotRow {
  snapshot_date: string
  snapshot_hour: number
  platform: string
  product: 'sa' | 'da'
  source: string
  ad_spend: number | string | null
  impressions: number | string | null
  clicks: number | string | null
  conversions: number | string | null
  conv_amt: number | string | null
  extra: Record<string, unknown> | null
  captured_at: string | null
  channel_id: string
}

export function isQueryConfigured(): boolean {
  return Boolean(envValue(import.meta.env.VITE_QUERY_URL))
}

function envValue(value: string | undefined): string {
  return (value ?? '').trim().replace(/^['"]|['"]$/g, '')
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function asProduct(value: unknown): 'sa' | 'da' | null {
  return value === 'sa' || value === 'da' ? value : null
}

function extraRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function hourOf(raw: Record<string, unknown>): number {
  const parsed = Number(raw.snapshot_hour)
  if (Number.isFinite(parsed)) return Math.min(23, Math.max(0, Math.round(parsed)))
  return 0
}

/** query-ads 행과 예전 channel_snapshots 행을 광고 행으로 맞춘다. */
export function normalizeAdRow(raw: Record<string, unknown>): AdSnapshotRow | null {
  const extra = extraRecord(raw.extra)
  const nested = extraRecord(extra.naver_sa)

  if (typeof raw.platform === 'string' && asProduct(raw.product)) {
    const product = asProduct(raw.product)
    if (!product) return null
    return {
      snapshot_date: String(raw.snapshot_date ?? ''),
      snapshot_hour: hourOf(raw),
      platform: raw.platform,
      product,
      source: String(raw.source ?? ''),
      ad_spend: num(raw.ad_spend),
      impressions: num(raw.impressions ?? extra.impressions ?? nested.impressions),
      clicks: num(raw.clicks ?? extra.clicks ?? nested.clicks),
      conversions: num(raw.conversions ?? extra.conversions ?? nested.conversions),
      conv_amt: num(raw.conv_amt ?? extra.conv_amt ?? nested.conv_amt),
      extra,
      captured_at: raw.captured_at ? String(raw.captured_at) : null,
      channel_id: `${raw.platform}_${product}`,
    }
  }

  const channelId = String(raw.channel_id ?? '')
  const mapped = channelId === 'naver' ? 'naver_sa' : channelId
  const [platform, productRaw] = mapped.split('_')
  const product = asProduct(productRaw)
  if (!platform || !product) return null

  return {
    snapshot_date: String(raw.snapshot_date ?? ''),
    snapshot_hour: hourOf(raw),
    platform,
    product,
      source: raw.source === 'mock' || raw.source === 'naver_sa' || !raw.source
        ? 'naver_searchad'
        : String(raw.source),
    ad_spend: num(raw.ad_spend),
    impressions: num(extra.impressions ?? nested.impressions),
    clicks: num(extra.clicks ?? nested.clicks),
    conversions: num(extra.conversions ?? nested.conversions),
    conv_amt: num(extra.conv_amt ?? nested.conv_amt),
    extra,
    captured_at: raw.captured_at ? String(raw.captured_at) : null,
    channel_id: mapped,
  }
}

export async function fetchAds(from: string, to: string): Promise<AdSnapshotRow[]> {
  const base = envValue(import.meta.env.VITE_QUERY_URL)
  const secret = envValue(import.meta.env.VITE_QUERY_SECRET)
  if (!base) {
    throw new Error('조회 URL이 설정되지 않았습니다.')
  }

  const url = new URL(base, window.location.origin)
  url.searchParams.set('from', from)
  url.searchParams.set('to', to)
  if (base.includes('query-snapshots')) {
    url.searchParams.set('channels', 'naver_sa,naver_da,naver')
  } else {
    url.searchParams.set('platforms', 'naver,coupang,google')
  }

  return shareInflight(`ads:${url.toString()}`, async () => {
    const headers: Record<string, string> = {}
    if (secret) {
      headers['x-query-secret'] = secret
      headers['x-collect-secret'] = secret
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    })
    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; rows?: Record<string, unknown>[]; error?: string }
      | null

    if (!response.ok || !body?.ok) {
      throw new Error(body?.error ?? `조회 실패 (${response.status})`)
    }

    return (body.rows ?? [])
      .map((row) => normalizeAdRow(row))
      .filter((row): row is AdSnapshotRow => Boolean(row))
  })
}

export async function fetchAdsOrEmpty(from: string, to: string): Promise<AdSnapshotRow[]> {
  if (!isQueryConfigured()) return []
  try {
    return await fetchAds(from, to)
  } catch {
    return []
  }
}

export interface ChannelSnapshotRow {
  snapshot_date: string
  snapshot_hour: number
  channel_id: string
  kind: string
  source: string
  sales: number
  orders: number
  extra: Record<string, unknown> | null
  captured_at: string | null
}

function channelHourOf(raw: Record<string, unknown>): number {
  const parsed = Number(raw.snapshot_hour)
  if (Number.isFinite(parsed)) return Math.min(23, Math.max(0, Math.round(parsed)))
  return 0
}

export function snapshotsQueryUrl(): string {
  const explicit = envValue(import.meta.env.VITE_SNAPSHOTS_URL)
  if (explicit) return explicit
  const ads = envValue(import.meta.env.VITE_QUERY_URL)
  if (ads.includes('query-ads')) return ads.replace('query-ads', 'query-snapshots')
  if (ads) return ads.replace(/query-ads\/?$/, 'query-snapshots')
  return '/functions/v1/query-snapshots'
}

export async function fetchChannelSnapshots(
  from: string,
  to: string,
  channels: string[],
): Promise<ChannelSnapshotRow[]> {
  const base = snapshotsQueryUrl()
  const secret = envValue(import.meta.env.VITE_QUERY_SECRET)
  if (!base) return []

  const url = new URL(base, window.location.origin)
  url.searchParams.set('from', from)
  url.searchParams.set('to', to)
  if (channels.length) url.searchParams.set('channels', channels.join(','))

  return shareInflight(`channels:${url.toString()}`, async () => {
    const headers: Record<string, string> = {}
    if (secret) {
      headers['x-query-secret'] = secret
      headers['x-collect-secret'] = secret
    }
    const response = await fetch(url, { method: 'GET', headers })
    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; rows?: Record<string, unknown>[]; error?: string }
      | null
    if (!response.ok || !body?.ok) return []
    const nativeKeys = new Set<string>()
    const parsed = (body.rows ?? [])
      .flatMap((row) => {
        const source = String(row.source ?? '')
        if (source !== 'sabangnet' && source !== 'pluscl') return []
        const snapshot_date = String(row.snapshot_date ?? '').slice(0, 10)
        const original_id = String(row.channel_id ?? '')
        const channel_id =
          source === 'pluscl' ? original_id : canonicalChannelId(original_id)
        if (!channel_id || !snapshot_date) return []
        return [{
          snapshot_date,
          snapshot_hour: channelHourOf(row),
          original_id,
          channel_id,
          kind: String(row.kind ?? 'commerce'),
          source: source as 'sabangnet' | 'pluscl',
          sales: num(row.sales),
          orders: Math.round(num(row.orders)),
          extra: extraRecord(row.extra),
          captured_at: row.captured_at ? String(row.captured_at) : null,
        }]
      })
    for (const row of parsed) {
      if (row.original_id === row.channel_id) nativeKeys.add(`${row.snapshot_date}:${row.channel_id}`)
    }
    return parsed.reduce<ChannelSnapshotRow[]>((rows, row) => {
      const remapped = row.original_id !== row.channel_id
      if (remapped && nativeKeys.has(`${row.snapshot_date}:${row.channel_id}`)) return rows
      const existing = rows.find(
        (item) =>
          item.snapshot_date === row.snapshot_date &&
          item.snapshot_hour === row.snapshot_hour &&
          item.channel_id === row.channel_id,
      )
      if (!existing) {
        rows.push({
          snapshot_date: row.snapshot_date,
          snapshot_hour: row.snapshot_hour,
          channel_id: row.channel_id,
          kind: row.kind,
          source: row.source,
          sales: row.sales,
          orders: row.orders,
          extra: row.extra,
          captured_at: row.captured_at,
        })
        return rows
      }
      existing.sales += row.sales
      existing.orders += row.orders
      if (!existing.captured_at || (row.captured_at && row.captured_at > existing.captured_at)) {
        existing.captured_at = row.captured_at
        existing.extra = row.extra
      }
      return rows
    }, [])
  })
}

export async function fetchChannelSnapshotsOrEmpty(
  from: string,
  to: string,
  channels: string[],
): Promise<ChannelSnapshotRow[]> {
  if (!snapshotsQueryUrl()) return []
  try {
    return await fetchChannelSnapshots(from, to, channels)
  } catch {
    return []
  }
}
