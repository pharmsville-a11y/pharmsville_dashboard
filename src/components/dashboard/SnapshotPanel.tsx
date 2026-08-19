import type { ChannelSummary } from '../../adapters/types'
import { formatNumber, formatPct, formatRate, formatWon } from '../../lib/format'
import { cx } from '../../lib/cx'
import { RangeBar } from '../ui/RangeBar'
import './SnapshotPanel.css'

function metric(value: number, kind: ChannelSummary['kind']): string {
  return kind === 'commerce' ? formatWon(value) : formatNumber(value)
}

export function SnapshotPanel({ channel }: { channel?: ChannelSummary }) {
  if (!channel) {
    return (
      <section className="snapshot">
        <p className="muted">채널을 선택하세요</p>
      </section>
    )
  }

  return (
    <section className="snapshot">
      <div className="snapshot__head">
        <div>
          <p className="snapshot__kicker">스냅샷</p>
          <h3 className="snapshot__title">{channel.name}</h3>
        </div>
        <span className={cx('snapshot__change', channel.changePct >= 0 ? 'is-up' : 'is-down')}>
          {formatPct(channel.changePct)}
        </span>
      </div>

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

      {channel.commerce ? (
        <dl className="snapshot__dl">
          <div>
            <dt>주문</dt>
            <dd>{formatNumber(channel.commerce.orders)}</dd>
          </div>
          <div>
            <dt>전환율</dt>
            <dd>{formatRate(channel.commerce.conversionRate)}</dd>
          </div>
        </dl>
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
    </section>
  )
}
