import { useEffect, useMemo, useState } from 'react'
import { formatNumber } from '../../lib/format'
import { formatKstYmd } from '../../lib/kst'
import { pageSlice, totalPages } from '../page-test/grid/gridUtils'
import type { StockBrand } from '../../stock/brands'
import type { PlusclStockRow } from '../../services/queryPluscl'
import {
  stockTableColumns,
  toStockTableRows,
  type StockTableRow,
} from './stockTableColumns'
import { StockTableToolbar } from './StockTableToolbar'
import { matchesStockSearch, type StockSearchFilters } from './StockTableSearch'
import './stock-table.css'

type StockSortKey = 'brand' | 'code' | 'name' | 'lot' | 'expire' | 'remaining' | 'qty' | 'locations'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

function remainingLabel(days: number | null): string {
  if (days == null) return '기한 없음'
  if (days < 0) return '만료'
  if (days === 0) return '오늘'
  return `${formatNumber(days)}일`
}

function stockSortValue(row: StockTableRow, key: StockSortKey): string | number {
  if (key === 'brand') return row.brand.name
  if (key === 'code') return row.itemCode
  if (key === 'name') return row.itemName || row.itemCode
  if (key === 'lot') return row.lotNo
  if (key === 'expire') return row.expireDate ?? ''
  if (key === 'remaining') return row.remainingDays ?? Number.POSITIVE_INFINITY
  if (key === 'qty') return row.qty
  return row.locations
}

function renderCell(row: StockTableRow, columnId: string) {
  if (columnId === 'brand') return row.brand.name
  if (columnId === 'code') return row.itemCode
  if (columnId === 'name') {
    return (
      <>
        <strong>{row.itemName || row.itemCode}</strong>
        {row.optionName ? <span>{row.optionName}</span> : null}
      </>
    )
  }
  if (columnId === 'option') return row.optionName || '—'
  if (columnId === 'category1') return row.category1 || '—'
  if (columnId === 'category2') return row.category2 || '—'
  if (columnId === 'lot') return row.lotNo || '—'
  if (columnId === 'expire') return formatKstYmd(row.expireDate) || '—'
  if (columnId === 'remaining') return remainingLabel(row.remainingDays)
  if (columnId === 'qty') return formatNumber(row.qty)
  if (columnId === 'locations') return formatNumber(row.locations)
  return '—'
}

function cellClass(columnId: string): string | undefined {
  if (columnId === 'expire') return 'commerce__stock-expire'
  if (columnId === 'remaining') return 'commerce__stock-remain'
  return undefined
}

export function PlusclStockTable({
  rows,
}: {
  rows: Array<PlusclStockRow & { brand: StockBrand }>
}) {
  const columns = useMemo(() => stockTableColumns(), [])
  const [visibleIds, setVisibleIds] = useState(
    () => new Set(columns.filter((column) => column.defaultVisible !== false).map((column) => column.id)),
  )
  const [appliedFilters, setAppliedFilters] = useState<StockSearchFilters>({
    field: 'all',
    query: '',
  })
  const [sortKey, setSortKey] = useState<StockSortKey>('brand')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const tableRows = useMemo(() => toStockTableRows(rows), [rows])

  const filtered = useMemo(
    () => tableRows.filter((row) => matchesStockSearch(row, appliedFilters)),
    [tableRows, appliedFilters],
  )

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((left, right) => {
      const a = stockSortValue(left, sortKey)
      const b = stockSortValue(right, sortKey)
      const compared =
        typeof a === 'number' && typeof b === 'number'
          ? a - b
          : String(a).localeCompare(String(b), 'ko')
      if (compared !== 0) return sortDir === 'asc' ? compared : -compared
      const brandCmp = left.brand.name.localeCompare(right.brand.name, 'ko')
      if (brandCmp !== 0) return brandCmp
      return left.itemCode.localeCompare(right.itemCode, 'ko')
    })
    return copy
  }, [filtered, sortKey, sortDir])

  const visibleColumns = useMemo(
    () => columns.filter((column) => visibleIds.has(column.id)),
    [columns, visibleIds],
  )

  useEffect(() => {
    setPage(1)
  }, [rows, appliedFilters, sortKey, sortDir, pageSize])

  const pageCount = totalPages(sorted.length, pageSize)
  const currentPage = Math.min(page, pageCount)
  const paged = pageSlice(sorted, currentPage, pageSize)

  function handleSort(column: StockSortKey) {
    if (sortKey === column) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(column)
    setSortDir(column === 'qty' || column === 'locations' || column === 'remaining' ? 'desc' : 'asc')
  }

  if (rows.length === 0) return <p className="commerce__empty">현재고 스냅샷이 없습니다.</p>

  return (
    <div className="stock-table">
      <StockTableToolbar
        title="재고 목록"
        columns={columns}
        visibleIds={visibleIds}
        onVisibleIdsChange={setVisibleIds}
        exportRows={sorted}
        exportName="pluscl-stock"
        onSearchApply={setAppliedFilters}
      />

      {sorted.length === 0 ? (
        <p className="commerce__empty">검색 조건에 맞는 재고가 없습니다.</p>
      ) : (
        <>
          <div className="stock-table__wrap">
        <table>
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <SortTh
                  key={column.id}
                  label={column.label}
                  column={column.id as StockSortKey}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  sortable={['brand', 'code', 'name', 'lot', 'expire', 'remaining', 'qty', 'locations'].includes(column.id)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => {
              const tone =
                row.remainingDays == null
                  ? ''
                  : row.remainingDays < 0
                    ? ' is-expired'
                    : row.remainingDays <= 183
                      ? ' is-soon'
                      : ''
              return (
                <tr key={row.id} className={tone || undefined}>
                  {visibleColumns.map((column) => (
                    <td key={column.id} className={cellClass(column.id)}>
                      {renderCell(row, column.id)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
          </div>

          <footer className="adv-grid__footer stock-table__footer">
            <span>전체 {formatNumber(sorted.length)}건</span>
            <div className="adv-grid__pager">
              <label>
                Page size
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value))
                    setPage(1)
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" disabled={currentPage <= 1} onClick={() => setPage((current) => current - 1)}>
                이전
              </button>
              <span>
                {currentPage} / {pageCount}
              </span>
              <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage((current) => current + 1)}>
                다음
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  )
}

function SortTh({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  sortable,
}: {
  label: string
  column: StockSortKey
  sortKey: StockSortKey
  sortDir: 'asc' | 'desc'
  onSort: (column: StockSortKey) => void
  sortable: boolean
}) {
  const active = sortKey === column
  if (!sortable) return <th>{label}</th>
  return (
    <th>
      <button type="button" className={`commerce__sort${active ? ' is-on' : ''}`} onClick={() => onSort(column)}>
        {label}
        <em>{active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</em>
      </button>
    </th>
  )
}
