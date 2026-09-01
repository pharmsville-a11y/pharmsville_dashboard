import type { ChannelKind, ChannelMeta } from '../types'

/** 예전 목업 시드 타입. 화면에서는 더 이상 쓰지 않습니다. */
export interface MockChannelSeed extends ChannelMeta {
  kind: ChannelKind
  changePct: number
  adSpend: number
  sales?: number
  orders?: number
  conversionRate?: number
  followers?: number
  reach?: number
  engagementRate?: number
}

export const MOCK_CHANNEL_SEEDS: MockChannelSeed[] = []
