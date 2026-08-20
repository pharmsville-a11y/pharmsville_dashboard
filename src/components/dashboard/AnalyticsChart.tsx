import { useMemo } from 'react'
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
import { formatAxisTime, formatCompact, formatTooltipTime, formatWon } from '../../lib/format'
import { cx } from '../../lib/cx'
import './AnalyticsChart.css'

function PurpleTooltip({
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
    <div className="chart-tooltip chart-tooltip--lg">
      <p className="chart-tooltip__value">{formatWon(payload[0].value ?? 0)}</p>
      <p className="chart-tooltip__time">{formatTooltipTime(label)}</p>
    </div>
  )
}

export function AnalyticsChart({
  series,
  range,
  refreshing = false,
}: {
  series: TimePoint[]
  range: DateRangeKey
  refreshing?: boolean
}) {
  const chartData = useMemo(
    () => series.map((point) => ({ time: point.timestamp, value: point.value })),
    [series],
  )

  return (
    <section className="analytics">
      <h2>통합 성과</h2>
      <div className={cx('analytics__chart', refreshing && 'is-refreshing')}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#eef0f4" />
            <XAxis
              dataKey="time"
              tickFormatter={(value: string) => formatAxisTime(value, range)}
              tick={{ fontSize: 11, fill: '#8b8fa3' }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tickFormatter={(value: number) => formatCompact(value)}
              tick={{ fontSize: 11, fill: '#8b8fa3' }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip content={<PurpleTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6c5ce7"
              strokeWidth={2.6}
              dot={false}
              activeDot={{ r: 6, fill: '#6c5ce7', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
