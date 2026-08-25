import { formatAxisDateTime } from '../../lib/format'

export function AxisDateTimeTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number
  y?: number
  payload?: { value?: string }
}) {
  const { date, time } = formatAxisDateTime(String(payload?.value ?? ''))
  if (!date) return null
  return (
    <text x={x} y={y} textAnchor="middle" fill="#8b8fa3">
      <tspan x={x} dy={12} fontSize={10} fontWeight={600}>
        {date}
      </tspan>
      <tspan x={x} dy={13} fontSize={10}>
        {time}
      </tspan>
    </text>
  )
}
