import { useState } from 'react'
import { Columns3, Download } from 'lucide-react'
import { downloadGridCsv, downloadGridExcel } from '../page-test/grid/gridUtils'
import type { GridColumnDef } from '../page-test/grid/types'
import { StockTableSearch, type StockSearchFilters } from './StockTableSearch'
import '../page-test/grid/advanced-grid.css'

export function StockTableToolbar<TRow>({
  title,
  columns,
  visibleIds,
  onVisibleIdsChange,
  exportRows,
  exportName,
  onSearchApply,
}: {
  title?: string
  columns: GridColumnDef<TRow>[]
  visibleIds: Set<string>
  onVisibleIdsChange: (next: Set<string>) => void
  exportRows: TRow[]
  exportName: string
  onSearchApply: (filters: StockSearchFilters) => void
}) {
  const [columnsOpen, setColumnsOpen] = useState(false)
  const exportColumns = columns.filter((column) => visibleIds.has(column.id))

  return (
    <header className="adv-grid__toolbar stock-table__toolbar">
      {title ? <h3 className="adv-grid__title">{title}</h3> : null}
      <div className="adv-grid__toolbar-left">
        <div className="adv-grid__menu">
          <button type="button" className="adv-grid__tool-btn" onClick={() => setColumnsOpen((open) => !open)}>
            <Columns3 size={16} />
            컬럼
          </button>
          {columnsOpen ? (
            <div className="adv-grid__popover stock-table__popover">
              <p className="adv-grid__popover-title">표시 컬럼</p>
              {columns.map((column) => (
                <label key={column.id} className="adv-grid__check">
                  <input
                    type="checkbox"
                    checked={visibleIds.has(column.id)}
                    onChange={(event) => {
                      onVisibleIdsChange(
                        (() => {
                          const next = new Set(visibleIds)
                          if (event.target.checked) next.add(column.id)
                          else if (next.size > 1) next.delete(column.id)
                          return next
                        })(),
                      )
                    }}
                  />
                  {column.label}
                </label>
              ))}
            </div>
          ) : null}
        </div>
        <StockTableSearch onApply={onSearchApply} />
      </div>

      <div className="adv-grid__toolbar-right">
        <button
          type="button"
          className="adv-grid__tool-btn"
          onClick={() => downloadGridCsv(`${exportName}.csv`, exportRows, exportColumns)}
        >
          <Download size={16} />
          CSV
        </button>
        <button
          type="button"
          className="adv-grid__tool-btn"
          onClick={() => void downloadGridExcel(`${exportName}.xlsx`, exportRows, exportColumns)}
        >
          <Download size={16} />
          Excel
        </button>
      </div>
    </header>
  )
}
