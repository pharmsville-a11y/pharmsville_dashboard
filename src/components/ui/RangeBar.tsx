import './RangeBar.css'

export function RangeBar({
  low,
  high,
  current,
  lowLabel,
  highLabel,
}: {
  low: number
  high: number
  current: number
  lowLabel: string
  highLabel: string
}) {
  const span = high - low || 1
  const pct = Math.min(100, Math.max(0, ((current - low) / span) * 100))

  return (
    <div className="range-bar">
      <div className="range-bar__labels">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
      <div className="range-bar__track">
        <span className="range-bar__dot" style={{ left: `${pct}%` }} />
      </div>
    </div>
  )
}
