import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DateRangeKey, TimePoint } from '../../adapters/types'
import { RANGE_KEYS } from '../../adapters/utils'
import { formatAxisTime, formatCompact, formatTooltipTime, formatWon } from '../../lib/format'
import { cx } from '../../lib/cx'
import './TrendChart.css'

type ChartTab = 'combined' | 'commerce' | 'sns' | 'selected'

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: string
}) {
  if (!active || !payload?.[0] || !label) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__time">{formatTooltipTime(label)}</p>
      <p className="chart-tooltip__value">{formatWon(payload[0].value ?? 0)}</p>
    </div>
  )
}

export function TrendChart({
  range,
  onRangeChange,
  combined,
  commerce,
  sns,
  selected,
  selectedName,
}: {
  range: DateRangeKey
  onRangeChange: (key: DateRangeKey) => void
  combined: TimePoint[]
  commerce: TimePoint[]
  sns: TimePoint[]
  selected: TimePoint[]
  selectedName?: string
}) {
  const [tab, setTab] = useState<ChartTab>('combined')
  const series =
    tab === 'commerce' ? commerce : tab === 'sns' ? sns : tab === 'selected' ? selected : combined

  const chartData = useMemo(
    () => series.map((point) => ({ time: point.timestamp, value: point.value })),
    [series],
  )

  const values = chartData.map((row) => row.value)
  const high = values.length ? Math.max(...values) : 0
  const low = values.length ? Math.min(...values) : 0
  const open = chartData[0]?.value ?? 0
  const close = chartData[chartData.length - 1]?.value ?? 0

  const tabs: Array<{ id: ChartTab; label: string }> = [
    { id: 'combined', label: '통합' },
    { id: 'commerce', label: '쇼핑' },
    { id: 'sns', label: 'SNS' },
    { id: 'selected', label: selectedName ?? '선택 채널' },
  ]

  return (
    <section className="trend">
      <div className="trend__head">
        <div className="trend__tabs">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cx('trend__tab', tab === item.id && 'is-active')}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="trend__ranges">
          {RANGE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onRangeChange(key)}
              className={cx('trend__range', range === key && 'is-active')}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="trend__chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#eef0f4" />
            <XAxis
              dataKey="time"
              tickFormatter={(value: string) => formatAxisTime(value, range)}
              tick={{ fontSize: 11, fill: '#8b8fa3' }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(value: number) => formatCompact(value)}
              tick={{ fontSize: 11, fill: '#8b8fa3' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6c5ce7"
              strokeWidth={2.4}
              dot={false}
              activeDot={{ r: 5, fill: '#6c5ce7' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="trend__stats">
        {[
          ['High', high],
          ['Low', low],
          ['Prev Close', close],
          ['Open', open],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <p className="trend__stat-label">{label}</p>
            <p className="trend__stat-value">{formatCompact(Number(value))}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
