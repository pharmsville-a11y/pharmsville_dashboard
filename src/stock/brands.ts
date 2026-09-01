/** PlusCL 재고 브랜드 묶음. aliases 를 늘리거나 합치면 화면 그룹이 바뀝니다. */
export type StockBrand = {
  id: string
  name: string
  aliases: string[]
}

export const STOCK_BRANDS: StockBrand[] = [
  { id: 'appletree', name: '애플트리김약사네', aliases: ['애플트리김약사네', '애김'] },
  { id: 'applekinder', name: '애플킨더', aliases: ['애플킨더'] },
  { id: 'doctorsolution', name: '닥터솔루션', aliases: ['닥터솔루션'] },
  { id: 'deviltalk', name: '데빌톡', aliases: ['데빌톡'] },
  { id: 'ps', name: 'PS', aliases: ['ps'] },
  { id: 'boryung', name: '보령', aliases: ['보령'] },
  { id: 'vitaminstory', name: '비타민스토리', aliases: ['비타민스토리', '비스'] },
  { id: 'devildiet', name: '악마다이어트', aliases: ['악마다이어트', '악마'] },
]

export const OTHER_STOCK_BRAND: StockBrand = { id: 'other', name: '기타', aliases: [] }

function compact(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

export function resolveStockBrand(row: {
  itemName: string
  itemCode: string
  category1: string
}): StockBrand {
  const prefix = row.itemName.match(/^\[([^\]]+)\]/)?.[1] ?? ''
  const fields = [row.category1, prefix].map(compact).filter(Boolean)

  for (const brand of STOCK_BRANDS) {
    const aliases = [...brand.aliases].sort((left, right) => right.length - left.length)
    if (aliases.some((alias) => fields.some((field) => field === compact(alias) || field.includes(compact(alias))))) {
      return brand
    }
  }

  if (prefix && prefix !== '부자재') return { id: `pre:${prefix}`, name: prefix, aliases: [prefix] }
  if (row.category1 && !['미정', '부자재'].includes(row.category1)) {
    return { id: `cat:${row.category1}`, name: row.category1, aliases: [row.category1] }
  }
  return OTHER_STOCK_BRAND
}

export function stockBrandOrder(id: string): number {
  const index = STOCK_BRANDS.findIndex((brand) => brand.id === id)
  if (index >= 0) return index
  if (id === OTHER_STOCK_BRAND.id) return 1000
  return 500
}
