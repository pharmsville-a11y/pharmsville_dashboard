import { type ReactNode, useMemo, useState } from 'react'
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
import { formatCompact, formatTooltipTime, formatWon } from '../../lib/format'
import { cx } from '../../lib/cx'
import { AxisDateTimeTick } from './AxisDateTimeTick'
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

export function TrendChart({
  range,
  onRangeChange,
  combined,
  commerce,
  sns,
  selected,
  selectedName,
  refreshing = false,
  variant = 'sales',
  highlightTime,
  lookup,
}: {
  range: DateRangeKey
  onRangeChange: (key: DateRangeKey) => void
  combined: TimePoint[]
  commerce: TimePoint[]
  sns: TimePoint[]
  selected: TimePoint[]
  selectedName?: string
  refreshing?: boolean
  variant?: 'sales' | 'ads'
  highlightTime?: string
  lookup?: ReactNode
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

  const tabs: Array<{ id: ChartTab; label: string }> =
    variant === 'ads'
      ? [
          { id: 'combined', label: '통합' },
          { id: 'commerce', label: 'SA' },
          { id: 'sns', label: 'DA' },
          { id: 'selected', label: selectedName ?? '선택 광고' },
        ]
      : [
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
        {lookup ?? (
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
        )}
      </div>

      <div className={cx('trend__chart', refreshing && 'is-refreshing')}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="#eef0f4" />
            <XAxis
              dataKey="time"
              tick={<AxisDateTimeTick />}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
              height={36}
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
              dot={
                highlightTime
                  ? (props) => <HighlightDot {...props} highlightTime={highlightTime} />
                  : false
              }
              activeDot={{ r: 5, fill: '#6c5ce7' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className={cx('trend__stats', refreshing && 'is-refreshing')}>
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
