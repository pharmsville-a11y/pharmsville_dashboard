import { formatKstYmd } from '../../lib/kst'
import type { GridColumnDef } from '../page-test/grid/types'
import type { StockBrand } from '../../stock/brands'
import type { PlusclStockRow } from '../../services/queryPluscl'

export type StockTableRow = PlusclStockRow & {
  id: string
  brand: StockBrand
}

function remainingLabel(days: number | null): string {
  if (days == null) return '기한 없음'
  if (days < 0) return '만료'
  if (days === 0) return '오늘'
  return `${days}일`
}

export function stockRowId(row: PlusclStockRow & { brand: StockBrand }): string {
  return `${row.brand.id}-${row.itemCode}-${row.optionName}-${row.lotNo}-${row.expireDate ?? ''}`
}

export function toStockTableRows(rows: Array<PlusclStockRow & { brand: StockBrand }>): StockTableRow[] {
  return rows.map((row) => ({ ...row, id: stockRowId(row) }))
}

export function stockTableColumns(): GridColumnDef<StockTableRow>[] {
  return [
    {
      id: 'brand',
      label: '브랜드',
      width: 96,
      kind: 'text',
      getValue: (row) => row.brand.name,
    },
    {
      id: 'code',
      label: '상품코드',
      width: 108,
      kind: 'text',
      getValue: (row) => row.itemCode,
    },
    {
      id: 'name',
      label: '상품',
      width: 180,
      kind: 'text',
      getValue: (row) => row.itemName || row.itemCode,
    },
    {
      id: 'option',
      label: '옵션',
      width: 120,
      kind: 'text',
      defaultVisible: false,
      getValue: (row) => row.optionName,
    },
    {
      id: 'category1',
      label: '대분류',
      width: 100,
      kind: 'text',
      defaultVisible: false,
      getValue: (row) => row.category1,
    },
    {
      id: 'category2',
      label: '중분류',
      width: 100,
      kind: 'text',
      defaultVisible: false,
      getValue: (row) => row.category2,
    },
    {
      id: 'lot',
      label: '로트',
      width: 96,
      kind: 'text',
      getValue: (row) => row.lotNo,
    },
    {
      id: 'expire',
      label: '유통기한',
      width: 108,
      kind: 'text',
      getValue: (row) => formatKstYmd(row.expireDate) || '—',
      getSortValue: (row) => row.expireDate ?? '',
    },
    {
      id: 'remaining',
      label: '잔여',
      width: 88,
      kind: 'text',
      getValue: (row) => remainingLabel(row.remainingDays),
      getSortValue: (row) => row.remainingDays ?? Number.POSITIVE_INFINITY,
    },
    {
      id: 'qty',
      label: '수량',
      width: 88,
      kind: 'number',
      getValue: (row) => row.qty,
    },
    {
      id: 'locations',
      label: '로케이션',
      width: 96,
      kind: 'number',
      getValue: (row) => row.locations,
    },
  ]
}
