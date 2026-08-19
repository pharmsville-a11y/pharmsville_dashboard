import type { ChannelSummary } from '../../adapters/types'
import { formatNumber, formatPct, formatWon } from '../../lib/format'
import { cx } from '../../lib/cx'
import { ChannelBadge } from '../ui/ChannelBadge'
import './Watchlist.css'

export function Watchlist({
  channels,
  selectedId,
  onSelect,
}: {
  channels: ChannelSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className="watchlist">
      <h2>채널 워치리스트</h2>
      <ul>
        {channels.map((channel) => {
          const up = channel.changePct >= 0
          const value =
            channel.kind === 'commerce'
              ? formatWon(channel.primaryValue)
              : formatNumber(channel.primaryValue)

          return (
            <li key={channel.id}>
              <button
                type="button"
                onClick={() => onSelect(channel.id)}
                className={cx('watchlist__row', channel.id === selectedId && 'is-active')}
              >
                <ChannelBadge channel={channel} size="sm" />
                <div className="watchlist__meta">
                  <p className="watchlist__name">{channel.name}</p>
                  <p className="watchlist__ticker">{channel.ticker}</p>
                </div>
                <div className="watchlist__nums">
                  <p className="watchlist__value">{value}</p>
                  <p className={cx('watchlist__change', up ? 'is-up' : 'is-down')}>
                    {formatPct(channel.changePct)}
                  </p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
