export interface FieldKeyDef {
  key: string
  label: string
  type: string
  description: string
}

/** channel_snapshots 컬럼 */
export const SNAPSHOT_KEYS: Record<string, FieldKeyDef> = {
  company_id: {
    key: 'company_id',
    label: '회사',
    type: 'text',
    description: '지금은 internal 하나. 나중에 고객사 코드.',
  },
  snapshot_date: {
    key: 'snapshot_date',
    label: '영업일',
    type: 'date',
    description: 'KST 기준 날짜 (YYYY-MM-DD). 하루 채널당 한 줄.',
  },
  period: {
    key: 'period',
    label: '집계 단위',
    type: 'text',
    description: 'daily | weekly | monthly. 수집은 daily 만 씀.',
  },
  channel_id: {
    key: 'channel_id',
    label: '채널 ID',
    type: 'text',
    description: 'naver, coupang, elevenst 등. 화면 이름과 별개의 저장 키.',
  },
  kind: {
    key: 'kind',
    label: '채널 유형',
    type: 'text',
    description: 'commerce(커머스) | sns(소셜).',
  },
  source: {
    key: 'source',
    label: '출처',
    type: 'text',
    description: '값이 어디서 왔는지. SOURCE_KEYS 참고.',
  },
  sales: {
    key: 'sales',
    label: '매출',
    type: 'number',
    description: '원 단위 매출. 사방넷 주문 원장(ORDER_TOT_AMT / 판매가).',
  },
  orders: {
    key: 'orders',
    label: '주문 수',
    type: 'integer',
    description: '해당일 주문 건수. 스마트스토어는 아직 미연동이라 null.',
  },
  conversion_rate: {
    key: 'conversion_rate',
    label: '전환율',
    type: 'number',
    description: '0~1 비율. 스토어 매출 연동 후 채움.',
  },
  ad_spend: {
    key: 'ad_spend',
    label: '광고비',
    type: 'number',
    description: '원 단위. 네이버는 검색광고 salesAmt 합계.',
  },
  followers: {
    key: 'followers',
    label: '팔로워',
    type: 'integer',
    description: 'SNS 채널용. 스마트스토어는 쓰지 않음.',
  },
  reach: {
    key: 'reach',
    label: '도달',
    type: 'integer',
    description: 'SNS 채널용.',
  },
  engagement_rate: {
    key: 'engagement_rate',
    label: '참여율',
    type: 'number',
    description: 'SNS 채널용. 0~1 비율.',
  },
  extra: {
    key: 'extra',
    label: '채널 부가값',
    type: 'json',
    description: '채널마다 다른 실측 필드. 네이버는 extra.naver_sa.',
  },
  captured_at: {
    key: 'captured_at',
    label: '수집 시각',
    type: 'timestamptz',
    description: 'Edge Function이 행을 쓴 시각.',
  },
}

/** source 컬럼에 들어가는 값 */
export const SOURCE_KEYS: Record<string, FieldKeyDef> = {
  naver_sa: {
    key: 'naver_sa',
    label: '네이버 검색광고',
    type: 'source',
    description: '네이버 검색광고 API 실측. 스마트스토어 매출이 아님.',
  },
  coupang: {
    key: 'coupang',
    label: '쿠팡 윙',
    type: 'source',
    description: '쿠팡 주문 API 실측. 지금은 수집 스위치가 꺼져 있음.',
  },
  mock: {
    key: 'mock',
    label: '가상',
    type: 'source',
    description: '예전에 넣던 목업. 더 이상 저장하지 않음.',
  },
  sabangnet: {
    key: 'sabangnet',
    label: '사방넷',
    type: 'source',
    description: '사방넷 API 3.0 주문 목록 조회. 판매 채널 매출·주문 원장.',
  },
  pluscl: {
    key: 'pluscl',
    label: '오프라인',
    type: 'source',
    description: 'PlusCL 주문사 매출. 사방넷_APPLE6·CJ직배·자사주문은 제외.',
  },
}

/** extra.naver_sa 객체 */
export const NAVER_SA_EXTRA_KEYS: Record<string, FieldKeyDef> = {
  ad_spend: {
    key: 'extra.naver_sa.ad_spend',
    label: '광고비',
    type: 'number',
    description: '검색광고 일 지출(salesAmt) 합. 컬럼 ad_spend 와 같음.',
  },
  impressions: {
    key: 'extra.naver_sa.impressions',
    label: '노출',
    type: 'integer',
    description: 'impCnt 합계.',
  },
  clicks: {
    key: 'extra.naver_sa.clicks',
    label: '클릭',
    type: 'integer',
    description: 'clkCnt 합계.',
  },
  conversions: {
    key: 'extra.naver_sa.conversions',
    label: '전환',
    type: 'integer',
    description: 'ccnt 합계.',
  },
  conv_amt: {
    key: 'extra.naver_sa.conv_amt',
    label: '전환매출',
    type: 'number',
    description: '검색광고가 추정한 전환 금액(convAmt). 스토어 실매출 아님.',
  },
}

export const CHANNEL_ID_KEYS: Record<string, FieldKeyDef> = {
  naver: {
    key: 'naver',
    label: '스마트스토어',
    type: 'channel_id',
    description: '화면 이름 스마트스토어. 매출은 사방넷, 광고는 naver_sa.',
  },
  makeshop: {
    key: 'makeshop',
    label: '메이크샵',
    type: 'channel_id',
    description: '메이크샵. 매출·주문은 사방넷.',
  },
  coupang: {
    key: 'coupang',
    label: '쿠팡',
    type: 'channel_id',
    description: '쿠팡. 매출·주문은 사방넷. 광고비는 마케팅 메뉴 coupang_sa.',
  },
  elevenst: {
    key: 'elevenst',
    label: '11번가',
    type: 'channel_id',
    description: '11번가. 매출·주문은 사방넷.',
  },
  shoppingnt: {
    key: 'shoppingnt',
    label: '쇼핑엔티',
    type: 'channel_id',
    description: '쇼핑엔티. 매출·주문은 사방넷.',
  },
  ezwel: {
    key: 'ezwel',
    label: '현대이지웰',
    type: 'channel_id',
    description: '현대이지웰. 매출·주문은 사방넷.',
  },
  gsshop: {
    key: 'gsshop',
    label: 'GS shop',
    type: 'channel_id',
    description: 'GS shop. 매출·주문은 사방넷.',
  },
  cjonstyle: {
    key: 'cjonstyle',
    label: 'CJ온스타일',
    type: 'channel_id',
    description: 'CJ온스타일. 매출·주문은 사방넷.',
  },
  toss: {
    key: 'toss',
    label: '토스쇼핑',
    type: 'channel_id',
    description: '토스쇼핑. 매출·주문은 사방넷.',
  },
  nshome: {
    key: 'nshome',
    label: 'NS홈쇼핑',
    type: 'channel_id',
    description: 'NS홈쇼핑. 매출·주문은 사방넷.',
  },
  samsungcard: {
    key: 'samsungcard',
    label: '삼성카드쇼핑',
    type: 'channel_id',
    description: '삼성카드쇼핑. 매출·주문은 사방넷.',
  },
  mamitalk: {
    key: 'mamitalk',
    label: '마미톡',
    type: 'channel_id',
    description: '마미톡. 매출·주문은 사방넷.',
  },
  benefia: {
    key: 'benefia',
    label: '베네피아',
    type: 'channel_id',
    description: '베네피아. 매출·주문은 사방넷.',
  },
  mallpie: {
    key: 'mallpie',
    label: 'Mallpie',
    type: 'channel_id',
    description: 'Mallpie. 매출·주문은 사방넷.',
  },
  lottehome: {
    key: 'lottehome',
    label: '롯데홈쇼핑',
    type: 'channel_id',
    description: '롯데홈쇼핑. 매출·주문은 사방넷.',
  },
  gmarket: {
    key: 'gmarket',
    label: 'ESM지마켓',
    type: 'channel_id',
    description: 'ESM 지마켓. 매출·주문은 사방넷.',
  },
  shinsegae: {
    key: 'shinsegae',
    label: '신세계몰',
    type: 'channel_id',
    description: '신세계몰. 매출·주문은 사방넷.',
  },
  homeandshopping: {
    key: 'homeandshopping',
    label: '홈&쇼핑',
    type: 'channel_id',
    description: '홈&쇼핑. 매출·주문은 사방넷.',
  },
  musinsa: {
    key: 'musinsa',
    label: '무신사',
    type: 'channel_id',
    description: '무신사. 매출·주문은 사방넷.',
  },
  ably: {
    key: 'ably',
    label: '에이블리',
    type: 'channel_id',
    description: '에이블리. 매출·주문은 사방넷.',
  },
  halfclub: {
    key: 'halfclub',
    label: '하프클럽',
    type: 'channel_id',
    description: '하프클럽. 매출·주문은 사방넷.',
  },
  instagram: {
    key: 'instagram',
    label: '인스타그램',
    type: 'channel_id',
    description: '대기.',
  },
  youtube: {
    key: 'youtube',
    label: '유튜브',
    type: 'channel_id',
    description: '대기.',
  },
  kakao: {
    key: 'kakao',
    label: '카카오',
    type: 'channel_id',
    description: '대기.',
  },
  blog: {
    key: 'blog',
    label: '블로그',
    type: 'channel_id',
    description: '대기.',
  },
}

export function sourceLabel(source?: string): string {
  if (!source) return ''
  return SOURCE_KEYS[source]?.label ?? source
}

export function keysForSource(source?: string): FieldKeyDef[] {
  const common = [
    SNAPSHOT_KEYS.channel_id,
    SNAPSHOT_KEYS.snapshot_date,
    SNAPSHOT_KEYS.source,
    SNAPSHOT_KEYS.ad_spend,
  ].filter((item): item is FieldKeyDef => Boolean(item))

  if (source === 'naver_sa') {
    return [...common, ...Object.values(NAVER_SA_EXTRA_KEYS)]
  }
  if (source === 'sabangnet' || source === 'pluscl') {
    return [
      ...common,
      SNAPSHOT_KEYS.sales,
      SNAPSHOT_KEYS.orders,
    ].filter((item): item is FieldKeyDef => Boolean(item))
  }
  if (source === 'coupang') {
    return [
      ...common,
      SNAPSHOT_KEYS.sales,
      SNAPSHOT_KEYS.orders,
    ].filter((item): item is FieldKeyDef => Boolean(item))
  }
  return common
}
