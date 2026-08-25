import type { ChannelSummary } from '../../adapters/types'
import { AD_PRODUCT_LABEL, AD_SOURCE_KEYS, CAMPAIGN_TP_LABEL, keysForAd } from '../../ads'
import { keysForSource, sourceLabel } from '../../channels'
import { IfCapable } from '../../auth'
import { formatNumber, formatPct, formatPercent, formatRank, formatRate, formatWon } from '../../lib/format'
import { cx } from '../../lib/cx'
import { RangeBar } from '../ui/RangeBar'
import './SnapshotPanel.css'

function metric(value: number, kind: ChannelSummary['kind']): string {
  return kind === 'sns' ? formatNumber(value) : formatWon(value)
}

function sourceText(channel: ChannelSummary): string {
  if (channel.kind === 'ads') {
    const product = channel.product ? AD_PRODUCT_LABEL[channel.product] : ''
    if (!channel.sourceLive) return `대기 · ${product}`
    const source = AD_SOURCE_KEYS[channel.source ?? '']?.label ?? channel.source
    return `실측 · ${product} · ${source}`
  }
  const label = sourceLabel(channel.source) || channel.source || ''
  if (!label) return ''
  if (channel.sourceLive) return `실측 · ${label}`
  return `가상 · ${label}`
}

export function SnapshotPanel({
  channel,
  emptyLabel = '채널을 선택하세요',
  wide = false,
}: {
  channel?: ChannelSummary
  emptyLabel?: string
  wide?: boolean
}) {
  if (!channel) {
    return (
      <section className={cx('snapshot', wide && 'snapshot--wide')}>
        <p className="muted">{emptyLabel}</p>
      </section>
    )
  }

  const isAds = channel.kind === 'ads'

  return (
    <section className={cx('snapshot', wide && 'snapshot--wide')}>
      <div className="snapshot__head">
        <div>
          <p className="snapshot__kicker">{isAds ? '광고 스냅샷' : '스냅샷'}</p>
          <h3 className="snapshot__title">{channel.name}</h3>
          {sourceText(channel) ? <p className="snapshot__source">{sourceText(channel)}</p> : null}
        </div>
        <span className={cx('snapshot__change', channel.changePct >= 0 ? 'is-up' : 'is-down')}>
          {formatPct(channel.changePct)}
        </span>
      </div>

      <div className="snapshot__top">
        <div className="snapshot__open">
          <div>
            <p>Prev Close</p>
            <strong>{metric(channel.prevClose, channel.kind)}</strong>
          </div>
          <div>
            <p>Open</p>
            <strong>{metric(channel.open, channel.kind)}</strong>
          </div>
        </div>

        <div className="snapshot__bars">
          <RangeBar
            low={channel.dayLow}
            high={channel.dayHigh}
            current={channel.primaryValue}
            lowLabel={`Day Low  ${metric(channel.dayLow, channel.kind)}`}
            highLabel={`Day High  ${metric(channel.dayHigh, channel.kind)}`}
          />
          <RangeBar
            low={channel.yearLow}
            high={channel.yearHigh}
            current={channel.primaryValue}
            lowLabel={`기간 Low  ${metric(channel.yearLow, channel.kind)}`}
            highLabel={`기간 High  ${metric(channel.yearHigh, channel.kind)}`}
          />
        </div>
      </div>

      {channel.commerce && !isAds ? (
        <dl className="snapshot__dl">
          {typeof channel.commerce.orders === 'number' ? (
            <div>
              <dt>주문</dt>
              <dd>{formatNumber(channel.commerce.orders)}</dd>
            </div>
          ) : null}
          {typeof channel.commerce.conversionRate === 'number' ? (
            <div>
              <dt>전환율</dt>
              <dd>{formatRate(channel.commerce.conversionRate)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {isAds ? (
        <dl className="snapshot__dl">
          <IfCapable capability="metrics.adSpend">
            <div>
              <dt>광고비</dt>
              <dd>{formatWon(channel.primaryValue)}</dd>
            </div>
          </IfCapable>
          {channel.liveAd ? (
            <>
              <div>
                <dt>노출</dt>
                <dd>{formatNumber(channel.liveAd.impressions)}</dd>
              </div>
              <div>
                <dt>클릭</dt>
                <dd>{formatNumber(channel.liveAd.clicks)}</dd>
              </div>
              <div>
                <dt>클릭률</dt>
                <dd>{formatPercent(channel.liveAd.ctr)}</dd>
              </div>
              <div>
                <dt>평균 CPC</dt>
                <dd>{formatWon(channel.liveAd.cpc)}</dd>
              </div>
              <div>
                <dt>전환</dt>
                <dd>{formatNumber(channel.liveAd.conversions)}</dd>
              </div>
              <div>
                <dt>전환율</dt>
                <dd>{formatPercent(channel.liveAd.crto)}</dd>
              </div>
              <div>
                <dt>전환매출</dt>
                <dd>{formatWon(channel.liveAd.convAmt)}</dd>
              </div>
              <div>
                <dt>광고수익률</dt>
                <dd>{formatPercent(channel.liveAd.ror)}</dd>
              </div>
              <div>
                <dt>전환당비용</dt>
                <dd>{formatWon(channel.liveAd.cpConv)}</dd>
              </div>
              <div>
                <dt>동영상조회</dt>
                <dd>{formatNumber(channel.liveAd.viewCnt)}</dd>
              </div>
              <div>
                <dt>평균노출순위</dt>
                <dd>{formatRank(channel.liveAd.avgRnk)}</dd>
              </div>
              <div>
                <dt>PC 통검 순위</dt>
                <dd>{formatRank(channel.liveAd.pcNxAvgRnk)}</dd>
              </div>
              <div>
                <dt>모바일 통검 순위</dt>
                <dd>{formatRank(channel.liveAd.mblNxAvgRnk)}</dd>
              </div>
              <div>
                <dt>최근 통검 순위</dt>
                <dd>{formatRank(channel.liveAd.recentAvgRnk)}</dd>
              </div>
              <div>
                <dt>최근 평균 CPC</dt>
                <dd>{channel.liveAd.recentAvgCpc ? formatWon(channel.liveAd.recentAvgCpc) : '—'}</dd>
              </div>
            </>
          ) : null}
        </dl>
      ) : null}

      {isAds && channel.liveAd && channel.liveAd.campaigns.length > 0 ? (
        <details className="snapshot__campaigns">
          <summary>
            캠페인 {formatNumber(channel.liveAd.campaignCount || channel.liveAd.campaigns.length)}개
          </summary>
          <ul>
            {channel.liveAd.campaigns.map((campaign) => (
              <li key={campaign.id}>
                <div>
                  <strong>{campaign.name}</strong>
                  <span>{CAMPAIGN_TP_LABEL[campaign.campaignTp] ?? campaign.campaignTp}</span>
                </div>
                <p>
                  {formatWon(campaign.adSpend)} · 노출 {formatNumber(campaign.impressions)} · 클릭{' '}
                  {formatNumber(campaign.clicks)} · 전환 {formatNumber(campaign.conversions)}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {channel.sns ? (
        <dl className="snapshot__dl">
          <div>
            <dt>도달</dt>
            <dd>{formatNumber(channel.sns.reach)}</dd>
          </div>
          <div>
            <dt>참여율</dt>
            <dd>{formatRate(channel.sns.engagementRate)}</dd>
          </div>
        </dl>
      ) : null}

      <div className="snapshot__foot">
        <span>Trade Time {channel.tradeTime}</span>
        <span>Trade Date {channel.tradeDate}</span>
      </div>

      {isAds ? (
        <details className="snapshot__keys">
          <summary>데이터 키</summary>
          <dl>
            {(channel.kind === 'ads' ? keysForAd(channel.product) : keysForSource(channel.source)).map((item) => (
              <div key={item.key}>
                <dt>
                  <code>{item.key}</code>
                  <span>{item.label}</span>
                </dt>
                <dd>{item.description}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </section>
  )
}
