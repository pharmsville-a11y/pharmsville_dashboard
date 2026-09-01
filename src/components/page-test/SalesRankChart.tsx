import { useRef, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatWon } from '../../lib/format'
import type { SalesCategory, SalesDrillRow } from '../../pages/pageTest/plusclDashboard'
import { cx } from '../../lib/cx'
import { ProductTreemapModal } from './ProductTreemapModal'
import './page-test.css'

function RankTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: SalesCategory }>
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="pt-chart-tooltip">
      <p className="pt-chart-tooltip__label">{row.name}</p>
      <p>{formatWon(row.sales)}</p>
      <p>{row.share.toFixed(1)}%</p>
    </div>
  )
}

export function SalesRankChart({
  rows,
  drilldown,
  selectedId,
  onSelect,
}: {
  rows: SalesCategory[]
  drilldown: Record<string, SalesDrillRow[]>
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [modalCategoryId, setModalCategoryId] = useState<string | null>(null)

  const modalCategory = modalCategoryId ? (rows.find((row) => row.id === modalCategoryId) ?? null) : null
  const modalProducts = modalCategoryId ? (drilldown[modalCategoryId] ?? []) : []

  function openProductTreemapModal() {
    const id = selectedId ?? rows[0]?.id
    if (!id) return
    if (!selectedId) onSelect(id)
    setModalCategoryId(id)
  }

  return (
    <>
      <article className="pt-panel">
        <header className="pt-panel__head">
          <div>
            <h3>매출 상위 5개</h3>
          </div>
          <div className="pt-panel__tabs">
            <button type="button" className="is-active">
              Donut
            </button>
            <button type="button" onClick={openProductTreemapModal}>
              Treemap
            </button>
          </div>
        </header>

        <div className="pt-chart pt-chart--rank" ref={chartRef}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="sales"
                nameKey="name"
                innerRadius={68}
                outerRadius={108}
                paddingAngle={2}
                onClick={(entry) => onSelect(entry.id)}
              >
                {rows.map((row) => (
                  <Cell
                    key={row.id}
                    fill={row.color}
                    stroke={selectedId === row.id ? '#1e293b' : '#fff'}
                    strokeWidth={selectedId === row.id ? 3 : 2}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Pie>
              <Tooltip content={<RankTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="pt-rank-legend">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={cx(selectedId === row.id && 'is-active')}
                onClick={() => onSelect(row.id)}
              >
                <span className="pt-legend__dot" style={{ background: row.color }} />
                <span>{row.name}</span>
                <strong>{row.share.toFixed(1)}%</strong>
              </button>
            </li>
          ))}
        </ul>
      </article>

      <ProductTreemapModal
        category={modalCategory}
        products={modalProducts}
        onClose={() => setModalCategoryId(null)}
      />
    </>
  )
}
