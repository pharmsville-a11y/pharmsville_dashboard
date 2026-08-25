import { mockAdapters } from './mock'
import type { ChannelAdapter } from './types'

/**
 * 판매·SNS 채널. 사방넷 연동 전까지 mock 매출을 보여 줍니다.
 * 광고 SA/DA 는 src/ads 카탈로그와 collect-daily 가 담당합니다.
 */
export const channelAdapters: ChannelAdapter[] = [...mockAdapters]
