import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronDown,
  ChevronRight,
  Columns3,
  Download,
  Eye,
  Filter,
  GripVertical,
  Pin,
  Rows3,
  Trash2,
} from 'lucide-react'
import { cx } from '../../../lib/cx'
import { formatNumber } from '../../../lib/format'
import { Sparkline } from '../../ui/Sparkline'
import {
  downloadGridCsv,
  downloadGridExcel,
  filterRows,
  pageSlice,
  sortRows,
  totalPages,
} from './gridUtils'
import type {
  FilterCondition,
  GridColumnDef,
  GridDensity,
  GridRowStatus,
  PinSide,
  SortRule,
} from './types'
import { GRID_DENSITY_LABEL, STATUS_LABEL } from './types'
import './advanced-grid.css'

type GroupInfo = { id: string; label: string }

type DisplayRow<TRow> =
  | { kind: 'group'; id: string; label: string; count: number }
  | { kind: 'data'; row: TRow; rowId: string }

type AdvancedDataGridProps<TRow extends { id: string }> = {
  rows: TRow[]
  columns: GridColumnDef<TRow>[]
  title?: string
  groupOf?: (row: TRow) => GroupInfo
  exportName?: string
  defaultShowActions?: boolean
  onDetail?: (row: TRow) => void
  onDelete?: (row: TRow) => void
}

function newFilterId() {
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function statusClass(status: GridRowStatus): string {
  if (status === 'draft') return 'adv-grid__status adv-grid__status--draft'
  if (status === 'in_progress') return 'adv-grid__status adv-grid__status--progress'
  return 'adv-grid__status adv-grid__status--approved'
}

export function AdvancedDataGrid<TRow extends { id: string }>({
  rows,
  columns,
  title,
  groupOf,
  exportName = 'grid-export',
  defaultShowActions = false,
  onDetail,
  onDelete,
}: AdvancedDataGridProps<TRow>) {
  const [rowData, setRowData] = useState(rows)
  const [visibleIds, setVisibleIds] = useState(() => new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.id)))
  const [showActions, setShowActions] = useState(defaultShowActions)
  const [columnOrder, setColumnOrder] = useState(() => columns.map((c) => c.id))
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map((column) => [column.id, column.width])),
  )
  const [pins, setPins] = useState<Record<string, PinSide>>(() =>
    Object.fromEntries(columns.map((column) => [column.id, column.pin ?? null])),
  )
  const [sortRules, setSortRules] = useState<SortRule[]>([])
  const [filters, setFilters] = useState<FilterCondition[]>([])
  const [density, setDensity] = useState<GridDensity>('standard')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [editing, setEditing] = useState<{ rowId: string; columnId: string } | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dragColumnId, setDragColumnId] = useState<string | null>(null)
  const resizeRef = useRef<{ columnId: string; startX: number; startWidth: number } | null>(null)
  const columnsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setRowData(rows)
    setPage(1)
    if (groupOf) {
      const groups = new Set(rows.map((row) => groupOf(row).id))
      setExpanded(groups)
    }
  }, [rows, groupOf])

  const orderedColumns = useMemo(() => {
    const byId = new Map(columns.map((column) => [column.id, column]))
    const left = columnOrder.filter((id) => pins[id] === 'left').map((id) => byId.get(id)).filter(Boolean) as GridColumnDef<TRow>[]
    const middle = columnOrder.filter((id) => !pins[id]).map((id) => byId.get(id)).filter(Boolean) as GridColumnDef<TRow>[]
    const right = columnOrder.filter((id) => pins[id] === 'right').map((id) => byId.get(id)).filter(Boolean) as GridColumnDef<TRow>[]
    return [...left, ...middle, ...right].filter((column) => visibleIds.has(column.id))
  }, [columnOrder, columns, pins, visibleIds])

  const processed = useMemo(() => {
    const filtered = filterRows(rowData, filters, columns)
    return sortRows(filtered, sortRules, columns)
  }, [rowData, filters, sortRules, columns])

  const displayRows = useMemo((): DisplayRow<TRow>[] => {
    if (!groupOf) {
      return processed.map((row) => ({ kind: 'data', row, rowId: row.id }))
    }
    const out: DisplayRow<TRow>[] = []
    let lastGroupId = ''
    for (const row of processed) {
      const group = groupOf(row)
      if (group.id !== lastGroupId) {
        const count = processed.filter((item) => groupOf(item).id === group.id).length
        out.push({ kind: 'group', id: group.id, label: group.label, count })
        lastGroupId = group.id
      }
      if (expanded.has(group.id)) out.push({ kind: 'data', row, rowId: row.id })
    }
    return out
  }, [processed, groupOf, expanded])

  const paged = useMemo(() => {
    if (!groupOf) return pageSlice(displayRows, page, pageSize)
    const pageRows = pageSlice(processed, page, pageSize)
    const out: DisplayRow<TRow>[] = []
    let lastGroupId = ''
    for (const row of pageRows) {
      const group = groupOf(row)
      if (group.id !== lastGroupId) {
        const count = processed.filter((item) => groupOf(item).id === group.id).length
        out.push({ kind: 'group', id: group.id, label: group.label, count })
        lastGroupId = group.id
      }
      if (expanded.has(group.id)) out.push({ kind: 'data', row, rowId: row.id })
    }
    return out
  }, [displayRows, processed, page, pageSize, groupOf, expanded])

  const pageCount = totalPages(processed.length, pageSize)

  const dataOnly = useMemo(
    () => displayRows.filter((row): row is DisplayRow<TRow> & { kind: 'data' } => row.kind === 'data'),
    [displayRows],
  )

  function toggleSort(columnId: string, shiftKey: boolean) {
    setSortRules((current) => {
      const existing = current.find((rule) => rule.columnId === columnId)
      if (shiftKey) {
        if (!existing) return [...current, { columnId, direction: 'asc' }]
        if (existing.direction === 'asc') {
          return current.map((rule) => (rule.columnId === columnId ? { ...rule, direction: 'desc' } : rule))
        }
        return current.filter((rule) => rule.columnId !== columnId)
      }
      if (!existing) return [{ columnId, direction: 'asc' }]
      if (existing.direction === 'asc') return [{ columnId, direction: 'desc' }]
      return []
    })
    setPage(1)
  }

  function togglePin(columnId: string, side: PinSide) {
    setPins((current) => ({ ...current, [columnId]: current[columnId] === side ? null : side }))
  }

  function onHeaderDrop(targetId: string) {
    if (!dragColumnId || dragColumnId === targetId) return
    setColumnOrder((current) => {
      const next = [...current]
      const from = next.indexOf(dragColumnId)
      const to = next.indexOf(targetId)
      if (from < 0 || to < 0) return current
      next.splice(from, 1)
      next.splice(to, 0, dragColumnId)
      return next
    })
    setDragColumnId(null)
  }

  function startResize(event: ReactMouseEvent, columnId: string) {
    event.preventDefault()
    resizeRef.current = { columnId, startX: event.clientX, startWidth: widths[columnId] ?? 120 }
    function onMove(moveEvent: MouseEvent) {
      const session = resizeRef.current
      if (!session) return
      const next = Math.max(72, session.startWidth + (moveEvent.clientX - session.startX))
      setWidths((current) => ({ ...current, [session.columnId]: next }))
    }
    function onUp() {
      resizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function patchRow(rowId: string, columnId: string, value: string) {
    setRowData((current) =>
      current.map((row) => (row.id === rowId ? ({ ...row, [columnId]: value } as TRow) : row)),
    )
  }

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(dataOnly.map((row) => row.rowId)))
  }

  function toggleRow(rowId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(rowId)
      else next.delete(rowId)
      return next
    })
  }

  function renderCell(row: TRow, column: GridColumnDef<TRow>) {
    const value = column.getValue(row)
    if (column.kind === 'status') {
      const status = value as GridRowStatus
      return <span className={statusClass(status)}>{STATUS_LABEL[status]}</span>
    }
    if (column.kind === 'progress') {
      const pct = Number(value) || 0
      return (
        <div className="adv-grid__progress">
          <span style={{ width: `${pct}%` }} />
          <em>{pct}%</em>
        </div>
      )
    }
    if (column.kind === 'sparkline' && Array.isArray(value)) {
      return <Sparkline data={value} color="#6c5ce7" width={72} height={24} />
    }
    if (column.kind === 'thumbnail') {
      return <span className="adv-grid__thumb">{String(value)}</span>
    }
    if (editing?.rowId === row.id && editing.columnId === column.id) {
      if (column.kind === 'editable-select') {
        return (
          <select
            autoFocus
            className="adv-grid__edit"
            value={String(value ?? '')}
            onChange={(event) => patchRow(row.id, column.id, event.target.value)}
            onBlur={() => setEditing(null)}
          >
            {(column.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )
      }
      if (column.kind === 'editable-text') {
        return (
          <input
            autoFocus
            className="adv-grid__edit"
            defaultValue={String(value ?? '')}
            onBlur={(event) => {
              patchRow(row.id, column.id, event.target.value)
              setEditing(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
            }}
          />
        )
      }
    }
    if (column.kind === 'number') return formatNumber(Number(value) || 0)
    return String(value ?? '—')
  }

  const exportColumns = orderedColumns

  return (
    <section className={cx('adv-grid', `adv-grid--${density}`)}>
      <header className="adv-grid__toolbar">
        {title ? <h3 className="adv-grid__title">{title}</h3> : null}
        <div className="adv-grid__toolbar-left">
          <div className="adv-grid__menu" ref={columnsRef}>
            <button type="button" className="adv-grid__tool-btn" onClick={() => setColumnsOpen((open) => !open)}>
              <Columns3 size={16} />
              컬럼
            </button>
            {columnsOpen
              ? createPortal(
                  <div className="adv-grid__popover" style={{ position: 'fixed', top: 120, left: 48 }}>
                    <p className="adv-grid__popover-title">표시 컬럼</p>
                    {columns.map((column) => (
                      <label key={column.id} className="adv-grid__check">
                        <input
                          type="checkbox"
                          checked={visibleIds.has(column.id)}
                          onChange={(event) => {
                            setVisibleIds((current) => {
                              const next = new Set(current)
                              if (event.target.checked) next.add(column.id)
                              else if (next.size > 1) next.delete(column.id)
                              return next
                            })
                          }}
                        />
                        {column.label}
                      </label>
                    ))}
                    <label className="adv-grid__check">
                      <input
                        type="checkbox"
                        checked={showActions}
                        onChange={(event) => setShowActions(event.target.checked)}
                      />
                      Actions
                    </label>
                  </div>,
                  document.body,
                )
              : null}
          </div>

          <div className="adv-grid__menu">
            <button type="button" className="adv-grid__tool-btn" onClick={() => setFiltersOpen((open) => !open)}>
              <Filter size={16} />
              검색
            </button>
            {filtersOpen ? (
              <div className="adv-grid__filters">
                {filters.map((filter) => (
                  <div key={filter.id} className="adv-grid__filter-row">
                    <select
                      value={filter.columnId}
                      onChange={(event) =>
                        setFilters((current) =>
                          current.map((item) =>
                            item.id === filter.id ? { ...item, columnId: event.target.value } : item,
                          ),
                        )
                      }
                    >
                      {columns.map((column) => (
                        <option key={column.id} value={column.id}>
                          {column.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filter.operator}
                      onChange={(event) =>
                        setFilters((current) =>
                          current.map((item) =>
                            item.id === filter.id
                              ? { ...item, operator: event.target.value as FilterCondition['operator'] }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="contains">포함</option>
                      <option value="equals">일치</option>
                      <option value="gte">이상</option>
                      <option value="lte">이하</option>
                    </select>
                    <input
                      value={filter.value}
                      placeholder="값"
                      onChange={(event) =>
                        setFilters((current) =>
                          current.map((item) => (item.id === filter.id ? { ...item, value: event.target.value } : item)),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="adv-grid__icon-btn"
                      onClick={() => setFilters((current) => current.filter((item) => item.id !== filter.id))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="adv-grid__link-btn"
                  onClick={() =>
                    setFilters((current) => [
                      ...current,
                      { id: newFilterId(), columnId: columns[0]?.id ?? '', operator: 'contains', value: '' },
                    ])
                  }
                >
                  + 조건 추가
                </button>
              </div>
            ) : null}
          </div>

          <label className="adv-grid__density">
            <Rows3 size={16} />
            <select value={density} onChange={(event) => setDensity(event.target.value as GridDensity)}>
              {Object.entries(GRID_DENSITY_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="adv-grid__toolbar-right">
          <button type="button" className="adv-grid__tool-btn" onClick={() => downloadGridCsv(`${exportName}.csv`, processed, exportColumns)}>
            <Download size={16} />
            CSV
          </button>
          <button
            type="button"
            className="adv-grid__tool-btn"
            onClick={() => void downloadGridExcel(`${exportName}.xlsx`, processed, exportColumns)}
          >
            <Download size={16} />
            Excel
          </button>
        </div>
      </header>

      <div className="adv-grid__table-wrap">
        <table className="adv-grid__table">
          <thead>
            <tr>
              <th className="adv-grid__pin-left adv-grid__check-col">
                <div className="adv-grid__check-cell">
                  <input
                    type="checkbox"
                    checked={dataOnly.length > 0 && dataOnly.every((row) => selected.has(row.rowId))}
                    onChange={(event) => toggleAll(event.target.checked)}
                    aria-label="전체 선택"
                  />
                </div>
              </th>
              {orderedColumns.map((column) => {
                const sortIndex = sortRules.findIndex((rule) => rule.columnId === column.id)
                const sortRule = sortRules[sortIndex]
                return (
                  <th
                    key={column.id}
                    className={cx(
                      pins[column.id] === 'left' && 'adv-grid__pin-left',
                      pins[column.id] === 'right' && 'adv-grid__pin-right',
                    )}
                    style={{ width: widths[column.id] ?? column.width }}
                    draggable
                    onDragStart={() => setDragColumnId(column.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => onHeaderDrop(column.id)}
                  >
                    <div className="adv-grid__th-inner">
                      <GripVertical size={14} className="adv-grid__th-grip" aria-hidden />
                      <button
                        type="button"
                        className="adv-grid__th-btn"
                        onClick={(event) => column.sortable !== false && toggleSort(column.id, event.shiftKey)}
                      >
                        {column.label}
                        {sortRule ? (
                          <span className="adv-grid__sort">
                            {sortRule.direction === 'asc' ? '↑' : '↓'}
                            {sortRules.length > 1 ? sortIndex + 1 : ''}
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className={cx('adv-grid__pin-btn', pins[column.id] && 'is-pinned')}
                        title={pins[column.id] ? '고정 해제' : '좌측 고정'}
                        aria-pressed={Boolean(pins[column.id])}
                        onClick={() => togglePin(column.id, 'left')}
                      >
                        <Pin size={12} />
                      </button>
                      <span
                        className="adv-grid__resizer"
                        onMouseDown={(event) => startResize(event, column.id)}
                        role="separator"
                        aria-orientation="vertical"
                      />
                    </div>
                  </th>
                )
              })}
              {showActions ? <th className="adv-grid__pin-right adv-grid__actions-col">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {paged.map((entry) => {
              if (entry.kind === 'group') {
                const open = expanded.has(entry.id)
                return (
                  <tr key={`group-${entry.id}`} className="adv-grid__group-row">
                    <td className="adv-grid__pin-left adv-grid__check-col">
                      <div className="adv-grid__check-cell">
                        {groupOf ? (
                          <button
                            type="button"
                            className="adv-grid__expand"
                            aria-label={open ? '그룹 접기' : '그룹 펼치기'}
                            onClick={() =>
                              setExpanded((current) => {
                                const next = new Set(current)
                                if (next.has(entry.id)) next.delete(entry.id)
                                else next.add(entry.id)
                                return next
                              })
                            }
                          >
                            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td colSpan={orderedColumns.length + (showActions ? 1 : 0)}>
                      <strong>{entry.label}</strong>
                      <span className="adv-grid__group-count">{entry.count}건</span>
                    </td>
                  </tr>
                )
              }

              const row = entry.row
              return (
                <tr key={entry.rowId} className={selected.has(entry.rowId) ? 'is-selected' : undefined}>
                  <td className="adv-grid__pin-left adv-grid__check-col">
                    <div className="adv-grid__check-cell">
                      <input
                        type="checkbox"
                        checked={selected.has(entry.rowId)}
                        onChange={(event) => toggleRow(entry.rowId, event.target.checked)}
                        aria-label="행 선택"
                      />
                    </div>
                  </td>
                  {orderedColumns.map((column) => (
                    <td
                      key={column.id}
                      className={cx(
                        pins[column.id] === 'left' && 'adv-grid__pin-left',
                        pins[column.id] === 'right' && 'adv-grid__pin-right',
                        (column.kind === 'editable-text' || column.kind === 'editable-select') && 'is-editable',
                      )}
                      style={{ width: widths[column.id] ?? column.width }}
                      onDoubleClick={() => {
                        if (column.kind === 'editable-text' || column.kind === 'editable-select') {
                          setEditing({ rowId: row.id, columnId: column.id })
                        }
                      }}
                    >
                      {renderCell(row, column)}
                    </td>
                  ))}
                  {showActions ? (
                  <td className="adv-grid__pin-right adv-grid__actions-col">
                    <div className="adv-grid__row-actions">
                      <button type="button" title="상세보기" onClick={() => onDetail?.(row)}>
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        title="수정"
                        onClick={() => {
                          const editable = orderedColumns.find(
                            (column) => column.kind === 'editable-text' || column.kind === 'editable-select',
                          )
                          if (editable) setEditing({ rowId: row.id, columnId: editable.id })
                        }}
                      >
                        ✎
                      </button>
                      <button type="button" title="삭제" onClick={() => onDelete?.(row)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <footer className="adv-grid__footer">
        <span>
          선택 {formatNumber(selected.size)}건 · 전체 {formatNumber(processed.length)}건
        </span>
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
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            이전
          </button>
          <span>
            {page} / {pageCount}
          </span>
          <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>
            다음
          </button>
        </div>
      </footer>
    </section>
  )
}
