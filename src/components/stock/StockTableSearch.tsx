import { useState } from 'react'
import { formatNumber } from '../../lib/format'
import { formatKstYmd } from '../../lib/kst'
import type { StockBrand } from '../../stock/brands'

export type StockSearchField =
  | 'all'
  | 'brand'
  | 'code'
  | 'name'
  | 'option'
  | 'category1'
  | 'category2'
  | 'lot'
  | 'expire'
  | 'remaining'
  | 'qty'
  | 'locations'

export type StockSearchFilters = {
  field: StockSearchField
  query: string
}

export const STOCK_SEARCH_FIELD_OPTIONS: Array<{ id: StockSearchField; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'brand', label: '브랜드' },
  { id: 'code', label: '상품코드' },
  { id: 'name', label: '상품' },
  { id: 'option', label: '옵션' },
  { id: 'category1', label: '대분류' },
  { id: 'category2', label: '중분류' },
  { id: 'lot', label: '로트' },
  { id: 'expire', label: '유통기한' },
  { id: 'remaining', label: '잔여' },
  { id: 'qty', label: '수량' },
  { id: 'locations', label: '로케이션' },
]

const DEFAULT_FILTERS: StockSearchFilters = {
  field: 'all',
  query: '',
}

function remainingLabel(days: number | null): string {
  if (days == null) return '기한 없음'
  if (days < 0) return '만료'
  if (days === 0) return '오늘'
  return `${formatNumber(days)}일`
}

function fieldValue(
  row: {
    brand: StockBrand
    itemCode: string
    itemName: string
    optionName: string
    category1: string
    category2: string
    lotNo: string
    expireDate: string | null
    remainingDays: number | null
    qty: number
    locations: number
  },
  field: StockSearchField,
): string {
  if (field === 'all') {
    return `${row.brand.name} ${row.itemCode} ${row.itemName} ${row.optionName} ${row.category1} ${row.category2} ${row.lotNo} ${row.expireDate ?? ''} ${remainingLabel(row.remainingDays)} ${row.qty} ${row.locations}`
  }
  if (field === 'brand') return row.brand.name
  if (field === 'code') return row.itemCode
  if (field === 'name') return row.itemName || row.itemCode
  if (field === 'option') return row.optionName
  if (field === 'category1') return row.category1
  if (field === 'category2') return row.category2
  if (field === 'lot') return row.lotNo
  if (field === 'expire') return formatKstYmd(row.expireDate) || row.expireDate || ''
  if (field === 'remaining') return remainingLabel(row.remainingDays)
  if (field === 'qty') return String(row.qty)
  if (field === 'locations') return String(row.locations)
  return ''
}

export function StockTableSearch({ onApply }: { onApply: (filters: StockSearchFilters) => void }) {
  const [field, setField] = useState<StockSearchField>(DEFAULT_FILTERS.field)
  const [query, setQuery] = useState(DEFAULT_FILTERS.query)

  function apply(nextField: StockSearchField, nextQuery: string) {
    onApply({ field: nextField, query: nextQuery.trim() })
  }

  return (
    <form
      className="stock-table__search-inline"
      onSubmit={(event) => {
        event.preventDefault()
        apply(field, query)
      }}
    >
      <select
        value={field}
        aria-label="검색 항목"
        onChange={(event) => {
          const nextField = event.target.value as StockSearchField
          setField(nextField)
          apply(nextField, query)
        }}
      >
        {STOCK_SEARCH_FIELD_OPTIONS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <input
        type="search"
        value={query}
        aria-label="검색어"
        placeholder="검색어 입력"
        onChange={(event) => {
          const nextQuery = event.target.value
          setQuery(nextQuery)
          apply(field, nextQuery)
        }}
      />
      <button type="submit">조회</button>
    </form>
  )
}

export function matchesStockSearch(
  row: {
    brand: StockBrand
    itemCode: string
    itemName: string
    optionName: string
    category1: string
    category2: string
    lotNo: string
    expireDate: string | null
    remainingDays: number | null
    qty: number
    locations: number
  },
  filters: StockSearchFilters,
): boolean {
  const needle = filters.query.trim().toLowerCase()
  if (!needle) return true
  return fieldValue(row, filters.field).toLowerCase().includes(needle)
}
