import { useEffect, useMemo, useState } from 'react'
import { showAppToast } from '../../lib/appToast'
import type { PageTestGridRow } from '../../pages/pageTest/gridRows'
import { AdvancedDataGrid } from './grid/AdvancedDataGrid'
import { pageTestGridColumns } from './grid/pageTestGridColumns'
import './grid/advanced-grid.css'

export function PageTestDataGrid({ rows, title }: { rows: PageTestGridRow[]; title?: string }) {
  const [gridRows, setGridRows] = useState(rows)
  const columns = useMemo(() => pageTestGridColumns(), [])

  useEffect(() => {
    setGridRows(rows)
  }, [rows])

  return (
    <AdvancedDataGrid
      title={title}
      rows={gridRows}
      columns={columns}
      groupOf={(row) => ({ id: row.groupId, label: row.groupLabel })}
      exportName="pluscl-stock-grid"
      onDetail={(row) => {
        showAppToast(`${row.name} · 재고 ${row.qty}개 · ${row.expireDate}`)
      }}
      onDelete={(row) => {
        setGridRows((current) => current.filter((item) => item.id !== row.id))
        showAppToast(`${row.sku} 행을 목록에서 제거했습니다.`)
      }}
    />
  )
}
