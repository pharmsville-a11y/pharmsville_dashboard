import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { AlertIssue } from '../../pages/pageTest/plusclDashboard'
import './page-test.css'

export function AlertDetailModal({
  issue,
  issues,
  onClose,
  onSelect,
}: {
  issue: AlertIssue | null
  issues: AlertIssue[]
  onClose: () => void
  onSelect: (issue: AlertIssue) => void
}) {
  useEffect(() => {
    if (!issue) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('is-pt-modal-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('is-pt-modal-open')
    }
  }, [issue, onClose])

  if (!issue) return null

  return createPortal(
    <div className="pt-modal" role="presentation" onClick={onClose}>
      <div className="pt-modal__panel" role="dialog" aria-modal="true" aria-labelledby="pt-alert-title" onClick={(event) => event.stopPropagation()}>
        <header className="pt-modal__head">
          <div>
            <span className={`pt-kpi__alert-level pt-kpi__alert-level--${issue.level}`}>
              {issue.level === 'warning' ? '경고' : '주의'}
            </span>
            <h3 id="pt-alert-title">이상 징후 상세</h3>
          </div>
          <button type="button" className="pt-modal__close" aria-label="닫기" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <p className="pt-modal__time">{issue.at}</p>
        <p className="pt-modal__body">{issue.detail}</p>
        <ul className="pt-modal__list">
          {issues.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={item.id === issue.id ? 'is-active' : undefined}
                onClick={() => onSelect(item)}
              >
                <span className={`pt-kpi__alert-level pt-kpi__alert-level--${item.level}`}>
                  {item.level === 'warning' ? '경고' : '주의'}
                </span>
                <span>{item.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
