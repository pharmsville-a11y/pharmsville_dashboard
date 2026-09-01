import type { ChannelSummary } from '../../adapters/types'
import { channelIcon } from '../../channels/icons'
import { cx } from '../../lib/cx'
import './ChannelBadge.css'

export function ChannelBadge({
  channel,
  size = 'md',
}: {
  channel: Pick<ChannelSummary, 'id' | 'name' | 'letter' | 'badge'>
  size?: 'sm' | 'md'
}) {
  const icon = channelIcon(channel.id, channel.name)
  return (
    <div
      className={cx('channel-badge', size === 'sm' && 'channel-badge--sm', icon && 'has-icon')}
      style={icon ? undefined : { background: channel.badge }}
    >
      {icon ? <img src={icon} alt="" /> : channel.letter}
    </div>
  )
}
