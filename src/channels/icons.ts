const BASE = `${import.meta.env.BASE_URL}channel-icons/`

const BY_ID: Record<string, string> = {
  shoppingnt: 'shoppingnt.png',
  musinsa: 'musinsa.png',
  homeandshopping: 'hnsmall.png',
  shinsegae: 'ssg.png',
  halfclub: 'halfclub.png',
  ably: 'ably.png',
  mamitalk: 'mamitalk.png',
  makeshop: 'makeshop.png',
  benefia: 'benefia.png',
  samsungcard: 'samsungcard.png',
  coupang: 'coupang.jpg',
  toss: 'toss.png',
  ezwel: 'ezwel.png',
  cjonstyle: 'cjonstyle.png',
  gmarket: 'gmarket.png',
}

const BY_NAME: Array<[string, string]> = [
  ['메가마트', 'megamart.png'],
  ['와몰', 'wamall.png'],
  ['더블유쇼핑', 'wshopping.png'],
  ['보건소', 'health.svg'],
  ['이메딕', 'emedic.png'],
  ['개성상인', 'gaeseong.png'],
  ['코스트코', 'costco.png'],
  ['하나로마트', 'hanaro.png'],
  ['농협', 'hanaro.png'],
  ['한진', 'hanjin.png'],
  ['현대홈쇼핑', 'hmall.jpg'],
  ['쇼핑엔티', 'shoppingnt.png'],
  ['무신사', 'musinsa.png'],
  ['홈&쇼핑', 'hnsmall.png'],
  ['신세계', 'ssg.png'],
  ['하프클럽', 'halfclub.png'],
  ['에이블리', 'ably.png'],
  ['마미톡', 'mamitalk.png'],
  ['메이크샵', 'makeshop.png'],
  ['베네피아', 'benefia.png'],
  ['삼성카드', 'samsungcard.png'],
  ['쿠팡', 'coupang.jpg'],
  ['토스', 'toss.png'],
  ['이지웰', 'ezwel.png'],
  ['CJ온스타일', 'cjonstyle.png'],
  ['지마켓', 'gmarket.png'],
]

export function channelIcon(id: string, name = ''): string | undefined {
  const file = BY_ID[id]
  if (file) return `${BASE}${file}`
  const hay = name.replace(/\s+/g, '').replace(/\(주\)/g, '')
  for (const [needle, icon] of BY_NAME) {
    if (hay.includes(needle)) return `${BASE}${icon}`
  }
  return undefined
}
