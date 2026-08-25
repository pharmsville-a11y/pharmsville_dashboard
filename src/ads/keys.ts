import type { FieldKeyDef } from '../channels/keys'
import type { AdProduct } from './catalog'

export const AD_SNAPSHOT_KEYS: Record<string, FieldKeyDef> = {
  platform: {
    key: 'platform',
    label: '광고 플랫폼',
    type: 'text',
    description: 'naver | coupang | google',
  },
  product: {
    key: 'product',
    label: '광고 상품',
    type: 'text',
    description: 'sa=검색광고, da=노출광고',
  },
  snapshot_date: {
    key: 'snapshot_date',
    label: '영업일',
    type: 'date',
    description: 'KST 기준 날짜.',
  },
  snapshot_hour: {
    key: 'snapshot_hour',
    label: '시각',
    type: 'integer',
    description: 'KST 시(0-23). 오늘 수집은 현재 시, 과거일 마감은 23.',
  },
  source: {
    key: 'source',
    label: '출처',
    type: 'text',
    description: 'naver_searchad, naver_gfa, coupang_ads, google_ads 등.',
  },
  ad_spend: {
    key: 'ad_spend',
    label: '광고비',
    type: 'number',
    description: '원 단위 지출.',
  },
  impressions: {
    key: 'impressions',
    label: '노출',
    type: 'integer',
    description: 'impCnt 합계.',
  },
  clicks: {
    key: 'clicks',
    label: '클릭',
    type: 'integer',
    description: 'clkCnt 합계.',
  },
  conversions: {
    key: 'conversions',
    label: '전환',
    type: 'number',
    description: 'ccnt 합계.',
  },
  conv_amt: {
    key: 'conv_amt',
    label: '전환매출',
    type: 'number',
    description: '광고 플랫폼이 추정한 전환 금액. 스토어 실매출 아님.',
  },
  extra: {
    key: 'extra',
    label: '부가값',
    type: 'json',
    description: 'stats(공식 지표 전부), campaigns, adgroups, campaign_types.',
  },
}

export const AD_SOURCE_KEYS: Record<string, FieldKeyDef> = {
  naver_searchad: {
    key: 'naver_searchad',
    label: '네이버 검색광고 API',
    type: 'source',
    description: 'api.searchad.naver.com. SA/DA 모두 이 API의 campaignTp로 나눔.',
  },
  naver_gfa: {
    key: 'naver_gfa',
    label: '네이버 성과형 디스플레이',
    type: 'source',
    description: 'GFA. 파트너 OAuth 필요. 아직 미연동.',
  },
  coupang_ads: {
    key: 'coupang_ads',
    label: '쿠팡 광고',
    type: 'source',
    description: '대기.',
  },
  google_ads: {
    key: 'google_ads',
    label: '구글 광고',
    type: 'source',
    description: '대기.',
  },
}

export function keysForAd(product?: AdProduct): FieldKeyDef[] {
  const keys = [
    AD_SNAPSHOT_KEYS.platform,
    AD_SNAPSHOT_KEYS.product,
    AD_SNAPSHOT_KEYS.snapshot_date,
    AD_SNAPSHOT_KEYS.snapshot_hour,
    AD_SNAPSHOT_KEYS.source,
    AD_SNAPSHOT_KEYS.ad_spend,
    AD_SNAPSHOT_KEYS.impressions,
    AD_SNAPSHOT_KEYS.clicks,
    AD_SNAPSHOT_KEYS.conversions,
    AD_SNAPSHOT_KEYS.conv_amt,
  ].filter((item): item is FieldKeyDef => Boolean(item))
  keys.push(
    {
      key: 'extra.stats.ctr',
      label: '클릭률',
      type: 'number',
      description: '클릭 / 노출 × 100.',
    },
    {
      key: 'extra.stats.cpc',
      label: '평균 CPC',
      type: 'number',
      description: '광고비 / 클릭.',
    },
    {
      key: 'extra.stats.crto',
      label: '전환율',
      type: 'number',
      description: '전환 / 클릭 × 100.',
    },
    {
      key: 'extra.stats.ror',
      label: '광고수익률',
      type: 'number',
      description: '전환매출 / 광고비 × 100.',
    },
    {
      key: 'extra.stats.cpConv',
      label: '전환당비용',
      type: 'number',
      description: '광고비 / 전환.',
    },
    {
      key: 'extra.stats.avgRnk',
      label: '평균노출순위',
      type: 'number',
      description: '노출 가중 평균.',
    },
    {
      key: 'extra.stats.pcNxAvgRnk',
      label: 'PC 통검 순위',
      type: 'number',
      description: 'PC 통합검색 평균노출순위.',
    },
    {
      key: 'extra.stats.mblNxAvgRnk',
      label: '모바일 통검 순위',
      type: 'number',
      description: '모바일 통합검색 평균노출순위.',
    },
    {
      key: 'extra.stats.recentAvgRnk',
      label: '최근 통검 순위',
      type: 'number',
      description: '최근 통합검색 평균노출순위.',
    },
    {
      key: 'extra.stats.recentAvgCpc',
      label: '최근 평균 CPC',
      type: 'number',
      description: '클릭 가중 최근 평균 CPC.',
    },
    {
      key: 'extra.stats.viewCnt',
      label: '동영상조회수',
      type: 'integer',
      description: 'viewCnt 합계.',
    },
    {
      key: 'extra.campaigns',
      label: '캠페인별 성과',
      type: 'json',
      description: '검색광고 /stats 캠페인 단위 전체 지표.',
    },
    {
      key: 'extra.adgroups',
      label: '광고그룹별 성과',
      type: 'json',
      description: '검색광고 /stats 광고그룹 단위 전체 지표.',
    },
  )
  if (product === 'da') {
    keys.push({
      key: 'extra.campaign_types',
      label: '캠페인 유형',
      type: 'json',
      description: 'BRAND_SEARCH, POWER_CONTENTS, PLACE 등 DA로 묶인 유형.',
    })
  }
  return keys
}
