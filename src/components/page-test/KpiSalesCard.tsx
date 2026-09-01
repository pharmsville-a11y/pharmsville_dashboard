import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { formatPct, formatWon } from '../../lib/format'
import type { PageTestDashboard } from '../../pages/pageTest/plusclDashboard'
import { Sparkline } from '../ui/Sparkline'
import './page-test.css'

function DeltaBadge({ label, value }: { label: string; value: number }) {
  const up = value >= 0
  return (
    <span className={up ? 'pt-delta pt-delta--up' : 'pt-delta pt-delta--down'}>
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      <span>{label}</span>
      <strong>{formatPct(value)}</strong>
    </span>
  )
}

export function KpiSalesCard({ data }: { data: PageTestDashboard['sales'] }) {
  return (
    <article className="pt-kpi pt-kpi--sales">
      <p className="pt-kpi__label">총 매출 / 실적</p>
      <div className="pt-kpi__sales-main">
        <p className="pt-kpi__amount">{formatWon(data.amount)}</p>
        <Sparkline data={data.sparkline} color="#b7f07a" width={88} height={32} />
      </div>
      <div className="pt-kpi__deltas">
        <DeltaBadge label="전월" value={data.momPct} />
        <DeltaBadge label="전일" value={data.dodPct} />
      </div>
      <p className="pt-kpi__hint">오늘 매출 · 최근 7일 추이</p>
    </article>
  )
}
