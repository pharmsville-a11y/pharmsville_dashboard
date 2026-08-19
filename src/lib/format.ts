export function formatWon(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

export function formatPct(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatCompact(value: number): string {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}억`
  }
  if (value >= 10_000) {
    return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만`
  }
  return formatNumber(value)
}

export function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function formatAxisTime(iso: string, rangeKey: string): string {
  const date = new Date(iso)
  if (rangeKey === '1D') {
    return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit' }).format(date)
  }
  if (rangeKey === '5D' || rangeKey === '1M') {
    return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(date)
  }
  return new Intl.DateTimeFormat('ko-KR', { month: 'short' }).format(date)
}

export function formatTooltipTime(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatPeriodRange(from: Date, to: Date, period: 'daily' | 'weekly' | 'monthly'): string {
  if (period === 'daily') {
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(to)
  }
  if (period === 'weekly') {
    const start = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(from)
    const end = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(to)
    return `${start} – ${end}`
  }
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(to)
}
