import type { InventoryKpi } from '../../pages/pageTest/plusclDashboard'
import { RadialGauge } from './RadialGauge'
import './page-test.css'

export function KpiInventoryCard({ data }: { data: InventoryKpi }) {
  const gap = data.sellThroughDays - data.remainingDays
  const behind = gap > 0

  return (
    <article className={`pt-kpi pt-kpi--inventory pt-kpi--${data.tone}`}>
      <p className="pt-kpi__label">{data.title}</p>
      <div className="pt-kpi__inventory-main">
        <RadialGauge value={data.achievementPct} tone={data.tone === 'danger' ? 'danger' : 'warn'} />
        <div className="pt-kpi__inventory-meta">
          <p className="pt-kpi__inventory-rate">판매 달성률</p>
          <p className="pt-kpi__inventory-days">
            판매소진일 <strong>{data.sellThroughDays}일</strong>
          </p>
          <p className="pt-kpi__inventory-remain">
            잔여 <strong>{data.remainingDays}일</strong>
            <span className={behind ? 'pt-kpi__lag' : 'pt-kpi__ahead'}>
              {behind ? ` · ${gap}일 부족` : ' · 여유'}
            </span>
          </p>
        </div>
      </div>
    </article>
  )
}
