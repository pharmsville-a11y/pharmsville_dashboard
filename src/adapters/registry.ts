import { mockAdapters } from './mock'
import type { ChannelAdapter } from './types'

/**
 * 채널을 추가할 때는 어댑터를 구현한 뒤 이 배열에 넣으면 됩니다.
 * 지금은 mock 구현만 연결되어 있습니다.
 */
export const channelAdapters: ChannelAdapter[] = [...mockAdapters]
