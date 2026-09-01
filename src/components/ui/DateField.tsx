import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import { cx } from '../../lib/cx'
import { buildMonthCells, isSundayYmd, WEEKDAYS_SUN_FIRST } from '../../lib/calendarGrid'
import { krPublicHolidayName } from '../../lib/krHolidays'
import { kstDateFromYmd, kstYmd, parseYmd, shiftYmdMonth, ymdMonthStart } from '../../lib/kst'
import './DateField.css'

function formatTrigger(ymd: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(kstDateFromYmd(ymd))
}

function formatPopDate(ymd: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(kstDateFromYmd(ymd))
}

function monthTitle(ymd: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
  }).format(kstDateFromYmd(ymdMonthStart(ymd)))
}

function orderedRange(from: string, to: string): { from: string; to: string } {
  return from <= to ? { from, to } : { from: to, to: from }
}

function MonthGrid({
  monthStart,
  draftFrom,
  draftTo,
  today,
  isDisabled,
  onPick,
}: {
  monthStart: string
  draftFrom: string
  draftTo: string
  today: string
  isDisabled: (ymd: string) => boolean
  onPick: (ymd: string) => void
}) {
  const cells = useMemo(() => buildMonthCells(monthStart), [monthStart])
  const range = orderedRange(draftFrom, draftTo)

  return (
    <div className="date-field__month">
      <p className="date-field__month-title">{monthTitle(monthStart)}</p>
      <div className="date-field__week">
        {WEEKDAYS_SUN_FIRST.map((day, index) => (
          <span key={day} className={cx(index === 0 && 'is-sun')}>
            {day}
          </span>
        ))}
      </div>
      <div className="date-field__grid">
        {cells.map((cell) => {
          const inRange = cell.ymd >= range.from && cell.ymd <= range.to
          const isStart = cell.ymd === range.from
          const isEnd = cell.ymd === range.to
          const holidayName = krPublicHolidayName(cell.ymd)
          const isHoliday = Boolean(holidayName)
          const isSunday = isSundayYmd(cell.ymd)
          return (
            <span
              key={cell.ymd}
              className={cx(
                'date-field__cell',
                inRange && 'is-in',
                isStart && 'is-start',
                isEnd && 'is-end',
              )}
            >
              <button
                type="button"
                disabled={isDisabled(cell.ymd)}
                title={holidayName ?? undefined}
                className={cx(
                  'date-field__day',
                  cell.inMonth && 'is-month',
                  (isStart || isEnd) && 'is-selected',
                  cell.ymd === today && 'is-today',
                  (isHoliday || isSunday) && 'is-holiday',
                )}
                onClick={() => onPick(cell.ymd)}
              >
                {Number(cell.ymd.slice(8, 10))}
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function DateField({
  label,
  from,
  to,
  max,
  min,
  onChange,
}: {
  label: string
  from: string
  to: string
  max?: string
  min?: string
  onChange: (next: { from: string; to: string }) => void
}) {
  const today = kstYmd()
  const selected = orderedRange(parseYmd(from) ?? today, parseYmd(to) ?? today)
  const [open, setOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(selected.from)
  const [draftTo, setDraftTo] = useState(selected.to)
  const [cursor, setCursor] = useState(ymdMonthStart(selected.to))
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const nextMonth = shiftYmdMonth(cursor, 1)
  const draft = orderedRange(draftFrom, draftTo)
  const todayDisabled = Boolean((min && today < min) || (max && today > max))

  useEffect(() => {
    if (!open) {
      setPos((current) => ({ ...current, ready: false }))
      return
    }
    setDraftFrom(selected.from)
    setDraftTo(selected.to)
    setCursor(ymdMonthStart(selected.to))
  }, [open, selected.from, selected.to])

  useLayoutEffect(() => {
    if (!open) return

    function place() {
      const trigger = triggerRef.current
      const pop = popRef.current
      if (!trigger || !pop) return
      const rect = trigger.getBoundingClientRect()
      const popRect = pop.getBoundingClientRect()
      const gap = 8
      let left = rect.right - popRect.width
      let top = rect.bottom + gap
      if (left < 12) left = 12
      if (left + popRect.width > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - popRect.width - 12)
      }
      if (top + popRect.height > window.innerHeight - 12) {
        top = Math.max(12, rect.top - popRect.height - gap)
      }
      setPos({ top, left, ready: true })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, cursor, draftFrom, draftTo])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || popRef.current?.contains(target)) return
      setOpen(false)
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function isDisabled(ymd: string) {
    return Boolean((min && ymd < min) || (max && ymd > max))
  }

  function pickDay(day: string) {
    if (isDisabled(day)) return
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

  function apply(next = draft) {
    if (isDisabled(next.from) || isDisabled(next.to)) return
    onChange(next)
    setOpen(false)
  }

  function applyPreset(days: number) {
    const end = max && today > max ? max : today
    let start = kstYmd(kstDateFromYmd(end), -(days - 1))
    if (min && start < min) start = min
    if (isDisabled(start) || isDisabled(end)) return
    setDraftFrom(start)
    setDraftTo(end)
    setCursor(ymdMonthStart(end))
  }

  return (
    <div className="date-field">
      <span className="date-field__label">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className={cx('date-field__trigger', open && 'is-open')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <CalendarRange size={16} />
        <span>
          {formatTrigger(selected.from)}
          <em>–</em>
          {formatTrigger(selected.to)}
        </span>
      </button>
      {open
        ? createPortal(
            <div className="date-field__layer">
              <div
                ref={popRef}
                className="date-field__pop"
                role="dialog"
                aria-label={`${label} 기간 달력`}
                style={{ top: pos.top, left: pos.left, visibility: pos.ready ? 'visible' : 'hidden' }}
              >
                <div className="date-field__nav">
                  <button type="button" aria-label="이전 달" onClick={() => setCursor(shiftYmdMonth(cursor, -1))}>
                    <ChevronLeft size={16} />
                  </button>
                  <strong>
                    <span>{monthTitle(cursor)}</span>
                    <span className="date-field__nav-sep">–</span>
                    <span className="date-field__nav-next">{monthTitle(nextMonth)}</span>
                  </strong>
                  <button type="button" aria-label="다음 달" onClick={() => setCursor(shiftYmdMonth(cursor, 1))}>
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="date-field__toolbar">
                  <span className="date-field__value">{formatPopDate(draft.from)}</span>
                  <span className="date-field__dash" aria-hidden>
                    –
                  </span>
                  <span className="date-field__value">{formatPopDate(draft.to)}</span>
                </div>
                <div className="date-field__months">
                  <MonthGrid
                    monthStart={cursor}
                    draftFrom={draftFrom}
                    draftTo={draftTo}
                    today={today}
                    isDisabled={isDisabled}
                    onPick={pickDay}
                  />
                  <MonthGrid
                    monthStart={nextMonth}
                    draftFrom={draftFrom}
                    draftTo={draftTo}
                    today={today}
                    isDisabled={isDisabled}
                    onPick={pickDay}
                  />
                </div>
                <div className="date-field__footer">
                  <div className="date-field__presets">
                    <button
                      type="button"
                      className="date-field__today"
                      disabled={todayDisabled}
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
                      <button key={label} type="button" className="date-field__today" onClick={() => applyPreset(days)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="date-field__actions">
                    <button type="button" className="date-field__cancel" onClick={() => setOpen(false)}>
                      취소
                    </button>
                    <button type="button" className="date-field__apply" onClick={() => apply()}>
                      적용
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
