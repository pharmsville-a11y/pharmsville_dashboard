import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bell } from 'lucide-react'
import { cx } from '../../lib/cx'
import type { AlertIssue, PageTestDashboard } from '../../pages/pageTest/plusclDashboard'
import { AlertDetailModal } from './AlertDetailModal'
import './page-test.css'

const EMPTY_ISSUE: AlertIssue = {
  id: 'empty',
  level: 'caution',
  text: '현재 주의·경고 이슈가 없습니다',
  at: '—',
  detail: '유통기한 임박·만료 재고와 미출고 주문을 모니터링합니다.',
}

const TICK_MS = 4200
const ANIM_MS = 480

function AlertSlide({ issue }: { issue: AlertIssue }) {
  return (
    <>
      <p className="pt-kpi__alert-text" title={issue.text}>
        {issue.text}
      </p>
      <span className="pt-kpi__alert-time">{issue.at}</span>
    </>
  )
}

function alertSlideClass(issue: AlertIssue, extra?: string) {
  const tone = issue.id === 'empty' ? 'neutral' : issue.level
  return cx('pt-kpi__alert-slide', `pt-kpi__alert-slide--${tone}`, extra)
}

export function KpiAlertCard({ data }: { data: PageTestDashboard['alerts'] }) {
  const issues = data.issues.length > 0 ? data.issues : [EMPTY_ISSUE]
  const [current, setCurrent] = useState(issues[0] ?? EMPTY_ISSUE)
  const [leaving, setLeaving] = useState<AlertIssue | null>(null)
  const [selected, setSelected] = useState<AlertIssue | null>(null)
  const indexRef = useRef(0)
  const issuesRef = useRef(issues)
  const currentRef = useRef(current)
  issuesRef.current = issues
  currentRef.current = current

  useEffect(() => {
    indexRef.current = 0
    setCurrent(issues[0] ?? EMPTY_ISSUE)
    setLeaving(null)
  }, [issues])

  useEffect(() => {
    if (issues.length <= 1) return

    const timer = window.setInterval(() => {
      const list = issuesRef.current
      if (list.length <= 1) return

      const nextIndex = (indexRef.current + 1) % list.length
      const next = list[nextIndex] ?? EMPTY_ISSUE

      setLeaving(currentRef.current)
      setCurrent(next)
      indexRef.current = nextIndex
    }, TICK_MS)

    return () => window.clearInterval(timer)
  }, [issues.length])

  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => setLeaving(null), ANIM_MS)
    return () => window.clearTimeout(timer)
  }, [leaving, current])

  return (
    <>
      <article
        className="pt-kpi pt-kpi--alert"
        role="button"
        tabIndex={0}
        onClick={() => data.issues.length > 0 && setSelected(current)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (data.issues.length > 0) setSelected(current)
          }
        }}
      >
        <div className="pt-kpi__alert-head">
          <p className="pt-kpi__label">이상 징후 / 알림</p>
          <Bell size={18} aria-hidden />
        </div>
        <div className="pt-kpi__alert-counts">
          <span className="pt-kpi__alert-pill pt-kpi__alert-pill--warn">
            <AlertTriangle size={14} />
            경고 {data.warningCount}
          </span>
          <span className="pt-kpi__alert-pill pt-kpi__alert-pill--caution">주의 {data.cautionCount}</span>
        </div>

        <div className="pt-kpi__alert-viewport" aria-live="polite">
          {leaving ? (
            <div className={alertSlideClass(leaving, 'is-leaving')} key={`leave-${leaving.id}`}>
              <AlertSlide issue={leaving} />
            </div>
          ) : null}
          <div className={alertSlideClass(current, leaving ? 'is-entering' : undefined)} key={`current-${current.id}`}>
            <AlertSlide issue={current} />
          </div>
        </div>

        <p className="pt-kpi__hint">클릭하면 상세 팝업이 열립니다</p>
      </article>

      <AlertDetailModal
        issue={selected}
        issues={data.issues}
        onClose={() => setSelected(null)}
        onSelect={setSelected}
      />
    </>
  )
}
