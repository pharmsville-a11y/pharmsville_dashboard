import type { ChannelAdapter } from './types'

/**
 * 판매 채널 숫자는 카탈로그 + channel_snapshots(사방넷)만 씁니다.
 * 물류 재고·주문은 PlusCL, 광고 SA/DA 는 src/ads 와 collect-daily 가 담당합니다.
 */
export const channelAdapters: ChannelAdapter[] = []
