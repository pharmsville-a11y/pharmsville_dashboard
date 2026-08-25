import type { ChannelKind, ChannelMeta } from '../adapters/types'

/**
 * 판매 채널 카탈로그. 수집은 사방넷 API로 나중에 한 번에 붙인다.
 * 화면의 매출 카드는 연동 전까지 mock 어댑터를 사용한다.
 */
export type CollectorId = 'sabangnet' | 'none'

export interface ChannelDefinition extends ChannelMeta {
  kind: ChannelKind
  /** 지금 수집하고 대시보드에 보여줄지 */
  enabled: boolean
  collector: CollectorId
  /** 이 채널이 무엇인지 */
  description: string
}

/**
 * 사방넷 연동 전이라 전부 꺼 둔다. 붙일 때 enabled 를 true 로 바꾼다.
 */
export const CHANNEL_CATALOG: ChannelDefinition[] = [
  {
    id: 'naver',
    kind: 'commerce',
    name: '스마트스토어',
    shortName: 'Naver',
    ticker: 'NVR',
    letter: 'N',
    badge: '#03C75A',
    accent: '#E8F8D8',
    sparkColor: '#4C9A1A',
    enabled: false,
    collector: 'sabangnet',
    description:
      '네이버 스마트스토어. 매출·주문은 사방넷에서 받을 예정. 광고는 src/ads 의 naver_sa / naver_da.',
  },
  {
    id: 'makeshop',
    kind: 'commerce',
    name: '메이크샵',
    shortName: 'Makeshop',
    ticker: 'MKS',
    letter: 'M',
    badge: '#1FA971',
    accent: '#D8F3E7',
    sparkColor: '#2F9E6B',
    enabled: false,
    collector: 'sabangnet',
    description: '메이크샵 자사몰. 사방넷 대기.',
  },
  {
    id: 'coupang_1',
    kind: 'commerce',
    name: '쿠팡 1',
    shortName: 'Coupang 1',
    ticker: 'CPG1',
    letter: 'C1',
    badge: '#E74C3C',
    accent: '#FCE8DE',
    sparkColor: '#E85D04',
    enabled: false,
    collector: 'sabangnet',
    description: '쿠팡 윙 계정 1. 주문은 사방넷 대기. 광고는 src/ads.',
  },
  {
    id: 'coupang_2',
    kind: 'commerce',
    name: '쿠팡 2',
    shortName: 'Coupang 2',
    ticker: 'CPG2',
    letter: 'C2',
    badge: '#C0392B',
    accent: '#F8DDD6',
    sparkColor: '#D35400',
    enabled: false,
    collector: 'sabangnet',
    description: '쿠팡 윙 계정 2. 주문은 사방넷 대기.',
  },
  {
    id: 'elevenst',
    kind: 'commerce',
    name: '11번가',
    shortName: '11st',
    ticker: '11ST',
    letter: '11',
    badge: '#E60012',
    accent: '#FDECEC',
    sparkColor: '#C0392B',
    enabled: false,
    collector: 'sabangnet',
    description: '11번가. 사방넷 대기.',
  },
  {
    id: 'instagram',
    kind: 'sns',
    name: '인스타그램',
    shortName: 'Instagram',
    ticker: 'IG',
    letter: 'Ig',
    badge: '#E1306C',
    accent: '#F6E6F0',
    sparkColor: '#C13584',
    enabled: false,
    collector: 'none',
    description: '인스타그램. 수집기 미구현.',
  },
  {
    id: 'youtube',
    kind: 'sns',
    name: '유튜브',
    shortName: 'YouTube',
    ticker: 'YT',
    letter: 'Yt',
    badge: '#FF0000',
    accent: '#FDE2E2',
    sparkColor: '#E11D48',
    enabled: false,
    collector: 'none',
    description: '유튜브. 수집기 미구현.',
  },
  {
    id: 'kakao',
    kind: 'sns',
    name: '카카오',
    shortName: 'Kakao',
    ticker: 'KKO',
    letter: 'Kk',
    badge: '#3C1E1E',
    accent: '#FFF6C8',
    sparkColor: '#C9A227',
    enabled: false,
    collector: 'none',
    description: '카카오. 수집기 미구현.',
  },
  {
    id: 'blog',
    kind: 'sns',
    name: '블로그',
    shortName: 'Blog',
    ticker: 'BLG',
    letter: 'Bl',
    badge: '#2D6AE3',
    accent: '#E4EEFF',
    sparkColor: '#3B6DCC',
    enabled: false,
    collector: 'none',
    description: '블로그. 수집기 미구현.',
  },
]

export function enabledChannels(): ChannelDefinition[] {
  return CHANNEL_CATALOG.filter((channel) => channel.enabled)
}

export function getChannel(id: string): ChannelDefinition | undefined {
  return CHANNEL_CATALOG.find((channel) => channel.id === id)
}

export function isChannelEnabled(id: string): boolean {
  return getChannel(id)?.enabled === true
}

export function enabledChannelIds(): string[] {
  return enabledChannels().map((channel) => channel.id)
}
