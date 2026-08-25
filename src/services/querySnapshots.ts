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

  const url = new URL(base)
  url.searchParams.set('from', from)
  url.searchParams.set('to', to)
  if (base.includes('query-snapshots')) {
    url.searchParams.set('channels', 'naver_sa,naver_da,naver')
  } else {
    url.searchParams.set('platforms', 'naver,coupang,google')
  }

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
}

export async function fetchAdsOrEmpty(from: string, to: string): Promise<AdSnapshotRow[]> {
  if (!isQueryConfigured()) return []
  try {
    return await fetchAds(from, to)
  } catch {
    return []
  }
}
