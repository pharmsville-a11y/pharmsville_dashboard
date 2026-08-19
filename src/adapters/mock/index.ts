import { makeMockAdapter } from './makeMockAdapter'
import { MOCK_CHANNEL_SEEDS } from './seeds'
import type { ChannelAdapter } from '../types'

export const mockAdapters: ChannelAdapter[] = MOCK_CHANNEL_SEEDS.map(makeMockAdapter)
