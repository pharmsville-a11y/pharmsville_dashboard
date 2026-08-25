import { ArrowUpRight } from 'lucide-react'
import { IfCapable } from '../../auth'
import type { ChannelSummary } from '../../adapters/types'
import { AD_PRODUCT_LABEL } from '../../ads'
import type { DashboardTotals } from '../../services/dashboardService'
import { groupedAdBreakdown } from '../../services/adSpend'
import { formatNumber, formatPct, formatWon } from '../../lib/format'
import { ChannelBadge } from '../ui/ChannelBadge'
import { Sparkline } from '../ui/Sparkline'
import './SummaryCards.css'

function spendText(amount: number, live?: boolean) {
  if (!live) return '대기'
  return formatWon(amount)
}

export function SummaryCards({
  totals,
  topChannel,
  mode = 'sales',
  onOpenMarketing,
}: {
  totals: DashboardTotals
  topChannel?: ChannelSummary
  mode?: 'sales' | 'ads'
  onOpenMarketing?: () => void
}) {
  const ads = groupedAdBreakdown(totals.adBreakdown ?? [])
  const topLabel = mode === 'ads' ? '이번 주 톱 광고' : '이번 주 톱 채널'

  return (
    <div className="summary">
      {mode === 'sales' ? (
        <div className="summary__cards summary__sales">
          <p className="summary__label">총 매출</p>
          <div className="summary__sales-row">
            <p className="summary__amount">{formatWon(totals.sales)}</p>
            <span className="summary__badge">{formatPct(totals.salesChangePct)}</span>
          </div>
        </div>
      ) : (
        <IfCapable capability="metrics.adSpend">
          <div className="summary__cards summary__sales">
            <p className="summary__label">총 광고비</p>
            <div className="summary__sales-row">
              <p className="summary__amount">{formatWon(totals.adSpend ?? 0)}</p>
              <span className="summary__badge">{formatPct(totals.salesChangePct)}</span>
            </div>
          </div>
        </IfCapable>
      )}

      <IfCapable capability="metrics.adSpend">
        {typeof totals.adSpend === 'number' ? (
          <div className="summary__cards summary__ad">
            <div className="summary__ad-head">
              <div>
                <p className="summary__label">{mode === 'ads' ? '플랫폼별 광고비' : '총 광고비'}</p>
                {mode === 'sales' ? <p className="summary__ad-value">{formatWon(totals.adSpend)}</p> : null}
              </div>
              {mode === 'sales' && onOpenMarketing ? (
                <button type="button" className="summary__ad-btn" aria-label="마케팅 광고 보기" onClick={onOpenMarketing}>
                  <ArrowUpRight size={18} />
                </button>
              ) : null}
            </div>
            <ul className="summary__ad-break">
              {ads.map((row) => (
                <li key={row.platform}>
                  <span className="summary__ad-plat">{row.label}</span>
                  <span>
                    {AD_PRODUCT_LABEL.sa} {spendText(row.sa?.adSpend ?? 0, row.sa?.live)}
                  </span>
                  <span>
                    {AD_PRODUCT_LABEL.da} {spendText(row.da?.adSpend ?? 0, row.da?.live)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </IfCapable>

      {topChannel ? (
        <div className="summary__cards summary__top">
          <p className="summary__top-label">{topLabel}</p>
          <div className="summary__top-row">
            <div className="summary__top-meta">
              <ChannelBadge channel={topChannel} size="sm" />
              <div>
                <p className="summary__top-name">{topChannel.name}</p>
                <p className="summary__top-value">
                  {topChannel.kind === 'sns'
                    ? formatNumber(topChannel.primaryValue)
                    : formatWon(topChannel.primaryValue)}
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
