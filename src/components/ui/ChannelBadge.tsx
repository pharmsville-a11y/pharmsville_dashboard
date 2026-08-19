import type { ChannelSummary } from '../../adapters/types'
import { cx } from '../../lib/cx'
import './ChannelBadge.css'

export function ChannelBadge({
  channel,
  size = 'md',
}: {
  channel: Pick<ChannelSummary, 'letter' | 'badge'>
  size?: 'sm' | 'md'
}) {
  return (
    <div
      className={cx('channel-badge', size === 'sm' && 'channel-badge--sm')}
      style={{ background: channel.badge }}
    >
      {channel.letter}
    </div>
  )
}
