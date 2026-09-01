import { cx } from '../../lib/cx'
import './page-test.css'

export function RadialGauge({
  value,
  tone = 'brand',
  size = 96,
}: {
  value: number
  tone?: 'brand' | 'warn' | 'danger'
  size?: number
}) {
  const clamped = Math.max(0, Math.min(100, value))
  const stroke = 10
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className={cx('pt-gauge', `pt-gauge--${tone}`)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="pt-gauge__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className="pt-gauge__bar"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="pt-gauge__value">{clamped}%</span>
    </div>
  )
}
