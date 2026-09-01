import { type ReactNode, useMemo } from 'react'
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
import { formatCompact, formatTooltipTime, formatWon } from '../../lib/format'
import { cx } from '../../lib/cx'
import { AxisDateTimeTick } from './AxisDateTimeTick'
import './AnalyticsChart.css'

function HighlightDot({
  cx,
  cy,
  payload,
  highlightTime,
}: {
  cx?: number
  cy?: number
  payload?: { time?: string }
  highlightTime?: string
}) {
  if (cx == null || cy == null || !highlightTime || payload?.time !== highlightTime) return null
  return <circle cx={cx} cy={cy} r={6} fill="#6c5ce7" stroke="#fff" strokeWidth={2} />
}

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
  range: _range,
  refreshing = false,
  title = '통합 성과',
  highlightTime,
  action,
  lookup,
}: {
  series: TimePoint[]
  range: DateRangeKey
  refreshing?: boolean
  title?: string
  highlightTime?: string
  action?: ReactNode
  lookup?: ReactNode
}) {
  const chartData = useMemo(
    () => series.map((point) => ({ time: point.timestamp, value: point.value })),
    [series],
  )

  return (
    <section className="analytics">
      <div className="analytics__head">
        <div className="analytics__head-copy">
          <h2>{title}</h2>
          {action}
        </div>
        {lookup}
      </div>
      <div className={cx('analytics__chart', refreshing && 'is-refreshing')}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#eef0f4" />
            <XAxis
              dataKey="time"
              tick={<AxisDateTimeTick />}
              axisLine={false}
              tickLine={false}
              minTickGap={44}
              height={36}
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
              dot={
                highlightTime
                  ? (props) => <HighlightDot {...props} highlightTime={highlightTime} />
                  : false
              }
              activeDot={{ r: 6, fill: '#6c5ce7', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
