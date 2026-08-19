import { ArrowUpRight } from 'lucide-react'
import { IfCapable } from '../../auth'
import type { ChannelSummary } from '../../adapters/types'
import type { DashboardTotals } from '../../services/dashboardService'
import { formatNumber, formatPct, formatWon } from '../../lib/format'
import { ChannelBadge } from '../ui/ChannelBadge'
import { Sparkline } from '../ui/Sparkline'
import './SummaryCards.css'

export function SummaryCards({
  totals,
  topChannel,
}: {
  totals: DashboardTotals
  topChannel?: ChannelSummary
}) {
  return (
    <div className="summary">
      <div className="summary__cards summary__sales">
        <p className="summary__label">총 매출</p>
        <div className="summary__sales-row">
          <p className="summary__amount">{formatWon(totals.sales)}</p>
          <span className="summary__badge">{formatPct(totals.salesChangePct)}</span>
        </div>
      </div>

      <IfCapable capability="metrics.adSpend">
        {typeof totals.adSpend === 'number' ? (
          <div className="summary__cards summary__ad">
            <div>
              <p className="summary__label">광고비</p>
              <p className="summary__ad-value">{formatWon(totals.adSpend)}</p>
            </div>
            <button type="button" className="summary__ad-btn" aria-label="광고비 상세">
              <ArrowUpRight size={18} />
            </button>
          </div>
        ) : null}
      </IfCapable>

      {topChannel ? (
        <div className="summary__cards summary__top">
          <p className="summary__top-label">이번 주 톱 채널</p>
          <div className="summary__top-row">
            <div className="summary__top-meta">
              <ChannelBadge channel={topChannel} size="sm" />
              <div>
                <p className="summary__top-name">{topChannel.name}</p>
                <p className="summary__top-value">
                  {topChannel.kind === 'commerce'
                    ? formatWon(topChannel.primaryValue)
                    : formatNumber(topChannel.primaryValue)}
                </p>
              </div>
            </div>
            <Sparkline data={topChannel.sparkline} color={topChannel.sparkColor} width={72} height={28} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
