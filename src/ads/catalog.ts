import type { ChannelKind, ChannelMeta } from '../adapters/types'

export type AdPlatform = 'naver' | 'coupang' | 'google'
export type AdProduct = 'sa' | 'da'
export type AdCollectorId = 'naver_searchad' | 'coupang_ads' | 'none'

export interface AdDefinition extends ChannelMeta {
  kind: ChannelKind
  platform: AdPlatform
  product: AdProduct
  enabled: boolean
  collector: AdCollectorId
  description: string
}

export function adId(platform: AdPlatform, product: AdProduct): string {
  return `${platform}_${product}`
}

/**
 * 광고 카드. 판매 채널(사방넷)과 별개다.
 * 채널 추가: enabled true + collect-daily 수집기 연결 + keys.ts 키 설명.
 */
export const AD_CATALOG: AdDefinition[] = [
  {
    id: adId('naver', 'sa'),
    kind: 'ads',
    platform: 'naver',
    product: 'sa',
    name: '네이버 검색광고',
    shortName: 'Naver SA',
    ticker: 'NSA',
    letter: 'S',
    badge: '#03C75A',
    accent: '#E8F8D8',
    sparkColor: '#4C9A1A',
    enabled: true,
    collector: 'naver_searchad',
    description: '파워링크·쇼핑검색(WEB_SITE, SHOPPING). 네이버 검색광고 API.',
  },
  {
    id: adId('naver', 'da'),
    kind: 'ads',
    platform: 'naver',
    product: 'da',
    name: '네이버 노출광고',
    shortName: 'Naver DA',
    ticker: 'NDA',
    letter: 'D',
    badge: '#1B8F4A',
    accent: '#D4EFD9',
    sparkColor: '#1B8F4A',
    enabled: true,
    collector: 'naver_searchad',
    description: '브랜드검색·파워컨텐츠·플레이스 등 검색광고 API의 비검색 캠페인. GFA는 별도 수집기.',
  },
  {
    id: adId('coupang', 'sa'),
    kind: 'ads',
    platform: 'coupang',
    product: 'sa',
    name: '쿠팡 검색광고',
    shortName: 'Coupang SA',
    ticker: 'CSA',
    letter: 'S',
    badge: '#E74C3C',
    accent: '#FCE8DE',
    sparkColor: '#E85D04',
    enabled: true,
    collector: 'coupang_ads',
    description: '쿠팡 실측 광고비. 마케팅 메뉴 전용. 매출·주문은 사방넷.',
  },
  {
    id: adId('coupang', 'da'),
    kind: 'ads',
    platform: 'coupang',
    product: 'da',
    name: '쿠팡 노출광고',
    shortName: 'Coupang DA',
    ticker: 'CDA',
    letter: 'D',
    badge: '#C0392B',
    accent: '#F8DDD6',
    sparkColor: '#D35400',
    enabled: false,
    collector: 'none',
    description: '쿠팡 광고 DA. 수집기 미구현.',
  },
  {
    id: adId('google', 'sa'),
    kind: 'ads',
    platform: 'google',
    product: 'sa',
    name: '구글 검색광고',
    shortName: 'Google SA',
    ticker: 'GSA',
    letter: 'S',
    badge: '#4285F4',
    accent: '#E8F0FE',
    sparkColor: '#1967D2',
    enabled: false,
    collector: 'none',
    description: 'Google Ads Search. 수집기 미구현.',
  },
  {
    id: adId('google', 'da'),
    kind: 'ads',
    platform: 'google',
    product: 'da',
    name: '구글 노출광고',
    shortName: 'Google DA',
    ticker: 'GDA',
    letter: 'D',
    badge: '#34A853',
    accent: '#E6F4EA',
    sparkColor: '#188038',
    enabled: false,
    collector: 'none',
    description: 'Google Ads Display. 수집기 미구현.',
  },
]

export function enabledAds(): AdDefinition[] {
  return AD_CATALOG.filter((item) => item.enabled)
}

export function visibleAds(): AdDefinition[] {
  return AD_CATALOG
}

export function getAd(id: string): AdDefinition | undefined {
  return AD_CATALOG.find((item) => item.id === id)
}

export function isAdEnabled(id: string): boolean {
  return getAd(id)?.enabled === true
}

export function enabledAdIds(): string[] {
  return enabledAds().map((item) => item.id)
}

export const AD_PRODUCT_LABEL: Record<AdProduct, string> = {
  sa: '검색광고',
  da: '노출광고',
}

export const AD_PLATFORM_LABEL: Record<AdPlatform, string> = {
  naver: '네이버',
  coupang: '쿠팡',
  google: '구글',
}

export const CAMPAIGN_TP_LABEL: Record<string, string> = {
  WEB_SITE: '파워링크',
  SHOPPING: '쇼핑검색',
  BRAND_SEARCH: '브랜드검색',
  POWER_CONTENTS: '파워컨텐츠',
  PLACE: '플레이스',
}
