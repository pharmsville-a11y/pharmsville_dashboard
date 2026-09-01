import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react'
import { RANGE_KEYS, RANGE_LABELS, lookupFromRangeKey } from '../../adapters/utils'
import { cx } from '../../lib/cx'
import { formatHoursLabel, formatLookupPeriod, hoursFromSpan, isHourSpan } from '../../lib/format'
import { buildMonthCells, isSundayYmd, WEEKDAYS_SUN_FIRST } from '../../lib/calendarGrid'
import { krPublicHolidayName } from '../../lib/krHolidays'
import { kstDateFromYmd, kstYmd, shiftYmdMonth, ymdMonthStart } from '../../lib/kst'
import './SnapshotLookup.css'

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

type HourMode = 'all' | 'span' | 'pick'

function formatFieldDate(ymd: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(kstDateFromYmd(ymd))
}

function HourRangeSlider({
  fromHour,
  toHour,
  onChange,
}: {
  fromHour: number
  toHour: number
  onChange: (fromHour: number, toHour: number) => void
}) {
  const start = Math.min(fromHour, toHour)
  const end = Math.max(fromHour, toHour)
  const startPct = (start / 23) * 100
  const endPct = (end / 23) * 100

  function move(which: 'from' | 'to', next: number) {
    const value = Math.max(0, Math.min(23, next))
    if (which === 'from') {
      onChange(Math.min(value, end), end)
      return
    }
    onChange(start, Math.max(value, start))
  }

  return (
    <div className="lookup-range">
      <div className="lookup-range__labels">
        <strong>{String(start).padStart(2, '0')}시</strong>
        <span>부터</span>
        <strong>{String(end).padStart(2, '0')}시</strong>
        <span>까지</span>
      </div>
      <div
        className="lookup-range__slider"
        style={
          {
            '--range-from': `${startPct}%`,
            '--range-to': `${endPct}%`,
          } as CSSProperties
        }
      >
        <input
          type="range"
          min={0}
          max={23}
          step={1}
          aria-label="시작 시각"
          value={start}
          onChange={(event) => move('from', Number(event.target.value))}
        />
        <input
          type="range"
          min={0}
          max={23}
          step={1}
          aria-label="종료 시각"
          value={end}
          onChange={(event) => move('to', Number(event.target.value))}
        />
      </div>
      <div className="lookup-range__ticks" aria-hidden>
        {['00', '06', '12', '18', '23'].map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  )
}

function sortedHours(hours: number[] | null | undefined): number[] {
  return [...new Set(hours ?? [])].filter((hour) => hour >= 0 && hour <= 23).sort((left, right) => left - right)
}

function inferHourMode(hours: number[] | null | undefined): HourMode {
  const values = sortedHours(hours)
  if (!values.length) return 'all'
  if (values.length > 1 && isHourSpan(values)) return 'span'
  return 'pick'
}

function resolveHours(mode: HourMode, spanFrom: number, spanTo: number, picked: number[]): number[] | null {
  if (mode === 'all') return null
  if (mode === 'span') return hoursFromSpan(spanFrom, spanTo)
  const values = sortedHours(picked)
  return values.length ? values : null
}

export function SnapshotLookup({
  from,
  to,
  hours,
  availableHours = [],
  minDate,
  maxDate,
  onApply,
}: {
  from: string
  to: string
  hours: number[] | null
  availableHours?: number[]
  minDate?: string
  maxDate?: string
  onApply: (next: { from: string; to: string; hours: number[] | null }) => void
}) {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const [draftMode, setDraftMode] = useState<HourMode>(() => inferHourMode(hours))
  const [draftSpanFrom, setDraftSpanFrom] = useState(9)
  const [draftSpanTo, setDraftSpanTo] = useState(18)
  const [draftPicked, setDraftPicked] = useState<number[]>(() => sortedHours(hours))
  const [cursor, setCursor] = useState(() => ymdMonthStart(to))

  const today = maxDate ?? kstYmd()
  const known = useMemo(() => new Set(availableHours), [availableHours])
  const cells = useMemo(() => buildMonthCells(cursor), [cursor])
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'long',
      }).format(kstDateFromYmd(cursor)),
    [cursor],
  )
  const draftHours = resolveHours(draftMode, draftSpanFrom, draftSpanTo, draftPicked)
  const selectedSet = new Set(draftHours ?? [])

  useEffect(() => {
    if (!open) return
    const values = sortedHours(hours)
    setDraftFrom(from)
    setDraftTo(to)
    setDraftMode(inferHourMode(hours))
    setDraftSpanFrom(values[0] ?? 9)
    setDraftSpanTo(values.at(-1) ?? 18)
    setDraftPicked(values)
    setCursor(ymdMonthStart(to))
  }, [from, hours, open, to])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pickDay(day: string) {
    if ((minDate && day < minDate) || (maxDate && day > maxDate)) return
    if (draftFrom === draftTo) {
      if (day === draftFrom) return
      if (day < draftFrom) {
        setDraftFrom(day)
        return
      }
      setDraftTo(day)
      return
    }
    setDraftFrom(day)
    setDraftTo(day)
  }

  function toggleHour(value: number) {
    setDraftMode('pick')
    setDraftPicked((current) =>
      current.includes(value) ? current.filter((hour) => hour !== value) : [...current, value],
    )
  }

  function apply() {
    onApply({ from: draftFrom, to: draftTo, hours: draftHours })
    setOpen(false)
  }

  return (
    <>
      <button type="button" className="snapshot-lookup snapshot-lookup--chart" onClick={() => setOpen(true)}>
        <span className="snapshot-lookup__icon" aria-hidden>
          <CalendarRange size={15} strokeWidth={2.2} />
        </span>
        <span className="snapshot-lookup__summary">
          <strong>{formatLookupPeriod(from, to)}</strong>
        </span>
        <span className={cx('snapshot-lookup__hour-pill', !hours?.length && 'is-any')}>
          <Clock size={12} strokeWidth={2.2} />
          {formatHoursLabel(hours)}
        </span>
        <ChevronDown size={15} className="snapshot-lookup__chevron" />
      </button>

      {open
        ? createPortal(
            <div className="lookup-modal" role="presentation" onMouseDown={() => setOpen(false)}>
              <div
                className="lookup-modal__card"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <header className="lookup-modal__head">
                  <div>
                    <p className="lookup-modal__kicker">조회 설정</p>
                    <h2 id={titleId}>기간과 시간</h2>
                  </div>
                  <button type="button" className="lookup-modal__close" onClick={() => setOpen(false)} aria-label="닫기">
                    <X size={16} strokeWidth={2.2} />
                  </button>
                </header>

                <div className="lookup-modal__body">
                <div className="lookup-modal__presets">
                  {RANGE_KEYS.map((key) => {
                    const window = lookupFromRangeKey(key, today)
                    const active = draftFrom === window.from && draftTo === window.to
                    return (
                      <button
                        key={key}
                        type="button"
                        className={cx('lookup-modal__preset', active && 'is-active')}
                        onClick={() => {
                          setDraftFrom(window.from)
                          setDraftTo(window.to)
                          setCursor(ymdMonthStart(window.to))
                        }}
                      >
                        {RANGE_LABELS[key]}
                      </button>
                    )
                  })}
                </div>

                <div className="lookup-modal__fields">
                  <div className="lookup-modal__field">
                    <span>시작일</span>
                    <strong>{formatFieldDate(draftFrom)}</strong>
                  </div>
                  <span className="lookup-modal__dash" aria-hidden>
                    –
                  </span>
                  <div className="lookup-modal__field">
                    <span>종료일</span>
                    <strong>{formatFieldDate(draftTo)}</strong>
                  </div>
                </div>

                <div className="lookup-cal">
                  <div className="lookup-cal__nav">
                    <button
                      type="button"
                      onClick={() => setCursor(shiftYmdMonth(cursor, -1))}
                      aria-label="이전 달"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <p>{monthLabel}</p>
                    <button
                      type="button"
                      onClick={() => setCursor(shiftYmdMonth(cursor, 1))}
                      aria-label="다음 달"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="lookup-cal__week">
                    {WEEKDAYS_SUN_FIRST.map((day, index) => (
                      <span key={day} className={cx(index === 0 && 'is-sun')}>
                        {day}
                      </span>
                    ))}
                  </div>
                  <div className="lookup-cal__grid">
                    {cells.map((cell) => {
                      const day = cell.ymd
                      const disabled = Boolean((minDate && day < minDate) || (maxDate && day > maxDate))
                      const inRange = day >= draftFrom && day <= draftTo
                      const isStart = day === draftFrom
                      const isEnd = day === draftTo
                      const holidayName = krPublicHolidayName(day)
                      const isHoliday = Boolean(holidayName)
                      const isSunday = isSundayYmd(day)
                      return (
                        <span
                          key={day}
                          className={cx(
                            'lookup-cal__cell',
                            inRange && 'is-in',
                            isStart && 'is-start',
                            isEnd && 'is-end',
                          )}
                        >
                          <button
                            type="button"
                            disabled={disabled}
                            title={holidayName ?? undefined}
                            className={cx(
                              'lookup-cal__day',
                              cell.inMonth && 'is-month',
                              (isStart || isEnd) && 'is-selected',
                              day === today && 'is-today',
                              (isHoliday || isSunday) && 'is-holiday',
                            )}
                            onClick={() => pickDay(day)}
                          >
                            {Number(day.slice(8))}
                          </button>
                        </span>
                      )
                    })}
                  </div>
                </div>

                <section className="lookup-hours">
                  <div className="lookup-hours__head">
                    <div>
                      <p>시간</p>
                      <span>
                        {draftMode === 'all'
                          ? '하루의 마지막 스냅샷을 사용합니다'
                          : draftMode === 'span'
                            ? '슬라이더로 시작·종료 시각을 고릅니다'
                            : '원하는 시각만 골라 조회합니다'}
                      </span>
                    </div>
                    {draftMode === 'pick' ? (
                      <button
                        type="button"
                        className="lookup-hours__clear"
                        disabled={draftPicked.length === 0}
                        onClick={() => setDraftPicked([])}
                      >
                        전체해제
                      </button>
                    ) : null}
                  </div>

                  <div className="lookup-hours__modes">
                    {(
                      [
                        ['all', '전체'],
                        ['span', '구간'],
                        ['pick', '지정'],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        className={cx('lookup-hours__mode', draftMode === mode && 'is-active')}
                        onClick={() => {
                          setDraftMode(mode)
                          if (mode === 'pick' && draftPicked.length === 0 && draftMode === 'span') {
                            setDraftPicked(hoursFromSpan(draftSpanFrom, draftSpanTo))
                          }
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {draftMode === 'span' ? (
                    <HourRangeSlider
                      fromHour={draftSpanFrom}
                      toHour={draftSpanTo}
                      onChange={(nextFrom, nextTo) => {
                        setDraftSpanFrom(nextFrom)
                        setDraftSpanTo(nextTo)
                      }}
                    />
                  ) : null}

                  {draftMode === 'pick' ? (
                    <div className="lookup-hours__grid">
                      {HOURS.map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={cx(
                            'lookup-hours__chip',
                            selectedSet.has(value) && 'is-active',
                            known.has(value) && 'has-data',
                          )}
                          onClick={() => toggleHour(value)}
                        >
                          {String(value).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>
                </div>

                <footer className="lookup-modal__foot">
                  <div className="lookup-modal__presets-foot">
                    <button
                      type="button"
                      className="lookup-modal__today"
                      disabled={Boolean(minDate && today < minDate)}
                      onClick={() => {
                        setDraftFrom(today)
                        setDraftTo(today)
                        setCursor(ymdMonthStart(today))
                      }}
                    >
                      오늘
                    </button>
                    {(
                      [
                        [7, '1주일'],
                        [30, '1개월'],
                        [90, '3개월'],
                        [180, '6개월'],
                      ] as const
                    ).map(([days, label]) => (
                      <button
                        key={label}
                        type="button"
                        className="lookup-modal__today"
                        onClick={() => {
                          const start = kstYmd(kstDateFromYmd(today), -(days - 1))
                          const fromDay = minDate && start < minDate ? minDate : start
                          setDraftFrom(fromDay)
                          setDraftTo(today)
                          setCursor(ymdMonthStart(today))
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p>
                    {formatLookupPeriod(draftFrom, draftTo)} · {formatHoursLabel(draftHours)}
                  </p>
                  <div>
                    <button type="button" className="lookup-modal__ghost" onClick={() => setOpen(false)}>
                      취소
                    </button>
                    <button type="button" className="lookup-modal__apply" onClick={apply}>
                      적용
                    </button>
                  </div>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
