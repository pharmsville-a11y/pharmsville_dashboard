import { useState } from 'react'
import { IfCapable } from '../../auth'
import type { ChannelSummary, SummaryPeriod } from '../../adapters/types'
import type { PeriodTotalsMap } from '../../services/dashboardService'
import { formatPct, formatWon } from '../../lib/format'
import { cx } from '../../lib/cx'
import { ChannelBadge } from '../ui/ChannelBadge'
import './PeriodSummary.css'

const PERIOD_TABS: Array<{ id: SummaryPeriod; label: string }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

const TOP_LABEL: Record<SummaryPeriod, string> = {
  daily: '오늘 톱 채널',
  weekly: '이번 주 톱 채널',
  monthly: '이번 달 톱 채널',
}

export function PeriodSummary({
  periodTotals,
  channels,
}: {
  periodTotals: PeriodTotalsMap
  channels: ChannelSummary[]
}) {
  const [period, setPeriod] = useState<SummaryPeriod>('daily')
  const selected = periodTotals[period]
  const periodTop = channels.find((channel) => channel.id === selected.topChannelId)

  return (
    <section className="period">
      <div className="period__head">
        <div className="period__tabs">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPeriod(tab.id)}
              className={cx('period__tab', period === tab.id && 'is-active')}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="period__date">{selected.dateLabel}</p>
      </div>

      <div className="period__grid">
        <div className="period__cell">
          <p className="period__label">매출</p>
          <div className="period__value-row">
            <p className="period__value">{formatWon(selected.sales)}</p>
            <span className={cx('period__change', selected.salesChangePct >= 0 ? 'is-up' : 'is-down')}>
              {formatPct(selected.salesChangePct)}
            </span>
          </div>
        </div>

        <IfCapable capability="metrics.adSpend">
          {typeof selected.adSpend === 'number' ? (
            <div className="period__cell">
              <p className="period__label">광고비</p>
              <p className="period__value">{formatWon(selected.adSpend)}</p>
            </div>
          ) : null}
        </IfCapable>

        {periodTop ? (
          <div className="period__cell">
            <p className="period__label">{TOP_LABEL[period]}</p>
            <div className="period__top">
              <div className="period__top-name">
                <ChannelBadge channel={periodTop} size="sm" />
                <p>{periodTop.name}</p>
              </div>
              <p className="period__top-value">{formatWon(selected.topChannelValue)}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
