import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ChannelSummary } from '../../adapters/types'
import { formatNumber, formatPct, formatWon } from '../../lib/format'
import { cx } from '../../lib/cx'
import { ChannelBadge } from '../ui/ChannelBadge'
import './Watchlist.css'

export function Watchlist({
  channels,
  selectedId,
  onSelect,
  title = '채널 워치리스트',
}: {
  channels: ChannelSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  title?: string
}) {
  const ranked = [...channels].sort(
    (left, right) => right.primaryValue - left.primaryValue || left.name.localeCompare(right.name, 'ko'),
  )
  const firstChannelKey = useRef(true)
  const channelKey = channels.map((channel) => channel.id).join('|')
  const [laneEntering, setLaneEntering] = useState(false)

  useEffect(() => {
    if (firstChannelKey.current) {
      firstChannelKey.current = false
      return
    }
    setLaneEntering(true)
    const timer = window.setTimeout(() => setLaneEntering(false), 520)
    return () => window.clearTimeout(timer)
  }, [channelKey])

  return (
    <section className="watchlist">
      <h2>{title}</h2>
      {ranked.length === 0 ? (
        <p className="watchlist__empty">해당하는 채널이 없습니다.</p>
      ) : (
        <ul>
          {ranked.map((channel, index) => {
            const up = channel.changePct >= 0
            const value =
              channel.kind === 'sns' ? formatNumber(channel.primaryValue) : formatWon(channel.primaryValue)

            return (
              <li key={channel.id}>
                <button
                  type="button"
                  onClick={() => onSelect(channel.id)}
                  className={cx(
                    'watchlist__row',
                    channel.id === selectedId && 'is-active',
                    laneEntering && 'is-lane-enter',
                  )}
                  style={{ '--reveal-i': index } as CSSProperties}
                >
                  <ChannelBadge channel={channel} size="sm" />
                  <div className="watchlist__meta">
                    <p className="watchlist__name">{channel.name}</p>
                    <p className="watchlist__ticker">
                      {channel.ticker}
                      {channel.source === 'pluscl' ? <span className="watchlist__offline">오프라인</span> : null}
                    </p>
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
      )}
    </section>
  )
}
