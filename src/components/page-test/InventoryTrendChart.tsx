import { useRef, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, ImageDown } from 'lucide-react'
import { formatCompact, formatNumber, formatWon } from '../../lib/format'
import type { InventoryTrendRow } from '../../pages/pageTest/plusclDashboard'
import { cx } from '../../lib/cx'
import { downloadChartImage, downloadText } from './chartExport'
import './page-test.css'

type SeriesKey = 'amount' | 'qty'

const SERIES_META: Record<SeriesKey, { label: string; color: string; axis: 'left' | 'right' }> = {
  amount: { label: '재고 자산금액', color: '#6c5ce7', axis: 'left' },
  qty: { label: '재고 수량', color: '#00b894', axis: 'right' },
}

function InventoryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string; value?: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="pt-chart-tooltip">
      <p className="pt-chart-tooltip__label">{label}</p>
      {payload.map((row) => (
        <p key={row.dataKey} style={{ color: row.color }}>
          {row.dataKey === 'amount' ? formatWon(row.value ?? 0) : `${formatNumber(row.value ?? 0)}개`}
        </p>
      ))}
    </div>
  )
}

export function InventoryTrendChart({ rows }: { rows: InventoryTrendRow[] }) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({ amount: true, qty: true })

  function toggleSeries(key: SeriesKey) {
    setVisible((current) => {
      const next = { ...current, [key]: !current[key] }
      if (!next.amount && !next.qty) return current
      return next
    })
  }

  function exportCsv() {
    const header = 'date,amount,qty\n'
    const body = rows.map((row) => `${row.date},${row.amount},${row.qty}`).join('\n')
    downloadText('inventory-trend.csv', header + body, 'text/csv;charset=utf-8')
  }

  return (
    <article className="pt-panel">
      <header className="pt-panel__head">
        <div>
          <h3>총재고 자산금액 · 수량</h3>
        </div>
        <div className="pt-panel__actions">
          <button type="button" className="pt-panel__btn" onClick={() => downloadChartImage(chartRef.current, 'inventory-trend.png')}>
            <ImageDown size={16} />
            이미지
          </button>
          <button type="button" className="pt-panel__btn" onClick={exportCsv}>
            <Download size={16} />
            CSV
          </button>
        </div>
      </header>

      <div className="pt-legend">
        {(Object.keys(SERIES_META) as SeriesKey[]).map((key) => (
          <button
            key={key}
            type="button"
            className={cx('pt-legend__item', visible[key] && 'is-on')}
            onClick={() => toggleSeries(key)}
          >
            <span className="pt-legend__dot" style={{ background: SERIES_META[key].color }} />
            {SERIES_META[key].label}
          </button>
        ))}
      </div>

      <div className="pt-chart pt-chart--fill" ref={chartRef}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid stroke="#eef0f4" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="left"
              hide={!visible.amount}
              tickFormatter={(value) => formatCompact(value)}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              hide={!visible.qty}
              tickFormatter={(value) => formatCompact(value)}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<InventoryTooltip />} />
            <Legend content={() => null} />
            {visible.amount ? (
              <Bar yAxisId="left" dataKey="amount" name="재고 자산금액" fill="#6c5ce7" radius={[6, 6, 0, 0]} barSize={28} />
            ) : null}
            {visible.qty ? (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="qty"
                name="재고 수량"
                stroke="#00b894"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#00b894' }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}
